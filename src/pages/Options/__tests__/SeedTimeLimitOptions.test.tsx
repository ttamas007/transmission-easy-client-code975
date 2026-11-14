import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { destroy } from 'mobx-state-tree';
import RootStore, { type IRootStore } from '../../../stores/RootStore';
import RootStoreCtx from '../../../tools/rootStoreCtx';
import callApi from '../../../tools/callApi';
import SeedTimeLimitOptions from '../SeedTimeLimitOptions';
import { DEFAULT_SEED_TIME_LIMIT, isSeedTimeLimitRule } from '../../../types/seedTimeLimit';

vi.mock('../../../tools/callApi', () => ({ default: vi.fn() }));
const host = 'tracker.example.org';
let rootStore: IRootStore;

beforeEach(() => {
  vi.clearAllMocks();
  rootStore = RootStore.create({ config: {} });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.mocked(callApi).mockImplementation(async (message) => {
    if (message.action === 'getSeedTimeLimitTrackers') return [host];
    if (message.action === 'previewSeedTimeLimit') return 2;
    if (
      message.action === 'setSeedTimeLimit' &&
      typeof message.rule === 'object' &&
      message.rule !== null
    ) {
      const rule = { ...message.rule, revision: 'new-activation' };
      if (!isSeedTimeLimitRule(rule)) throw new Error('Invalid test rule');
      const others =
        rootStore.config?.seedTimeLimits.filter((entry) => entry.tracker !== rule.tracker) ?? [];
      rootStore.config?.setKeyValue({ seedTimeLimits: rule.enabled ? [...others, rule] : others });
      return rule;
    }
    if (message.action === 'removeSeedTimeLimit') {
      rootStore.config?.setKeyValue({
        seedTimeLimits: rootStore.config.seedTimeLimits.filter(
          (entry) => entry.tracker !== message.tracker
        ),
      });
      return;
    }
    throw new Error('Unexpected API request');
  });
});

afterEach(() => {
  cleanup();
  destroy(rootStore);
  vi.restoreAllMocks();
});

function renderOptions() {
  render(
    <RootStoreCtx.Provider value={rootStore}>
      <SeedTimeLimitOptions />
    </RootStoreCtx.Provider>
  );
}

async function configure() {
  await screen.findByRole('option', { name: host });
  fireEvent.click(screen.getByRole('checkbox', { name: 'seedTimeLimitEnabled' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'seedTimeLimitTracker' }), {
    target: { value: host },
  });
}

