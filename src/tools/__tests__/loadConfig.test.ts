import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import loadConfig from '../loadConfig';
import { DEFAULT_SEED_TIME_LIMIT } from '../../types/seedTimeLimit';

const legacy = {
  ...DEFAULT_SEED_TIME_LIMIT,
  enabled: true,
  tracker: 'tracker.example.org',
  revision: 'existing-activation',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(chrome.storage.local.set).mockImplementation((_data, cb) => cb?.());
});
afterEach(() => vi.restoreAllMocks());

describe('loadConfig seed rules migration', () => {
  it('loads the legacy key and preserves its activation revision in the new list', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation((_keys, cb) =>
      cb?.({ configVersion: 2, seedTimeLimit: legacy })
    );
    const config = await loadConfig(['configVersion', 'seedTimeLimits']);
    expect(chrome.storage.local.get).toHaveBeenCalledWith(
      ['configVersion', 'seedTimeLimits', 'seedTimeLimit'],
      expect.any(Function)
    );
    expect(config.seedTimeLimits).toEqual([legacy]);
    expect(config).not.toHaveProperty('seedTimeLimit');
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { seedTimeLimits: [legacy] },
      expect.any(Function)
    );
  });

  it('does not resurrect a removed last rule from the remaining legacy key', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation((_keys, cb) =>
      cb?.({ configVersion: 2, seedTimeLimit: legacy, seedTimeLimits: [] })
    );
    expect((await loadConfig(['seedTimeLimits'])).seedTimeLimits).toEqual([]);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('reports invalid legacy rules rather than activating them', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation((_keys, cb) =>
      cb?.({ configVersion: 2, seedTimeLimit: { ...legacy, hours: -1 } })
    );
    await expect(loadConfig(null)).rejects.toThrow('seedTimeLimitInvalid');
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});
