import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destroy } from 'mobx-state-tree';
import TransmissionClient from '../TransmissionClient';
import TorrentService from '../TorrentService';
import SettingsService from '../SettingsService';
import SeedTimeLimitService from '../SeedTimeLimitService';
import ConfigStore, { type IConfigStore } from '../../stores/ConfigStore';

vi.mock('../TransmissionTransport');
vi.mock('../TorrentService');
vi.mock('../SettingsService');
vi.mock('../SeedTimeLimitService');

const response = { result: 'success', arguments: { torrents: [] } };
let config: IConfigStore;

beforeEach(() => {
  vi.clearAllMocks();
  config = ConfigStore.create({});
  vi.mocked(SettingsService.prototype.updateSettings).mockResolvedValue(undefined);
  vi.mocked(TorrentService.prototype.updateTorrents).mockResolvedValue(response);
  vi.mocked(SeedTimeLimitService.prototype.check).mockResolvedValue('checked');
});
afterEach(() => destroy(config));

function setup() {
  const clientStore = {
    incompleteTorrentIds: [],
    downloadingCount: 0,
    torrentIds: [],
    removeTorrentByIds: vi.fn(),
    syncChanges: vi.fn(),
    sync: vi.fn(),
    torrents: new Map<number, { stateText: string }>(),
    currentSpeed: { downloadSpeed: 0, uploadSpeed: 0 },
    speedRoll: { add: vi.fn(), setData: vi.fn(), data: [] },
    setSettings: vi.fn(),
    lastErrorMessage: undefined as string | undefined,
    setLastErrorMessage: vi.fn((message: string | undefined) => {
      clientStore.lastErrorMessage = message;
    }),
  };
  const bg = {
    bgStore: { config, client: clientStore, flushClient: vi.fn() },
    daemon: { isActive: true, start: vi.fn() },
    torrentCompleteNotify: vi.fn(),
    torrentAddedNotify: vi.fn(),
    torrentIsExistsNotify: vi.fn(),
    torrentErrorNotify: vi.fn(),
  };
  return { client: new TransmissionClient(bg), bg, clientStore };
}

describe('TransmissionClient seed-time integration', () => {
  it('checks the rule after the same updateTorrents method used by the background alarm, without any UI', async () => {
    const { client } = setup();
    await expect(client.updateTorrents()).resolves.toEqual(response);
    expect(SeedTimeLimitService.prototype.check).toHaveBeenCalledOnce();
    expect(
      vi.mocked(SeedTimeLimitService.prototype.check).mock.invocationCallOrder[0]
    ).toBeGreaterThan(
      vi.mocked(TorrentService.prototype.updateTorrents).mock.invocationCallOrder[0]
    );
  });

  it('reports rule failures without breaking ordinary refresh and clears the error only after a real check', async () => {
    const { client, bg, clientStore } = setup();
    vi.mocked(SeedTimeLimitService.prototype.check)
      .mockRejectedValueOnce(new Error('HTTP 401'))
      .mockResolvedValueOnce('skipped')
      .mockResolvedValueOnce('checked');
    await expect(client.updateTorrents()).resolves.toEqual(response);
    expect(clientStore.lastErrorMessage).toBe('seedTimeLimit: HTTP 401');
    expect(bg.torrentErrorNotify).toHaveBeenCalledWith('seedTimeLimit: HTTP 401');
    await client.updateTorrents();
    expect(clientStore.lastErrorMessage).toBe('seedTimeLimit: HTTP 401');
    await client.updateTorrents();
    expect(clientStore.lastErrorMessage).toBeUndefined();
  });
});