describe('SeedTimeLimitOptions', () => {
  it('starts off at 48 hours, loads only host choices, and requires confirmation before activation', async () => {
    renderOptions();
    expect(screen.getByRole('checkbox', { name: 'seedTimeLimitEnabled' })).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'seedTimeLimitIncludeExisting' })
    ).not.toBeChecked();
    expect(screen.getByRole('spinbutton')).toHaveValue(48);
    await configure();
    expect(callApi).toHaveBeenCalledTimes(1);

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(screen.getByText('DLG_BTN_APPLY'));
    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('DLG_BTN_APPLY')).toBeEnabled());
    expect(vi.mocked(callApi).mock.calls.some(([m]) => m.action === 'setSeedTimeLimit')).toBe(
      false
    );

    fireEvent.click(screen.getByText('DLG_BTN_APPLY'));
    expect(await screen.findByRole('status')).toHaveTextContent('DLG_BTN_OK');
    expect(callApi).toHaveBeenCalledWith({
      action: 'setSeedTimeLimit',
      rule: { enabled: true, tracker: host, hours: 48, includeExisting: false },
    });
  });

  it('sends an explicit opt-in when existing torrents are included', async () => {
    renderOptions();
    await configure();
    fireEvent.click(screen.getByRole('checkbox', { name: 'seedTimeLimitIncludeExisting' }));
    fireEvent.click(screen.getByText('DLG_BTN_APPLY'));
    await screen.findByRole('status');
    expect(callApi).toHaveBeenCalledWith({
      action: 'previewSeedTimeLimit',
      rule: { enabled: true, tracker: host, hours: 48, includeExisting: true },
    });
    expect(callApi).toHaveBeenCalledWith({
      action: 'setSeedTimeLimit',
      rule: { enabled: true, tracker: host, hours: 48, includeExisting: true },
    });
  });

  it('can disable an active rule even when the tracker lookup fails', async () => {
    rootStore.config?.setKeyValue({
      seedTimeLimits: [
        { ...DEFAULT_SEED_TIME_LIMIT, enabled: true, tracker: host, revision: 'old' },
      ],
    });
    vi.mocked(callApi).mockRejectedValueOnce(new Error('HTTP 401'));
    renderOptions();
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 401');

    fireEvent.click(screen.getByRole('button', { name: 'seedTimeLimitEdit' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'seedTimeLimitEnabled' }));
    fireEvent.click(screen.getByText('DLG_BTN_APPLY'));
    await screen.findByRole('status');
    expect(window.confirm).not.toHaveBeenCalled();
    expect(callApi).toHaveBeenCalledWith({
      action: 'setSeedTimeLimit',
      rule: { enabled: false, tracker: host, hours: 48, includeExisting: false },
    });
  });

  it('lists active rules, loads their individual settings, and deletes only the confirmed selection', async () => {
    const secondHost = 'second.example.org';
    rootStore.config?.setKeyValue({
      seedTimeLimits: [
        { ...DEFAULT_SEED_TIME_LIMIT, enabled: true, tracker: host, revision: 'first' },
        {
          ...DEFAULT_SEED_TIME_LIMIT,
          enabled: true,
          tracker: secondHost,
          hours: 72,
          includeExisting: true,
          revision: 'second',
        },
      ],
    });
    renderOptions();
    await screen.findByRole('option', { name: host });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const secondRow = screen
      .getAllByRole('listitem')
      .find((row) => row.textContent?.includes(secondHost));
    if (!secondRow) throw new Error('Second rule was not listed');
    expect(secondRow).toHaveTextContent('72 seedTimeLimitHourUnit');
    fireEvent.click(within(secondRow).getByRole('button', { name: 'seedTimeLimitEdit' }));
    expect(screen.getByRole('spinbutton')).toHaveValue(72);
    expect(screen.getByRole('checkbox', { name: 'seedTimeLimitIncludeExisting' })).toBeChecked();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '96' } });
    fireEvent.click(screen.getByText('DLG_BTN_APPLY'));
    await screen.findByRole('status');
    expect(rootStore.config?.seedTimeLimits).toEqual([
      expect.objectContaining({ tracker: host, hours: 48 }),
      expect.objectContaining({ tracker: secondHost, hours: 96 }),
    ]);

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(within(secondRow).getByRole('button', { name: 'seedTimeLimitRemove' }));
    expect(callApi).not.toHaveBeenCalledWith({
      action: 'removeSeedTimeLimit',
      tracker: secondHost,
    });
    fireEvent.click(within(secondRow).getByRole('button', { name: 'seedTimeLimitRemove' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.getByRole('listitem')).toHaveTextContent(host);
    expect(callApi).toHaveBeenCalledWith({ action: 'removeSeedTimeLimit', tracker: secondHost });
    expect(screen.getByRole('checkbox', { name: 'seedTimeLimitEnabled' })).not.toBeChecked();
  });

  it('adds another tracker without replacing the existing active rule', async () => {
    rootStore.config?.setKeyValue({
      seedTimeLimits: [
        {
          ...DEFAULT_SEED_TIME_LIMIT,
          enabled: true,
          tracker: 'existing.example.org',
          revision: 'old',
        },
      ],
    });
    renderOptions();
    await configure();
    fireEvent.click(screen.getByText('DLG_BTN_APPLY'));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(rootStore.config?.seedTimeLimits.map((entry) => entry.tracker)).toEqual([
      'existing.example.org',
      host,
    ]);
  });

  it('keeps the active row and displays an error if deleting fails', async () => {
    rootStore.config?.setKeyValue({
      seedTimeLimits: [
        { ...DEFAULT_SEED_TIME_LIMIT, enabled: true, tracker: host, revision: 'old' },
      ],
    });
    renderOptions();
    await screen.findByRole('option', { name: host });
    vi.mocked(callApi).mockRejectedValueOnce(new Error('storage write failed'));
    fireEvent.click(screen.getByRole('button', { name: 'seedTimeLimitRemove' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('storage write failed');
    expect(screen.getByRole('listitem')).toHaveTextContent(host);
  });
});
