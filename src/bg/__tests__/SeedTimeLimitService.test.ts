import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SeedTimeLimitService from '../SeedTimeLimitService';
import type TransmissionTransport from '../TransmissionTransport';
import type { SeedTimeLimitInput, SeedTimeLimitRule } from '../../types/seedTimeLimit';

const host = 'tracker.example.org';
const hash = (letter: string) => letter.repeat(40);
const input: SeedTimeLimitInput = {
  enabled: true,
  tracker: host,
  hours: 48,
  includeExisting: false,
};
const torrent = (letter = 'a', overrides: Record<string, unknown> = {}) => ({
  hashString: hash(letter),
  status: 6,
  secondsSeeding: 172800,
  percentDone: 1,
  trackers: [{ announce: `https://${host}/private-passkey/announce` }],
  ...overrides,
});
const response = (torrents: Record<string, unknown>[]) => ({
  result: 'success',
  arguments: { torrents },
});

let storage: Record<string, unknown>;
let now: number;

beforeEach(() => {
  vi.clearAllMocks();
  storage = {};
  now = 100000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  vi.mocked(chrome.storage.local.get).mockImplementation((_query, cb) => cb?.({ ...storage }));
  vi.mocked(chrome.storage.local.set).mockImplementation((data, cb) => {
    Object.assign(storage, data);
    cb?.();
  });
});
afterEach(() => vi.restoreAllMocks());

function setup() {
  const config = {
    url: 'http://nas.local:9091/transmission/rpc',
    seedTimeLimits: [] as SeedTimeLimitRule[],
    setKeyValue: vi.fn((options: Record<string, unknown>) => {
      Object.assign(config, options);
    }),
  };
  const sendAction = vi.fn();
  const transport = { url: config.url, sendAction } as unknown as TransmissionTransport;
  return {
    config,
    sendAction,
    transport,
    service: new SeedTimeLimitService(transport, () => config),
  };
}

