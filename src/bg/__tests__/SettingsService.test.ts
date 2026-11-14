import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsService, { type NormalizedSettings } from '../SettingsService';
import type TransmissionTransport from '../TransmissionTransport';

function createService(rpcVersion = 0) {
  const sendAction = vi.fn();
  const transport = {
    sendAction,
    rpcVersion,
    url: 'http://nas.local/transmission/rpc',
  } as unknown as TransmissionTransport;
  const applySettings = vi.fn();
  const service = new SettingsService(transport, applySettings);
  return { service, sendAction, transport, applySettings };
}

const LEGACY_SESSION = {
  'rpc-version': 15,
  version: '2.94',
  'speed-limit-down': 100,
  'speed-limit-down-enabled': true,
  'speed-limit-up': 50,
  'alt-speed-enabled': false,
  'download-dir': '/downloads',
  'peer-port': 51413,
  encryption: 'preferred',
  seedRatioLimit: 2,
  seedRatioLimited: true,
};

describe('SettingsService.getFreeSpace', () => {
  it('summarizes only running torrents and returns hostnames without credentials or passkeys', async () => {
    const { service, sendAction } = createService();
    const announce = 'https://user:password@tracker.example/announce?passkey=secret';
    sendAction.mockResolvedValue({
      arguments: {
        torrents: [
          { status: 0, trackers: [{ announce: 'https://paused.example/announce' }] },
          { status: 6, trackers: [{ announce }, { announce }] },
          { status: 4, trackers: [{ announce }] },
          { status: 5, trackers: [] },
        ],
      },
    });
    await expect(
      service.getActiveTrackerHosts('http://nas.local/transmission/rpc')
    ).resolves.toEqual({
      hosts: [{ host: 'tracker.example', count: 2 }],
      withoutTracker: 1,
    });
    expect(sendAction).toHaveBeenCalledWith({
      method: 'torrent-get',
      arguments: { fields: ['status', 'trackers'] },
    });
  });

  it('rejects tracker requests for another connection and malformed torrent states', async () => {
    const { service, sendAction } = createService();
    await expect(service.getActiveTrackerHosts('http://other/rpc')).rejects.toThrow(
      'connectionChanged'
    );
    expect(sendAction).not.toHaveBeenCalled();
    sendAction.mockResolvedValue({ arguments: { torrents: [{ status: '6' }] } });
    await expect(
      service.getActiveTrackerHosts('http://nas.local/transmission/rpc')
    ).rejects.toThrow('activeTrackersInvalid');
  });

  it('derives the session start from daemon uptime, never from extension startup', async () => {
    const { service, sendAction } = createService();
    const now = 1700000000000;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      sendAction.mockResolvedValue({
        arguments: { 'current-stats': { secondsActive: 3600, downloadedBytes: 123 } },
      });
      expect((await service.getSessionStats()).sessionStartedAt).toBe(now - 3600000);
      sendAction.mockResolvedValue({ arguments: { 'current-stats': { downloadedBytes: 123 } } });
      expect((await service.getSessionStats()).sessionStartedAt).toBeUndefined();
    } finally {
      clock.mockRestore();
    }
  });
  it.each(['size-bytes', 'size_bytes'])(
    'queries the requested Docker path and accepts a real zero (%s)',
    async (key) => {
      const { service, sendAction } = createService();
      sendAction.mockResolvedValue({ arguments: { path: '/media/series', [key]: 0 } });
      await expect(service.getFreeSpace('/media/series')).resolves.toEqual({
        path: '/media/series',
        sizeBytes: 0,
        totalSize: undefined,
      });
      expect(sendAction).toHaveBeenCalledWith({
        method: 'free-space',
        arguments: { path: '/media/series' },
      });
    }
  );

  it.each([-1, NaN, '100', undefined])(
    'rejects invalid or unknown free space (%s)',
    async (value) => {
      const { service, sendAction } = createService();
      sendAction.mockResolvedValue({ arguments: { path: '/media/series', 'size-bytes': value } });
      await expect(service.getFreeSpace('/media/series')).rejects.toThrow(
        'invalidFreeSpaceResponse'
      );
    }
  );

  it('rejects a stale connection without sending a request to the wrong server', async () => {
    const { service, sendAction } = createService();
    await expect(service.getFreeSpace('/media/series', 'http://other.local/rpc')).rejects.toThrow(
      'freeSpaceConnectionChanged'
    );
    expect(sendAction).not.toHaveBeenCalled();
  });
});

