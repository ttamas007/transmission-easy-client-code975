import { describe, expect, it } from 'vitest';
import { getConnectionChanges, sanitizeRestoreConfig } from '../backupSanitize';
import { DEFAULT_SEED_TIME_LIMIT } from '../../types/seedTimeLimit';

describe('sanitizeRestoreConfig', () => {
  it('restores seed preferences disabled, never its active revision or local exclusion state', () => {
    const { config, droppedKeys } = sanitizeRestoreConfig({
      seedTimeLimit: {
        ...DEFAULT_SEED_TIME_LIMIT,
        enabled: true,
        includeExisting: true,
        tracker: 'tracker.example.org',
        revision: 'previous-activation',
      },
      _seedTimeLimitState: { excluded: ['hash'] },
    });
    expect(config.seedTimeLimits).toEqual([
      expect.objectContaining({
        enabled: false,
        includeExisting: false,
        tracker: 'tracker.example.org',
        revision: '',
      }),
    ]);
    expect(config).not.toHaveProperty('seedTimeLimit');
    expect(droppedKeys).toEqual(['_seedTimeLimitState']);
  });

  it('restores every tracker disabled and gives the plural list precedence over the legacy key', () => {
    const rule = {
      ...DEFAULT_SEED_TIME_LIMIT,
      enabled: true,
      includeExisting: true,
      tracker: 'first.example.org',
      revision: 'old',
    };
    const { config } = sanitizeRestoreConfig({
      seedTimeLimit: rule,
      seedTimeLimits: [rule, { ...rule, tracker: 'second.example.org', hours: 72 }],
    });
    expect(config.seedTimeLimits).toEqual([
      { ...rule, enabled: false, includeExisting: false, revision: '' },
      {
        ...rule,
        tracker: 'second.example.org',
        hours: 72,
        enabled: false,
        includeExisting: false,
        revision: '',
      },
    ]);
    expect(
      sanitizeRestoreConfig({ seedTimeLimit: rule, seedTimeLimits: [] }).config.seedTimeLimits
    ).toEqual([]);
    expect(sanitizeRestoreConfig({ seedTimeLimits: [rule, rule] }).droppedKeys).toEqual([
      'seedTimeLimits',
    ]);
  });

  it('keeps known config keys, including credentials (cloud backup is intentional)', () => {
    const { config, droppedKeys } = sanitizeRestoreConfig({
      hostname: 'nas.local',
      port: 9091,
      ssl: true,
      login: 'admin',
      password: 'secret',
      configVersion: 2,
    });
    expect(config).toEqual({
      hostname: 'nas.local',
      port: 9091,
      ssl: true,
      login: 'admin',
      password: 'secret',
      configVersion: 2,
    });
    expect(droppedKeys).toEqual([]);
  });

  it('drops unknown and transient keys', () => {
    const { config, droppedKeys } = sanitizeRestoreConfig({
      hostname: 'nas.local',
      _notifiedIds: [1, 2],
      evilKey: 'payload',
    });
    expect(config).toEqual({ hostname: 'nas.local' });
    expect(droppedKeys.sort()).toEqual(['_notifiedIds', 'evilKey']);
  });

  it('drops every underscore-prefixed background key, whatever its name', () => {
    // The bookkeeping key was renamed once and the exclusion list was not
    // updated, which pushed every torrent hash on the server into backups
    const { config, droppedKeys } = sanitizeRestoreConfig({
      hostname: 'nas.local',
      _notifiedState: { url: 'x', completed: ['a'], known: ['a'] },
      _someFutureCache: 'whatever',
    });
    expect(config).toEqual({ hostname: 'nas.local' });
    expect(droppedKeys.sort()).toEqual(['_notifiedState', '_someFutureCache']);
  });

  it('drops a nested backup blob (sync-area key must not enter local storage)', () => {
    const { config, droppedKeys } = sanitizeRestoreConfig({
      hostname: 'nas.local',
      backup: '{"huge":"nested blob"}',
    });
    expect(config).toEqual({ hostname: 'nas.local' });
    expect(droppedKeys).toEqual(['backup']);
  });
});

describe('getConnectionChanges', () => {
  it('lists connection keys that differ', () => {
    const changes = getConnectionChanges(
      { hostname: 'evil.example', port: 9091, ssl: false },
      { hostname: 'nas.local', port: 9091, ssl: true, pathname: '/transmission/rpc' }
    );
    expect(changes).toEqual(['hostname: nas.local → evil.example', 'ssl: true → false']);
  });

  it('ignores keys absent from the restored blob', () => {
    expect(getConnectionChanges({}, { hostname: 'nas.local', port: 9091 })).toEqual([]);
  });

  it('flags a widened Web UI path and a swapped login', () => {
    // webPathname decides where the Basic-auth header is injected, so a backup
    // broadening it must be confirmed like a host change
    const changes = getConnectionChanges(
      { webPathname: '/', login: 'attacker' },
      { webPathname: '/transmission/web/', login: 'admin' }
    );
    expect(changes).toEqual(['webPathname: /transmission/web/ → /', 'login: admin → attacker']);
  });
});
