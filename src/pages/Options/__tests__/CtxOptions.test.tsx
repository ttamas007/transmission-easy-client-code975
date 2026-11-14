import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { destroy } from 'mobx-state-tree';
import RootStore, { type IRootStore } from '../../../stores/RootStore';
import RootStoreCtx from '../../../tools/rootStoreCtx';
import callApi from '../../../tools/callApi';
import CtxOptions from '../CtxOptions';

vi.mock('../../../tools/callApi', () => ({ default: vi.fn() }));

let rootStore: IRootStore;

beforeEach(() => {
  vi.clearAllMocks();
  (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation((_data, cb) => cb?.());
  rootStore = RootStore.create({ config: {} });
});

afterEach(() => {
  cleanup();
  destroy(rootStore);
});

function renderOptions() {
  render(
    <RootStoreCtx.Provider value={rootStore}>
      <CtxOptions />
    </RootStoreCtx.Provider>
  );
}

describe('CtxOptions known directories', () => {
  it('loads on demand and saves a chosen container path only after Add', async () => {
    vi.mocked(callApi).mockResolvedValue({
      defaultDirectory: '/downloads',
      directories: ['/downloads', '/downloads/Films'],
    });
    renderOptions();
    expect(callApi).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('loadKnownDirectories'));
    const select = await screen.findByRole('combobox', { name: 'chooseKnownDirectory' });
    expect(callApi).toHaveBeenCalledWith({ action: 'getDownloadDirectories' });
    expect(screen.getByRole('option', { name: '/downloads (defaultPath)' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: '/downloads/Films' } });
    expect(screen.getByPlaceholderText('subPath')).toHaveValue('/downloads/Films');
    expect(chrome.storage.local.set).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('shortName'), { target: { value: 'Films' } });
    fireEvent.click(screen.getByText('add'));

    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { folders: [{ path: '/downloads/Films', name: 'Films' }] },
        expect.any(Function)
      );
    });
    expect(screen.getByRole('option', { name: 'Films (/downloads/Films)' })).toBeInTheDocument();
  });

  it('shows connection errors and keeps manual path entry available', async () => {
    vi.mocked(callApi).mockRejectedValue(new Error('HTTP 401'));
    renderOptions();
    fireEvent.click(screen.getByText('loadKnownDirectories'));

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 401');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('loadKnownDirectories')).toBeEnabled();

    fireEvent.change(screen.getByPlaceholderText('subPath'), {
      target: { value: '/downloads/Manual' },
    });
    fireEvent.click(screen.getByText('add'));
    expect(rootStore.config?.folders[0].path).toBe('/downloads/Manual');
  });
});