const MODERN_SESSION = {
  rpc_version: 18,
  rpc_version_semver: '6.0.0',
  version: '4.1.0',
  speed_limit_down: 100,
  speed_limit_down_enabled: true,
  speed_limit_up: 50,
  alt_speed_enabled: false,
  download_dir: '/downloads',
  peer_port: 51413,
  encryption: 'preferred',
  seed_ratio_limit: 2,
  seed_ratio_limited: true,
};

describe('SettingsService.updateSettings', () => {
  it('normalizes a legacy (2.94, kebab/camel) session and captures rpc-version', async () => {
    const { service, sendAction, transport, applySettings } = createService();
    sendAction.mockResolvedValue({ result: 'success', arguments: LEGACY_SESSION });

    await service.updateSettings();

    expect(transport.rpcVersion).toBe(15);
    const normalized = applySettings.mock.calls[0][0] as NormalizedSettings;
    expect(normalized.rpcVersion).toBe(15);
    expect(normalized.version).toBe('2.94');
    expect(normalized.rpcVersionSemver).toBeUndefined();
    expect(normalized.downloadSpeedLimit).toBe(100);
    expect(normalized.downloadSpeedLimitEnabled).toBe(true);
    expect(normalized.downloadDir).toBe('/downloads');
    expect(normalized.seedRatioLimit).toBe(2);
    expect(normalized.seedRatioLimited).toBe(true);
    expect(normalized.scriptTorrentAddedEnabled).toBeUndefined();
  });

  it('normalizes a 4.1 (snake_case) session to the same shape', async () => {
    const { service, sendAction, transport, applySettings } = createService();
    sendAction.mockResolvedValue({ result: 'success', arguments: MODERN_SESSION });

    await service.updateSettings();

    expect(transport.rpcVersion).toBe(18);
    const normalized = applySettings.mock.calls[0][0] as NormalizedSettings;
    expect(normalized.rpcVersion).toBe(18);
    expect(normalized.version).toBe('4.1.0');
    expect(normalized.rpcVersionSemver).toBe('6.0.0');
    expect(normalized.downloadSpeedLimit).toBe(100);
    expect(normalized.downloadDir).toBe('/downloads');
    expect(normalized.seedRatioLimit).toBe(2);
  });
});

