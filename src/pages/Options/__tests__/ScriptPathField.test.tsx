import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScriptPathField from '../ScriptPathField';
import { setLanguage } from '../../../tools/i18n';

vi.unmock('../../../tools/i18n');
afterEach(() => {
  cleanup();
  setLanguage('hu');
});

describe('script path frontend checks', () => {
  it.each([
    ['', 'Bekapcsolt szkripthez'],
    ['scripts/hook.sh', 'Teljes Linux/Docker'],
    ['C:\\scripts\\hook.cmd', 'Windows-útvonal'],
    ['\\\\server\\share\\hook.sh', 'Windows-útvonal'],
    ['"/config/scripts/hook.sh"', 'idézőjeleket'],
    ['/config/scripts/', 'könyvtárét'],
    ['/config/scripts/hook.sh ', 'szóközöket'],
  ])('blocks invalid path %j without sending a save', (path, message) => {
    const save = vi.fn();
    render(<ScriptPathField label="Script" savedPath={path} onSave={save} />);
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button')).toBeDisabled();
    fireEvent.click(screen.getByRole('button'));
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects pasted line breaks before a text input can silently strip them', () => {
    const save = vi.fn();
    render(<ScriptPathField label="Script" savedPath="" onSave={save} />);
    fireEvent.paste(screen.getByRole('textbox'), {
      clipboardData: { getData: () => '/config/hook.sh\nanother-command' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('vezérlőkaraktert');
    expect(screen.getByRole('button')).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });

  it('confirms exact read-back, allows spaces and no extension, and clears confirmation on edit', async () => {
    const path = '/config/my scripts/completion';
    const save = vi.fn().mockResolvedValue(path);
    const view = render(<ScriptPathField label="Script" savedPath="" onSave={save} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: path } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Útvonal mentve'));
    view.rerender(<ScriptPathField label="Script" savedPath={path} onSave={save} />);
    expect(screen.getByRole('status')).toHaveTextContent('visszaolvasott beállítás egyezik');
    expect(screen.getByRole('status')).toHaveTextContent('nem ellenőrizhető');
    expect(save).toHaveBeenCalledExactlyOnceWith(path);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/config/other.sh' } });
    expect(screen.getByRole('status')).not.toHaveTextContent('Útvonal mentve');
  });

  it('reports mismatched read-back and preserves the submitted path', async () => {
    const save = vi.fn().mockResolvedValue('/config/other.sh');
    const view = render(
      <ScriptPathField label="Script" savedPath="/config/old.sh" onSave={save} />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/config/new.sh' } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('nem egyezik'));
    view.rerender(<ScriptPathField label="Script" savedPath="/config/other.sh" onSave={save} />);
    expect(screen.getByRole('textbox')).toHaveValue('/config/new.sh');
    expect(screen.getByRole('alert')).toHaveTextContent('nem egyezik');
  });

  it('shows RPC errors, prevents concurrent saves and allows retry in English', async () => {
    setLanguage('en');
    let reject: (reason: Error) => void = () => {
      throw new Error('No request');
    };
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, rejectPromise) => {
            reject = rejectPromise;
          })
      )
      .mockResolvedValue('/config/hook.sh');
    render(<ScriptPathField label="Script" savedPath="/config/hook.sh" onSave={save} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('textbox')).toBeDisabled();
    fireEvent.click(screen.getByRole('button'));
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error('HTTP 401')));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not save or read back the path: HTTP 401'
    );
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('read-back setting matches')
    );
    expect(screen.getByRole('status')).toHaveTextContent('cannot be checked through RPC');
  });

  it.each([true, false])(
    'keeps mismatch feedback when saving an unchanged path (settings echo first: %s)',
    async (echoFirst) => {
      const submitted = '/config/hook.sh';
      const actual = '/config/different.sh';
      let finish: ((path: string) => void) | undefined;
      const save = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            finish = resolve;
          })
      );
      const view = render(<ScriptPathField label="Script" savedPath={submitted} onSave={save} />);
      fireEvent.click(screen.getByRole('button'));
      const echo = () =>
        view.rerender(<ScriptPathField label="Script" savedPath={actual} onSave={save} />);
      if (echoFirst) echo();
      await act(async () => {
        if (!finish) throw new Error('Save not pending');
        finish(actual);
      });
      if (!echoFirst) echo();
      expect(screen.getByRole('textbox')).toHaveValue(submitted);
      expect(screen.getByRole('alert')).toHaveTextContent('nem egyezik');
    }
  );
});
