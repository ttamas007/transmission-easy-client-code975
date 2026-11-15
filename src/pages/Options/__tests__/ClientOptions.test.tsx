import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { applyPatch, destroy } from 'mobx-state-tree';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RootStore from '../../../stores/RootStore';
import RootStoreCtx from '../../../tools/rootStoreCtx';
import callApi from '../../../tools/callApi';
import loadConfig from '../../../tools/loadConfig';
import ClientOptions from '../ClientOptions';

vi.mock('../../../tools/callApi', () => ({ default: vi.fn() }));

let storage: Record<string, unknown>;

beforeEach(() => {
  storage = { configVersion: 2 };
  vi.mocked(chrome.storage.local.set).mockImplementation((values, callback) => {
    Object.assign(storage, values);
    callback?.();
  });
  vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
    callback?.(storage);
  });
  vi.mocked(callApi).mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function show(rootStore: ReturnType<typeof RootStore.create>) {
  return render(
    <RootStoreCtx.Provider value={rootStore}>
      <MemoryRouter>
        <ClientOptions />
      </MemoryRouter>
    </RootStoreCtx.Provider>
  );
}

describe('ClientOptions connection settings', () => {
  it('initializes the switches from asynchronously loaded settings and preserves drafts', () => {
    const rootStore = RootStore.create({});
    const view = show(rootStore);

    act(() => {
      applyPatch(rootStore, {
        op: 'replace',
        path: '/config',
        value: { hostname: 'example.test', authenticationRequired: true, ssl: true },
      });
    });

    const auth = screen.getByRole('checkbox', { name: 'requireAuthentication' });
    const ssl = screen.getByRole('checkbox', { name: 'useSSL' });
    expect(auth).toBeChecked();
    expect(ssl).toBeChecked();
    fireEvent.click(auth);
    expect(auth).not.toBeChecked();
    expect(rootStore.config?.authenticationRequired).toBe(true);

    view.unmount();
    destroy(rootStore);
  });

  it.each([true, false])(
    'saves and restores authentication set to %s after the settings are reloaded',
    async (enabled) => {
      const rootStore = RootStore.create({
        config: { hostname: 'example.test', authenticationRequired: !enabled },
      });
      const view = show(rootStore);
      const auth = screen.getByRole('checkbox', { name: 'requireAuthentication' });
      expect(auth).toHaveProperty('checked', !enabled);
      fireEvent.click(auth);
      fireEvent.click(screen.getByRole('button', { name: 'DLG_BTN_APPLY' }));

      await waitFor(() => expect(callApi).toHaveBeenCalledWith({ action: 'updateSettings' }));
      expect(storage.authenticationRequired).toBe(enabled);
      view.unmount();
      destroy(rootStore);

      const restored = await loadConfig(null);
      expect(restored.authenticationRequired).toBe(enabled);
      if (typeof restored.authenticationRequired !== 'boolean') {
        throw new Error('Saved authentication setting was not restored');
      }
      const next = RootStore.create({
        config: { authenticationRequired: restored.authenticationRequired },
      });
      const nextView = show(next);
      expect(screen.getByRole('checkbox', { name: 'requireAuthentication' })).toHaveProperty(
        'checked',
        enabled
      );
      nextView.unmount();
      destroy(next);
    }
  );
});