describe('SettingsService.getDownloadDirectories', () => {
  it('lists the container default first and deduplicates all torrent destinations', async () => {
    const { service, sendAction } = createService(17);
    sendAction
      .mockResolvedValueOnce({ arguments: { 'download-dir': '/downloads/' } })
      .mockResolvedValueOnce({
        arguments: {
          torrents: [
            { downloadDir: '/downloads/Films/' },
            { downloadDir: '/downloads' },
            { downloadDir: '/downloads/Films' },
            { downloadDir: '/archive' },
            { downloadDir: '/' },
          ],
        },
      });

    await expect(service.getDownloadDirectories()).resolves.toEqual({
      defaultDirectory: '/downloads',
      directories: ['/downloads', '/', '/archive', '/downloads/Films'],
    });
    expect(sendAction.mock.calls).toEqual([
      [{ method: 'session-get', arguments: { fields: ['download-dir'] } }],
      [{ method: 'torrent-get', arguments: { fields: ['downloadDir'] } }],
    ]);
  });

  it('accepts snake_case responses', async () => {
    const { service, sendAction } = createService(18);
    sendAction
      .mockResolvedValueOnce({ arguments: { download_dir: '/downloads' } })
      .mockResolvedValueOnce({ arguments: { torrents: [{ download_dir: '/media' }] } });

    await expect(service.getDownloadDirectories()).resolves.toEqual({
      defaultDirectory: '/downloads',
      directories: ['/downloads', '/media'],
    });
  });

  it('offers the default even when no torrents have been added', async () => {
    const { service, sendAction } = createService(17);
    sendAction
      .mockResolvedValueOnce({ arguments: { 'download-dir': '/downloads' } })
      .mockResolvedValueOnce({ arguments: { torrents: [] } });
    await expect(service.getDownloadDirectories()).resolves.toEqual({
      defaultDirectory: '/downloads',
      directories: ['/downloads'],
    });
  });

  it('propagates RPC failures instead of returning a partial directory list', async () => {
    const { service, sendAction } = createService(17);
    sendAction
      .mockResolvedValueOnce({ arguments: { 'download-dir': '/downloads' } })
      .mockRejectedValueOnce(new Error('HTTP 401'));
    await expect(service.getDownloadDirectories()).rejects.toThrow('HTTP 401');
  });

  it('rejects malformed torrent directory data', async () => {
    const { service, sendAction } = createService(17);
    sendAction
      .mockResolvedValueOnce({ arguments: { 'download-dir': '/downloads' } })
      .mockResolvedValueOnce({ arguments: { torrents: [{}] } });
    await expect(service.getDownloadDirectories()).rejects.toThrow(
      'Missing torrent download directory'
    );
  });
});

describe('SettingsService version gating', () => {
  it('rejects 4.x-only calls when the daemon is known to be too old', async () => {
    const { service, sendAction } = createService(15);
    await expect(service.setDefaultTrackers('udp://a')).rejects.toMatchObject({
      code: 'UNSUPPORTED_RPC_VERSION',
    });
    await expect(service.getGroups()).rejects.toMatchObject({ code: 'UNSUPPORTED_RPC_VERSION' });
    await expect(service.setScriptTorrentAddedEnabled(true)).rejects.toMatchObject({
      code: 'UNSUPPORTED_RPC_VERSION',
    });
    expect(sendAction).not.toHaveBeenCalled();
  });

  it('sends 4.x calls when the daemon supports them', async () => {
    const { service, sendAction } = createService(17);
    sendAction.mockResolvedValue({ result: 'success', arguments: { group: [] } });
    await service.getGroups();
    expect(sendAction).toHaveBeenCalledWith({ method: 'group-get', arguments: {} });
  });

  it('passes through when the version is not known yet (backstop only)', async () => {
    const { service, sendAction } = createService(0);
    sendAction.mockResolvedValue({ result: 'success', arguments: {} });
    await expect(service.setDefaultTrackers('udp://a')).resolves.toBeUndefined();
  });
});

describe('SettingsService.portTest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends no arguments on old daemons', async () => {
    const { service, sendAction } = createService(16);
    sendAction.mockResolvedValue({ result: 'success', arguments: { 'port-is-open': true } });
    await expect(service.portTest()).resolves.toBe(true);
    expect(sendAction).toHaveBeenCalledWith({ method: 'port-test' });
  });

  it('ignores ipProtocol below rpc 18', async () => {
    const { service, sendAction } = createService(17);
    sendAction.mockResolvedValue({ result: 'success', arguments: { 'port-is-open': false } });
    await expect(service.portTest('ipv6')).resolves.toBe(false);
    expect(sendAction).toHaveBeenCalledWith({ method: 'port-test' });
  });

  it('sends ip_protocol (snake_case, born in rpc 18) at rpc 18 and reads a snake_case response', async () => {
    const { service, sendAction } = createService(18);
    sendAction.mockResolvedValue({
      result: 'success',
      arguments: { port_is_open: true, ip_protocol: 'ipv6' },
    });
    await expect(service.portTest('ipv6')).resolves.toBe(true);
    expect(sendAction).toHaveBeenCalledWith({
      method: 'port-test',
      arguments: { ip_protocol: 'ipv6' },
    });
  });
});
