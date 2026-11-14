import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroy } from 'mobx-state-tree';
import Footer from '../Footer';
import LabelSelect from '../LabelSelect';
import RootStore from '../../stores/RootStore';
import RootStoreCtx from '../../tools/rootStoreCtx';
import callApi from '../../tools/callApi';

vi.unmock('../../tools/i18n');
vi.mock('../../tools/callApi', () => ({ default: vi.fn() }));
let root: ReturnType<typeof RootStore.create> | undefined;
afterEach(() => {
  cleanup();
  if (root) destroy(root);
  root = undefined;
  vi.useRealTimers();
  vi.clearAllMocks();
});
function torrent(id: number, statusCode: number, name: string) {
  return {
    id,
    statusCode,
    name,
    errorCode: 0,
    errorString: '',
    size: 1000,
    percentDone: 1,
    isFinished: statusCode === 0,
    recheckProgress: 0,
    downloaded: 500,
    uploaded: 100,
    shared: 200,
    uploadSpeed: 0,
    downloadSpeed: 0,
    eta: -1,
    activePeers: 0,
    peers: 0,
    activeSeeds: 0,
    seeds: 0,
    addedTime: 1700000000,
    completedTime: 1700001000,
  };
}
function setup(session = true) {
  const items = [
    torrent(1, 6, 'active-one'),
    torrent(2, 4, 'active-two'),
    ...['Zulu', 'Echo', 'Delta', 'Charlie', 'Bravo', 'Alpha', 'Foxtrot'].map((name, i) =>
      torrent(i + 3, 0, name)
    ),
  ];
  root = RootStore.create({
    config: {
      hostname: 'nas.local',
      language: 'en',
      showFreeSpace: false,
      hideFinishedTorrents: true,
      searchQuery: 'active',
    },
    client: {
      torrents: Object.fromEntries(items.map((t) => [String(t.id), t])),
      settings: {
        downloadSpeedLimit: 100,
        downloadSpeedLimitEnabled: true,
        uploadSpeedLimit: 50,
        uploadSpeedLimitEnabled: true,
        altSpeedEnabled: false,
        altDownloadSpeedLimit: 10,
        altUploadSpeedLimit: 10,
        downloadDir: '/data',
        ...(session
          ? {
              sessionDownloaded: 1000000000,
              sessionUploaded: 2000000000,
              sessionStartedAt: 1700000000000,
            }
          : {}),
      },
    },
  });
  return render(
    <RootStoreCtx.Provider value={root}>
      <ul>
        <LabelSelect />
      </ul>
      <Footer />
    </RootStoreCtx.Provider>
  );
}

describe('footer details', () => {
  it('previews five paused names and selects the actual paused state, not idle seeders', () => {
    const view = setup();
    const paused = screen.getByRole('button', { name: '7 paused' });
    const title = paused.getAttribute('title') ?? '';
    expect(title).toContain('Alpha\nBravo\nCharlie\nDelta\nEcho');
    expect(title).not.toContain('Foxtrot');
    expect(title).not.toContain('Zulu');
    expect(title).toContain('2 more');
    fireEvent.click(paused);
    expect(root?.config?.selectedLabel.label).toBe('PAUSED');
    expect(root?.config?.searchQuery).toBe('');
    expect(view.container.querySelector('.rc-select-selection-item')).toHaveTextContent('Paused');
    expect(root?.torrentList.filteredTorrents).toHaveLength(7);
    expect(root?.torrentList.filteredTorrents.every((t) => t.statusCode === 0)).toBe(true);
  });

  it('shows session dates separately and explains the existing speed menus', () => {
    const view = setup();
    expect(view.container.querySelector('.total-dl')).toHaveTextContent('1 GB');
    expect(view.container.querySelector('.total-up')).toHaveTextContent('2 GB');
    expect(view.container.querySelector('.total-dl')?.getAttribute('title')).toContain(
      new Date(1700000000000).toLocaleString('en-US')
    );
    expect(view.container.querySelector('.total-up')?.getAttribute('title')).toContain(
      'Cannot be reset separately'
    );
    expect(view.container.querySelector('.speed.download')?.getAttribute('title')).toContain(
      'Right-click'
    );
    expect(view.container.querySelector('.limit.up')?.getAttribute('title')).toContain(
      'disable the limit'
    );
  });

  it('does not present torrent lifetime totals as a dated session when statistics are unavailable', () => {
    const view = setup(false);
    expect(view.container.querySelector('.total-dl')).toHaveTextContent('-');
    expect(view.container.querySelector('.total-dl')?.getAttribute('title')).toContain(
      'Session counter unavailable'
    );
  });

  it('fetches tracker hosts only after hovering and reuses a successful request', async () => {
    vi.useFakeTimers();
    vi.mocked(callApi).mockResolvedValue({
      hosts: [{ host: 'tracker.example', count: 2 }],
      withoutTracker: 0,
    });
    const view = setup();
    const target = view.container.querySelector<HTMLElement>('.footer-active');
    if (!target) throw new Error('Missing active counter');
    expect(callApi).not.toHaveBeenCalled();
    fireEvent.mouseEnter(target);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    fireEvent.mouseLeave(target);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(callApi).not.toHaveBeenCalled();
    fireEvent.mouseEnter(target);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('tracker.example: 2');
    expect(callApi).toHaveBeenCalledWith({
      action: 'getActiveTrackerHosts',
      serverUrl: 'http://nas.local:9091/transmission/rpc',
    });
    fireEvent.mouseLeave(target);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    fireEvent.mouseEnter(target);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(callApi).toHaveBeenCalledTimes(1);
  });
});
