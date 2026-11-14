import { getMessage } from '../tools/i18n';
import type TransmissionTransport from './TransmissionTransport';
import { storageGet, storageSet } from '../tools/chromeStorage';
import getLogger from '../tools/getLogger';
import trackerHosts from '../tools/trackerHosts';
import {
  isSeedTimeLimitRule,
  DEFAULT_SEED_TIME_LIMIT,
  type SeedTimeLimitInput,
  type SeedTimeLimitRule,
} from '../types/seedTimeLimit';

const logger = getLogger('SeedTimeLimit');
const STATE_KEY = '_seedTimeLimitState';
const CHECK_INTERVAL = 60000;

interface Config {
  url: string;
  seedTimeLimits: SeedTimeLimitRule[];
  setKeyValue(options: Record<string, unknown>): void;
}

interface RuleState {
  url: string;
  revision: string;
  excluded: string[];
}

interface SeedTorrent {
  hash: string;
  status: number;
  seconds: number;
  complete: boolean;
  hosts: string[] | null;
}

function torrentsFromResponse(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('Invalid seed-time torrent response');
  const torrents: Record<string, unknown>[] = [];
  const entries: unknown[] = value;
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error('Invalid seed-time torrent response');
    }
    torrents.push(entry as Record<string, unknown>);
  }
  return torrents;
}

export default class SeedTimeLimitService {
  private queue: Promise<unknown> = Promise.resolve();
  private writes: Promise<unknown> = Promise.resolve();
  private version = 0;
  private pendingRemovals = 0;
  private nextCheck = 0;

  constructor(
    private transport: TransmissionTransport,
    private getConfig: () => Config
  ) {}

  private exclusive<T>(action: () => Promise<T>, lane: 'queue' | 'writes' = 'queue'): Promise<T> {
    const result = this[lane].then(action);
    // Keep the lock usable after a failed operation; its caller still receives the rejection.
    this[lane] = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  async getTrackers(): Promise<string[]> {
    const response = await this.transport.sendAction({
      method: 'torrent-get',
      arguments: { fields: ['trackers'] },
    });
    const hosts = new Set<string>();
    for (const torrent of torrentsFromResponse(response.arguments.torrents)) {
      const found = trackerHosts(torrent.trackers);
      if (found === null) {
        logger.warn('Ignoring malformed tracker data in tracker picker');
        continue;
      }
      found.forEach((host) => hosts.add(host));
    }
    return Array.from(hosts).sort();
  }

  private async census(): Promise<SeedTorrent[]> {
    const response = await this.transport.sendAction({
      method: 'torrent-get',
      arguments: { fields: ['hashString', 'status', 'secondsSeeding', 'percentDone', 'trackers'] },
    });
    return torrentsFromResponse(response.arguments.torrents).map((torrent) => {
      const { hashString, status, secondsSeeding, percentDone } = torrent;
      if (
        typeof hashString !== 'string' ||
        !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(hashString) ||
        typeof status !== 'number' ||
        !Number.isInteger(status) ||
        status < 0 ||
        status > 6 ||
        typeof secondsSeeding !== 'number' ||
        !Number.isFinite(secondsSeeding) ||
        secondsSeeding < 0 ||
        typeof percentDone !== 'number' ||
        !Number.isFinite(percentDone) ||
        percentDone < 0 ||
        percentDone > 1
      )
        throw new Error('Invalid seed-time torrent response');
      const hosts = trackerHosts(torrent.trackers);
      if (hosts === null) logger.warn('Skipping torrent with malformed tracker data');
      return {
        hash: hashString.toLowerCase(),
        status,
        seconds: secondsSeeding,
        complete: percentDone === 1,
        hosts,
      };
    });
  }

  private async readStates(): Promise<RuleState[]> {
    const data = await storageGet<Record<string, unknown>>(STATE_KEY);
    const value = data[STATE_KEY];
    // The first single-rule release stored one object under this same local-only key.
    const entries: unknown[] = value === undefined ? [] : Array.isArray(value) ? value : [value];
    const states: RuleState[] = [];
    for (const entry of entries) {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        !('url' in entry) ||
        typeof entry.url !== 'string' ||
        !('revision' in entry) ||
        typeof entry.revision !== 'string' ||
        !('excluded' in entry) ||
        !Array.isArray(entry.excluded) ||
        !entry.excluded.every((hash: unknown) => typeof hash === 'string')
      ) {
        logger.warn('Ignoring malformed local seed-time activation state');
        continue;
      }
      states.push({ url: entry.url, revision: entry.revision, excluded: entry.excluded });
    }
    return states;
  }

