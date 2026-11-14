import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../i18n';
import translateTorrentError from '../torrentError';
import TorrentStore from '../../stores/TorrentStore';
import { applySnapshot, getSnapshot } from 'mobx-state-tree';

vi.unmock('../i18n');
afterEach(() => setLanguage('hu'));

describe('torrent error translations', () => {
  it('switches missing data, corrupt pieces and tracker errors with the UI language', () => {
    expect(translateTorrentError('No data found!')).toContain('Nem találhatók');
    expect(translateTorrentError('Corrupt piece: 42')).toContain('42');
    expect(translateTorrentError('Corrupt piece: 42')).toContain('sérült');
    expect(translateTorrentError('torrent not registered')).toContain('regisztrálva');
    setLanguage('en');
    expect(translateTorrentError('No data found!')).toContain('No data found');
    expect(translateTorrentError('Corrupt piece: 42')).toContain('Corrupt');
    expect(translateTorrentError('torrent not registered')).toContain('not registered');
  });

  it('preserves paths and OS codes while translating structured daemon errors', () => {
    expect(
      translateTorrentError(
        "Couldn't move '/data/Permission denied' to '/archive': No space left on device (28)"
      )
    ).toBe(
      "Nem sikerült áthelyezni: '/data/Permission denied' → '/archive': Nincs szabad hely a meghajtón (28)"
    );
    expect(
      translateTorrentError("Couldn't save '/data/test.torrent': Permission denied (13)")
    ).toContain("'/data/test.torrent': Hozzáférés megtagadva (13)");
    expect(translateTorrentError('No such file or directory (2)')).toBe(
      'Nincs ilyen fájl vagy mappa (2)'
    );
    expect(
      translateTorrentError("Couldn't save '/data/test': Custom server reason (99)")
    ).toContain('Custom server reason (99)');
  });

  it('does not reinterpret arbitrary tracker messages or hide unknown diagnostics', () => {
    const unknown = 'Torrent not found in /data/Corrupt piece: 42; contact tracker';
    expect(translateTorrentError(unknown)).toBe(unknown);
    expect(translateTorrentError('New server error: 987')).toBe('New server error: 987');
    expect(translateTorrentError('constructor')).toBe('constructor');
    expect(translateTorrentError('__proto__')).toBe('__proto__');
    expect(translateTorrentError('')).toBe('');
  });

  it('translates tracker HTTP and malformed-response diagnostics without losing details', () => {
    expect(translateTorrentError('Tracker HTTP response 403 (Forbidden)')).toBe(
      'A tracker HTTP-válasza: 403 (Hozzáférés tiltva)'
    );
    expect(translateTorrentError('Tracker HTTP response 599 (Custom proxy reason)')).toBe(
      'A tracker HTTP-válasza: 599 (Custom proxy reason)'
    );
    expect(translateTorrentError("Couldn't parse announce response: Invalid bencode (22)")).toBe(
      'A tracker announce válasza nem értelmezhető: Invalid bencode (22)'
    );
    setLanguage('en');
    expect(translateTorrentError('Tracker HTTP response 403 (Forbidden)')).toBe(
      'Tracker HTTP response 403 (Forbidden)'
    );
  });

  it('localizes store tooltips without changing stored diagnostics or warning severity', () => {
    const torrent = TorrentStore.create({
      id: 1,
      statusCode: 6,
      errorCode: 3,
      errorString: 'No space left on device',
      name: 'Test',
      size: 1,
      percentDone: 1,
      recheckProgress: 0,
      downloaded: 1,
      uploaded: 1,
      shared: 1,
      uploadSpeed: 0,
      downloadSpeed: 0,
      eta: -1,
      activePeers: 0,
      peers: 0,
      activeSeeds: 0,
      seeds: 0,
      addedTime: 0,
      completedTime: 0,
    });
    expect(torrent.stateTooltip).toContain('Nincs szabad hely');
    setLanguage('en');
    expect(torrent.errorMessage).toBe('Error: No space left on device');
    expect(torrent.errorString).toBe('No space left on device');
    applySnapshot(torrent, {
      ...getSnapshot(torrent),
      errorCode: 1,
      errorString: 'torrent not registered',
    });
    expect(torrent.hasError).toBe(false);
    expect(torrent.stateTooltip).toContain('not registered');
  });
});