describe('SeedTimeLimitService', () => {
  it('does no RPC or storage work while disabled', async () => {
    const { service, sendAction } = setup();
    await service.check();
    expect(sendAction).not.toHaveBeenCalled();
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });

  it('fetches unique hostnames on demand without returning passkeys', async () => {
    const { service, sendAction } = setup();
    sendAction.mockResolvedValue(
      response([
        torrent(),
        torrent('b', { trackers: [{ announce: `udp://${host}:80/announce` }] }),
        torrent('c', { trackers: [{ announce: 'https://other.example.org/secret' }] }),
      ])
    );
    await expect(service.getTrackers()).resolves.toEqual(['other.example.org', host]);
    expect(sendAction).toHaveBeenCalledWith({
      method: 'torrent-get',
      arguments: { fields: ['trackers'] },
    });
  });

  it('excludes existing hashes across worker restarts and stops new torrents at exactly 48 hours', async () => {
    const { config, service, transport, sendAction } = setup();
    sendAction.mockResolvedValueOnce(response([torrent()]));
    await service.save(input);
    const restarted = new SeedTimeLimitService(transport, () => config);
    sendAction.mockResolvedValueOnce(
      response([torrent(), torrent('b', { secondsSeeding: 172799 })])
    );
    await restarted.check();
    expect(sendAction).toHaveBeenCalledTimes(2);
    await restarted.check();
    expect(sendAction).toHaveBeenCalledTimes(2);

    now += 60000;
    sendAction
      .mockResolvedValueOnce(response([torrent(), torrent('b')]))
      .mockResolvedValueOnce({ result: 'success', arguments: {} });
    await restarted.check();
    expect(sendAction).toHaveBeenLastCalledWith({
      method: 'torrent-stop',
      arguments: { ids: [hash('b')] },
    });
  });

  it('includes existing torrents only on opt-in and skips other trackers, partial and non-seeding torrents', async () => {
    const { service, sendAction } = setup();
    const torrents = [
      torrent(),
      torrent('b', { secondsSeeding: 172799 }),
      torrent('c', { status: 0 }),
      torrent('d', { status: 4 }),
      torrent('e', { percentDone: 0.9 }),
      torrent('f', { trackers: [{ announce: 'https://another.example/announce' }] }),
      torrent('1', {
        trackers: [...torrent().trackers, { announce: 'https://another.example/announce' }],
      }),
      torrent('2', { trackers: [{ announce: 'not a URL' }] }),
      torrent('3', { trackers: [] }),
      torrent('4', { status: 5 }),
    ];
    sendAction.mockResolvedValue(response(torrents));
    await service.save({ ...input, includeExisting: true });
    await expect(service.preview({ ...input, includeExisting: true })).resolves.toBe(2);
    await service.check();
    expect(sendAction).toHaveBeenLastCalledWith({
      method: 'torrent-stop',
      arguments: { ids: [hash('a'), hash('4')] },
    });
    expect(
      sendAction.mock.calls.every(
        ([call]) => call.method === 'torrent-get' || call.method === 'torrent-stop'
      )
    ).toBe(true);
  });

  it('preserves the original exclusion snapshot when the active hour limit is edited', async () => {
    const { service, sendAction } = setup();
    sendAction.mockResolvedValueOnce(response([torrent()]));
    await service.save(input);
    sendAction.mockResolvedValueOnce(response([torrent(), torrent('b')]));
    await service.save({ ...input, hours: 24 });
    sendAction
      .mockResolvedValueOnce(response([torrent(), torrent('b')]))
      .mockResolvedValueOnce({ result: 'success', arguments: {} });
    await service.check();
    expect(sendAction).toHaveBeenLastCalledWith({
      method: 'torrent-stop',
      arguments: { ids: [hash('b')] },
    });
  });

  it.each(['missing', 'other-server'])('fails closed with %s activation state', async (kind) => {
    const { config, service, sendAction } = setup();
    sendAction.mockResolvedValueOnce(response([torrent()]));
    await service.save({ ...input, includeExisting: true });
    if (kind === 'missing') storage = {};
    else config.url = 'http://other-nas:9091/transmission/rpc';
    sendAction.mockClear();
    const matchingTransport = { url: config.url, sendAction } as unknown as TransmissionTransport;
    const restarted = new SeedTimeLimitService(matchingTransport, () => config);
    await expect(restarted.check()).rejects.toThrow('seedTimeLimitReactivate');
    expect(sendAction).not.toHaveBeenCalled();
  });

  it('does not arm a rule when persisting its exclusion snapshot fails', async () => {
    const { config, service, sendAction } = setup();
    sendAction.mockResolvedValueOnce(response([torrent()]));
    vi.mocked(chrome.storage.local.set).mockImplementation((_data, cb) => {
      const runtime = chrome.runtime as { lastError: chrome.runtime.LastError | null };
      runtime.lastError = { message: 'storage full' };
      cb?.();
      runtime.lastError = null;
    });
    await expect(service.save(input)).rejects.toEqual({ message: 'storage full' });
    expect(config.seedTimeLimits).toEqual([]);
    expect(config.setKeyValue).not.toHaveBeenCalled();
  });

  it('does not enable the in-memory rule when its settings write fails after the snapshot', async () => {
    const { config, service, sendAction } = setup();
    sendAction.mockResolvedValueOnce(response([torrent()]));
    vi.mocked(chrome.storage.local.set).mockImplementation((data, cb) => {
      const runtime = chrome.runtime as { lastError: chrome.runtime.LastError | null };
      if ('seedTimeLimits' in data) runtime.lastError = { message: 'settings write failed' };
      else Object.assign(storage, data);
      cb?.();
      runtime.lastError = null;
    });
    await expect(service.save(input)).rejects.toEqual({ message: 'settings write failed' });
    expect(config.seedTimeLimits).toEqual([]);
    expect(config.setKeyValue).not.toHaveBeenCalled();
  });

  it('allows disabling during an in-flight census and never stops from that stale response', async () => {
    const { service, sendAction, config } = setup();
    sendAction.mockResolvedValueOnce(response([torrent()]));
    await service.save({ ...input, includeExisting: true });
    let release!: (value: ReturnType<typeof response>) => void;
    sendAction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const check = service.check();
    await vi.waitFor(() => expect(sendAction).toHaveBeenCalledTimes(2));
    await service.save({ ...input, enabled: false, includeExisting: true });
    release(response([torrent()]));
    await check;
    expect(config.seedTimeLimits).toEqual([]);
    expect(sendAction).toHaveBeenCalledTimes(2);
  });

  it('cancels a queued activation if the user disables the rule while it waits', async () => {
    const { service, sendAction, config } = setup();
    let release!: (value: ReturnType<typeof response>) => void;
    sendAction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const preview = service.preview(input).catch((err: Error) => err.message);
    await vi.waitFor(() => expect(sendAction).toHaveBeenCalledTimes(1));
    const activation = service.save(input).catch((err: Error) => err.message);
    await service.save({ ...input, enabled: false });
    release(response([torrent()]));
    await expect(preview).resolves.toBe('seedTimeLimitChanged');
    await expect(activation).resolves.toBe('seedTimeLimitChanged');
    expect(config.seedTimeLimits).toEqual([]);
    expect(sendAction).toHaveBeenCalledTimes(1);
  });

  it.each([0, NaN, 1.5])('rejects unsafe hour limits (%s) before RPC', async (hours) => {
    const { service, sendAction } = setup();
    await expect(service.save({ ...input, hours })).rejects.toThrow('seedTimeLimitInvalid');
    expect(sendAction).not.toHaveBeenCalled();
  });

  it('surfaces RPC failures and malformed counters without sending a stop', async () => {
    const { service, sendAction } = setup();
    sendAction.mockResolvedValueOnce(response([torrent()]));
    await service.save({ ...input, includeExisting: true });
    sendAction.mockRejectedValueOnce(new Error('HTTP 401'));
    await expect(service.check()).rejects.toThrow('HTTP 401');
    now += 60000;
    sendAction.mockResolvedValueOnce(response([torrent('a', { secondsSeeding: '172800' })]));
    await expect(service.check()).rejects.toThrow('Invalid seed-time torrent response');
    expect(sendAction.mock.calls.some(([call]) => call.method === 'torrent-stop')).toBe(false);
  });

  it('keeps independent thresholds and snapshots, edits only one rule, and shares one census', async () => {
    const { service, config, sendAction } = setup();
    const otherHost = 'second.example.org';
    const other = (letter: string, seconds = 259200) =>
      torrent(letter, {
        secondsSeeding: seconds,
        trackers: [{ announce: `https://${otherHost}/announce` }],
      });
    sendAction.mockResolvedValue(response([torrent(), other('b')]));
    await service.save(input);
    const second = await service.save({
      ...input,
      tracker: otherHost,
      hours: 72,
      includeExisting: true,
    });
    await service.save({ ...input, hours: 24 });
    expect(config.seedTimeLimits).toEqual([
      expect.objectContaining({ tracker: host, hours: 24 }),
      second,
    ]);

    sendAction.mockClear();
    sendAction.mockResolvedValue(
      response([
        torrent(),
        other('b'),
        torrent('c', { secondsSeeding: 86400 }),
        other('d', 259199),
        other('e'),
        torrent('f', { trackers: [...torrent().trackers, ...other('f').trackers] }),
      ])
    );
    await service.check();
    expect(sendAction).toHaveBeenCalledTimes(2);
    expect(sendAction).toHaveBeenLastCalledWith({
      method: 'torrent-stop',
      arguments: { ids: [hash('c'), hash('b'), hash('e')] },
    });
  });

  it('deletes only the selected rule, retains the other baseline, and persists the empty list', async () => {
    const { service, config, sendAction } = setup();
    const otherHost = 'second.example.org';
    const secondTorrent = torrent('b', {
      trackers: [{ announce: `https://${otherHost}/announce` }],
    });
    sendAction.mockResolvedValue(response([torrent(), secondTorrent]));
    await service.save({ ...input, includeExisting: true });
    const second = await service.save({ ...input, tracker: otherHost });
    sendAction.mockClear();
    await service.remove(host);
    expect(config.seedTimeLimits).toEqual([second]);
    expect(sendAction).not.toHaveBeenCalled();
    sendAction.mockResolvedValue(
      response([torrent(), secondTorrent, torrent('c', { trackers: secondTorrent.trackers })])
    );
    await service.check();
    expect(sendAction).toHaveBeenLastCalledWith({
      method: 'torrent-stop',
      arguments: { ids: [hash('c')] },
    });
    await service.remove(otherHost);
    sendAction.mockClear();
    await service.check();
    expect(sendAction).not.toHaveBeenCalled();
    expect(config.seedTimeLimits).toEqual([]);
    expect(storage.seedTimeLimits).toEqual([]);
  });

  it('serializes rapid deletions without restoring a previously removed rule', async () => {
    const { service, config, sendAction } = setup();
    const otherHost = 'second.example.org';
    sendAction.mockResolvedValue(
      response([
        torrent(),
        torrent('b', { trackers: [{ announce: `https://${otherHost}/announce` }] }),
      ])
    );
    await service.save(input);
    await service.save({ ...input, tracker: otherHost });
    sendAction.mockClear();
    await Promise.all([service.remove(host), service.remove(otherHost)]);
    expect(config.seedTimeLimits).toEqual([]);
    expect(storage.seedTimeLimits).toEqual([]);
    expect(sendAction).not.toHaveBeenCalled();
  });

  it('does not start a fresh enforcement check while a deletion write is still pending', async () => {
    const { service, sendAction } = setup();
    sendAction.mockResolvedValue(response([torrent()]));
    await service.save({ ...input, includeExisting: true });
    let finish: (() => void) | undefined;
    vi.mocked(chrome.storage.local.set).mockImplementationOnce((data, cb) => {
      finish = () => {
        Object.assign(storage, data);
        cb?.();
      };
    });
    sendAction.mockClear();
    const removal = service.remove(host);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    await expect(service.check()).resolves.toBe('skipped');
    expect(sendAction).not.toHaveBeenCalled();
    if (!finish) throw new Error('Deletion did not reach storage');
    finish();
    await removal;
  });

  it('continues healthy rules while reporting a different rule with missing activation', async () => {
    const { service, config, sendAction } = setup();
    sendAction.mockResolvedValue(response([torrent()]));
    await service.save({ ...input, includeExisting: true });
    config.seedTimeLimits.push({ ...input, tracker: 'missing.example.org', revision: 'missing' });
    await expect(service.check()).rejects.toThrow('missing.example.org');
    expect(sendAction).toHaveBeenLastCalledWith({
      method: 'torrent-stop',
      arguments: { ids: [hash('a')] },
    });
  });

  it('accepts the legacy activation object and keeps its existing exclusions', async () => {
    const { service, config, sendAction } = setup();
    config.seedTimeLimits = [{ ...input, revision: 'legacy' }];
    storage._seedTimeLimitState = { url: config.url, revision: 'legacy', excluded: [hash('a')] };
    sendAction.mockResolvedValue(response([torrent(), torrent('b')]));
    await service.check();
    expect(sendAction).toHaveBeenLastCalledWith({
      method: 'torrent-stop',
      arguments: { ids: [hash('b')] },
    });
  });

  it('keeps the previous activation usable if saving an edited rule fails', async () => {
    const { service, config, transport, sendAction } = setup();
    sendAction.mockResolvedValue(response([torrent()]));
    const original = await service.save(input);
    vi.mocked(chrome.storage.local.set).mockImplementation((data, cb) => {
      const runtime = chrome.runtime as { lastError: chrome.runtime.LastError | null };
      if ('seedTimeLimits' in data) runtime.lastError = { message: 'settings write failed' };
      else Object.assign(storage, data);
      cb?.();
      runtime.lastError = null;
    });
    await expect(service.save({ ...input, hours: 24 })).rejects.toEqual({
      message: 'settings write failed',
    });
    expect(config.seedTimeLimits).toEqual([original]);
    sendAction.mockResolvedValue(response([torrent(), torrent('b')]));
    await new SeedTimeLimitService(transport, () => config).check();
    expect(sendAction).toHaveBeenLastCalledWith({
      method: 'torrent-stop',
      arguments: { ids: [hash('b')] },
    });
  });
});