  private isCurrent(rules: SeedTimeLimitRule[], version: number): boolean {
    const config = this.getConfig();
    return (
      version === this.version &&
      !this.pendingRemovals &&
      config.url === this.transport.url &&
      JSON.stringify(config.seedTimeLimits) === JSON.stringify(rules)
    );
  }

  private async persistRules(rules: SeedTimeLimitRule[]): Promise<void> {
    await storageSet({ seedTimeLimits: rules });
    this.getConfig().setKeyValue({ seedTimeLimits: rules });
    this.nextCheck = 0;
  }

  private validate(input: SeedTimeLimitInput): void {
    if (!isSeedTimeLimitRule({ ...input, revision: '' })) {
      throw new Error(getMessage('seedTimeLimitInvalid'));
    }
    if (input.enabled && (!input.tracker || /[/:?#@\s]/.test(input.tracker))) {
      throw new Error(getMessage('seedTimeLimitInvalid'));
    }
  }

  private eligible(
    torrents: SeedTorrent[],
    rule: SeedTimeLimitInput,
    excluded: string[]
  ): string[] {
    const skip = new Set(excluded);
    return torrents
      .filter(
        (torrent) =>
          !skip.has(torrent.hash) &&
          torrent.complete &&
          (torrent.status === 5 || torrent.status === 6) &&
          torrent.seconds >= rule.hours * 3600 &&
          torrent.hosts?.length === 1 &&
          torrent.hosts[0] === rule.tracker
      )
      .map((torrent) => torrent.hash);
  }

  private async exclusions(input: SeedTimeLimitInput, torrents: SeedTorrent[]): Promise<string[]> {
    if (input.includeExisting) return [];
    const current = this.getConfig().seedTimeLimits.find((rule) => rule.tracker === input.tracker);
    const state = (await this.readStates()).find((entry) => entry.revision === current?.revision);
    if (
      current?.enabled &&
      !current.includeExisting &&
      current.tracker === input.tracker &&
      state?.url === this.transport.url &&
      state.revision === current.revision
    ) {
      return state.excluded;
    }
    return torrents.map((torrent) => torrent.hash);
  }

  preview(input: SeedTimeLimitInput): Promise<number> {
    const rules = this.getConfig().seedTimeLimits;
    const version = this.version;
    return this.exclusive(async () => {
      this.validate(input);
      const torrents = await this.census();
      const excluded = await this.exclusions(input, torrents);
      if (!this.isCurrent(rules, version)) throw new Error(getMessage('seedTimeLimitChanged'));
      return this.eligible(torrents, input, excluded).length;
    });
  }

  remove(tracker: string, allowMissing = false): Promise<void> {
    // Invalidate in-flight reads immediately; deletion never waits for a network request.
    this.version++;
    this.pendingRemovals++;
    return this.exclusive(async () => {
      const current = this.getConfig().seedTimeLimits;
      if (!allowMissing && !current.some((rule) => rule.tracker === tracker)) {
        throw new Error(getMessage('seedTimeLimitRuleMissing'));
      }
      await this.persistRules(current.filter((rule) => rule.tracker !== tracker));
    }, 'writes').finally(() => {
      this.pendingRemovals--;
    });
  }

  save(input: SeedTimeLimitInput): Promise<SeedTimeLimitRule> {
    if (input.enabled === false) {
      const current = this.getConfig().seedTimeLimits.find(
        (rule) => rule.tracker === input.tracker
      );
      const values = isSeedTimeLimitRule({ ...input, revision: '' })
        ? input
        : isSeedTimeLimitRule(current)
          ? current
          : DEFAULT_SEED_TIME_LIMIT;
      const rule = {
        ...values,
        enabled: false,
        includeExisting: false,
        revision: crypto.randomUUID(),
      };
      return this.remove(rule.tracker, true).then(() => rule);
    }
    const requestedRules = this.getConfig().seedTimeLimits;
    const version = this.version;
    return this.exclusive(async () => {
      if (!this.isCurrent(requestedRules, version)) {
        throw new Error(getMessage('seedTimeLimitChanged'));
      }
      this.validate(input);
      const rule: SeedTimeLimitRule = { ...input, revision: crypto.randomUUID() };
      const torrents = await this.census();
      if (!torrents.some((torrent) => torrent.hosts?.includes(input.tracker))) {
        throw new Error(getMessage('seedTimeLimitNoTracker'));
      }
      const excluded = await this.exclusions(input, torrents);
      return this.exclusive(async () => {
        const states = await this.readStates();
        if (!this.isCurrent(requestedRules, version)) {
          throw new Error(getMessage('seedTimeLimitChanged'));
        }
        const rules = requestedRules.some((entry) => entry.tracker === rule.tracker)
          ? requestedRules.map((entry) => (entry.tracker === rule.tracker ? rule : entry))
          : [...requestedRules, rule];
        const state: RuleState = { url: this.transport.url, revision: rule.revision, excluded };
        const remaining = states.filter((entry) =>
          requestedRules.some((r) => r.revision === entry.revision)
        );
        // State must be durable before enabling; a failed write must never enroll existing torrents.
        await storageSet({ [STATE_KEY]: [...remaining, state] });
        if (!this.isCurrent(requestedRules, version)) {
          throw new Error(getMessage('seedTimeLimitChanged'));
        }
        await this.persistRules(rules);
        return rule;
      }, 'writes');
    });
  }

  check(): Promise<'checked' | 'skipped'> {
    return this.exclusive(async () => {
      const rules = this.getConfig().seedTimeLimits;
      const active = rules.filter((rule) => rule.enabled);
      const version = this.version;
      if (!active.length) return 'checked';
      if (!this.isCurrent(rules, version)) return 'skipped';
      if (Date.now() < this.nextCheck) return 'skipped';
      this.nextCheck = Date.now() + CHECK_INTERVAL;
      active.forEach((rule) => this.validate(rule));
      const states = await this.readStates();
      if (!this.isCurrent(rules, version)) return 'skipped';
      const missing: string[] = [];
      const bindings: { rule: SeedTimeLimitRule; state: RuleState }[] = [];
      for (const rule of active) {
        const matching = states.filter(
          (state) => state.revision === rule.revision && state.url === this.transport.url
        );
        const state = matching.length === 1 ? matching[0] : undefined;
        if (!rule.revision || !state) {
          missing.push(rule.tracker);
          continue;
        }
        bindings.push({ rule, state });
      }
      const reactivationError = () =>
        new Error(`${getMessage('seedTimeLimitReactivate')}: ${missing.join(', ')}`);
      if (!bindings.length) throw reactivationError();
      const torrents = await this.census();
      const hashes = new Set<string>();
      for (const { rule, state } of bindings) {
        this.eligible(torrents, rule, state.excluded).forEach((hash) => hashes.add(hash));
      }
      if (!this.isCurrent(rules, version)) return 'skipped';
      if (hashes.size) {
        // Hashes, not session-local numeric IDs: a daemon restart must not stop another torrent.
        await this.transport.sendAction({
          method: 'torrent-stop',
          arguments: { ids: Array.from(hashes) },
        });
      }
      if (missing.length) throw reactivationError();
      return 'checked';
    });
  }
}
