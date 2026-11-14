import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroy } from 'mobx-state-tree';
import AboutOptions from '../AboutOptions';
import Menu from '../../../components/menu/Menu';
import RootStore from '../../../stores/RootStore';
import RootStoreCtx from '../../../tools/rootStoreCtx';
import { setLanguage } from '../../../tools/i18n';

vi.unmock('../../../tools/i18n');
afterEach(() => {
  cleanup();
  setLanguage('hu');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('About and fork attribution', () => {
  it('shows the running version, all three authors and GitHub links in both languages', () => {
    vi.stubGlobal('chrome', {
      ...chrome,
      runtime: {
        ...chrome.runtime,
        getManifest: () => ({ version: '3.4.2' }),
      },
    });
    render(<AboutOptions />);
    expect(screen.getByText('Verzió: 3.4.2')).toBeInTheDocument();
    expect(screen.getByText(/mthcore Transmission Easy Client 3.4.0/)).toBeInTheDocument();
    for (const author of ['ttamas007', 'mthcore', 'Feverqwe']) {
      expect(screen.getByRole('link', { name: author })).toHaveAttribute(
        'href',
        `https://github.com/${author}`
      );
    }
    const source = screen.getByRole('link', { name: 'A code975 fork forrása a GitHubon' });
    expect(source).toHaveAttribute(
      'href',
      'https://github.com/ttamas007/transmission-easy-client-code975'
    );
    expect(source).toHaveAttribute('rel', 'noopener noreferrer');
    act(() => setLanguage('en'));
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByText('Version: 3.4.2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'code975 fork source on GitHub' })).toBeInTheDocument();
  });

  it('opens the About route from the torrent toolbar', () => {
    const root = RootStore.create({ config: {} });
    try {
      render(
        <RootStoreCtx.Provider value={root}>
          <Menu />
        </RootStoreCtx.Provider>
      );
      expect(screen.getByRole('link', { name: 'Névjegy' })).toHaveAttribute(
        'href',
        chrome.runtime.getURL('options.html#/about')
      );
      expect(screen.getByRole('link', { name: 'Névjegy' })).toHaveAttribute('target', '_blank');
    } finally {
      cleanup();
      destroy(root);
    }
  });
});
