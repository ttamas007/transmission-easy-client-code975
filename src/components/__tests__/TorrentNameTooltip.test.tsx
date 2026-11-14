import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TorrentNameTooltip from '../TorrentNameTooltip';
import callApi from '../../tools/callApi';

vi.mock('../../tools/callApi', () => ({ default: vi.fn() }));
let sequence = 0;
let serverUrl: string;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  serverUrl = `http://nas-${++sequence}.local/transmission/rpc`;
  vi.mocked(callApi).mockResolvedValue({ path: '/media/series', sizeBytes: 2_000_000_000 });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function props() {
  return {
    name: 'Linux.iso',
    width: 320,
    title: 'Linux.iso\n/media/series\nHASH',
    directory: '/media/series',
    serverUrl,
  };
}
function target(container: HTMLElement) {
  const element = container.querySelector<HTMLElement>('.torrent-name-target');
  if (!element) throw new Error('Tooltip target is missing');
  return element;
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('TorrentNameTooltip', () => {
  it('cancels a pending tooltip on click or Escape without interfering with row actions', async () => {
    const onDoubleClick = vi.fn();
    const view = render(
      <div onDoubleClick={onDoubleClick}>
        <TorrentNameTooltip {...props()} />
      </div>
    );
    fireEvent.focus(target(view.container));
    fireEvent.click(target(view.container));
    fireEvent.doubleClick(target(view.container));
    await advance(500);
    expect(onDoubleClick).toHaveBeenCalledOnce();
    expect(callApi).not.toHaveBeenCalled();
    fireEvent.focus(target(view.container));
    fireEvent.keyDown(target(view.container), { key: 'Escape' });
    await advance(500);
    expect(callApi).not.toHaveBeenCalled();
  });

  it('does no eager RPC, ignores passing hovers, then shows the exact destination and existing metadata', async () => {
    const view = render(<TorrentNameTooltip {...props()} />);
    expect(callApi).not.toHaveBeenCalled();
    fireEvent.mouseEnter(target(view.container));
    await advance(200);
    fireEvent.mouseLeave(target(view.container));
    await advance(500);
    expect(callApi).not.toHaveBeenCalled();
    fireEvent.mouseEnter(target(view.container));
    await advance(350);
    expect(callApi).toHaveBeenCalledWith({
      action: 'getFreeSpace',
      path: '/media/series',
      serverUrl,
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('HASH');
    expect(screen.getByRole('tooltip')).toHaveTextContent('/media/series');
    expect(screen.getByRole('tooltip')).toHaveTextContent('2 GB');
    expect(screen.getByText('Linux.iso')).not.toHaveAttribute('title');
  });

  it('deduplicates in-flight requests across torrents and refreshes the shared path after one minute', async () => {
    let resolve!: (value: { path: string; sizeBytes: number }) => void;
    vi.mocked(callApi).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const first = render(<TorrentNameTooltip {...props()} />);
    const second = render(<TorrentNameTooltip {...props()} name="Second.iso" />);
    fireEvent.mouseEnter(target(first.container));
    fireEvent.mouseEnter(target(second.container));
    await advance(350);
    expect(callApi).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('tooltip')[0]).toHaveTextContent('torrentFreeSpaceLoading');
    await act(async () => {
      resolve({ path: '/media/series', sizeBytes: 0 });
    });
    expect(screen.getAllByRole('tooltip').every((el) => el.textContent?.includes('0 B'))).toBe(
      true
    );
    fireEvent.mouseLeave(target(first.container));
    fireEvent.mouseLeave(target(second.container));
    await advance(150);
    fireEvent.mouseEnter(target(first.container));
    await advance(350);
    expect(callApi).toHaveBeenCalledTimes(1);
    fireEvent.mouseLeave(target(first.container));
    await advance(150);
    vi.setSystemTime(Date.now() + 61000);
    fireEvent.mouseEnter(target(first.container));
    await advance(350);
    expect(callApi).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('tooltip')).toHaveTextContent('2 GB');
  });

  it('keeps servers and paths separate and ignores a late response for the old destination', async () => {
    let resolve!: (value: { path: string; sizeBytes: number }) => void;
    vi.mocked(callApi).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const view = render(<TorrentNameTooltip {...props()} />);
    fireEvent.mouseEnter(target(view.container));
    await advance(350);
    view.rerender(<TorrentNameTooltip {...props()} directory="/other" title="Linux.iso\n/other" />);
    await advance(0);
    expect(callApi).toHaveBeenLastCalledWith({ action: 'getFreeSpace', path: '/other', serverUrl });
    await act(async () => {
      resolve({ path: '/media/series', sizeBytes: 9_000_000_000 });
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('2 GB');
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('9 GB');
    view.rerender(<TorrentNameTooltip {...props()} serverUrl={serverUrl + '-other'} />);
    await advance(0);
    expect(callApi).toHaveBeenCalledTimes(3);
    expect(callApi).toHaveBeenLastCalledWith({
      action: 'getFreeSpace',
      path: '/media/series',
      serverUrl: serverUrl + '-other',
    });
  });

  it.each([new Error('HTTP 401'), { message: 'HTTP 401' }])(
    'shows failures instead of zero space, and retries on a later hover (%s)',
    async (error) => {
      vi.mocked(callApi).mockRejectedValueOnce(error);
      const view = render(<TorrentNameTooltip {...props()} />);
      fireEvent.mouseEnter(target(view.container));
      await advance(350);
      expect(screen.getByRole('tooltip')).toHaveTextContent('HTTP 401');
      expect(screen.getByRole('tooltip')).not.toHaveTextContent('0 B');
      fireEvent.mouseLeave(target(view.container));
      await advance(150);
      fireEvent.mouseEnter(target(view.container));
      await advance(350);
      expect(callApi).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('tooltip')).toHaveTextContent('2 GB');
    }
  );

  it('supports focus, pointer travel onto the tooltip, Escape, and unmount cleanup', async () => {
    const view = render(<TorrentNameTooltip {...props()} />);
    fireEvent.focus(target(view.container));
    await advance(350);
    fireEvent.mouseLeave(target(view.container));
    fireEvent.mouseEnter(screen.getByRole('tooltip'));
    await advance(200);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(target(view.container));
    view.unmount();
    await advance(500);
    expect(callApi).toHaveBeenCalledTimes(1);
  });
});
