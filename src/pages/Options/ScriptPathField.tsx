import React, { useEffect, useId, useRef, useState } from 'react';
import { getMessage } from '../../tools/i18n';

interface Props {
  label: string;
  savedPath: string;
  onSave: (path: string) => Promise<string>;
}

const hasControlCharacters = (text: string) =>
  Array.from(text).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);

function pathError(path: string): string | undefined {
  if (!path.trim()) return 'scriptPathEmpty';
  if (hasControlCharacters(path)) return 'scriptPathControl';
  if (/^['"\u201c\u201d\u2018\u2019]|['"\u201c\u201d\u2018\u2019]$/.test(path))
    return 'scriptPathQuotes';
  if (path !== path.trim()) return 'scriptPathWhitespace';
  if (/^[a-z]:[\\/]|^\\\\/i.test(path)) return 'scriptPathWindows';
  if (!path.startsWith('/')) return 'scriptPathAbsolute';
  if (path.endsWith('/')) return 'scriptPathFile';
  return undefined;
}

export default function ScriptPathField({ label, savedPath, onSave }: Props) {
  const [value, setValue] = useState(savedPath);
  const [loaded, setLoaded] = useState(savedPath);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ path: string; error?: string } | null>(null);
  const mounted = useRef(true);
  const id = useId();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (loaded !== savedPath) {
    setLoaded(savedPath);
    if (value === loaded && !pending && !result?.error) {
      setValue(savedPath);
      setResult(null);
    }
  }
  const invalid = pathError(value);
  const current = result?.path === value ? result : null;
  const apply = async () => {
    if (invalid || pending) return;
    setPending(true);
    setResult(null);
    try {
      const actual = await onSave(value);
      if (mounted.current) {
        setResult({
          path: value,
          ...(actual !== value ? { error: getMessage('scriptPathMismatch') } : {}),
        });
      }
    } catch (error: unknown) {
      if (mounted.current)
        setResult({
          path: value,
          error: `${getMessage('scriptPathSaveError')}: ${error instanceof Error ? error.message : String(error)}`,
        });
    } finally {
      if (mounted.current) setPending(false);
    }
  };

  return (
    <div className="script-path-field">
      <label htmlFor={id}>
        <span>{label}</span>
        <div className="blocklist-url-row">
          <input
            id={id}
            type="text"
            value={value}
            disabled={pending}
            aria-invalid={Boolean(invalid || current?.error)}
            aria-describedby={`${id}-hint ${id}-result`}
            onChange={(event) => {
              setValue(event.target.value);
              setResult(null);
            }}
            onPaste={(event) => {
              const text = event.clipboardData.getData('text');
              if (hasControlCharacters(text)) {
                event.preventDefault();
                setValue(text);
                setResult(null);
              }
            }}
          />
          <button type="button" onClick={apply} disabled={Boolean(invalid) || pending}>
            {getMessage(pending ? 'scriptPathSaving' : 'DLG_BTN_APPLY')}
          </button>
        </div>
      </label>
      <p className="hint" id={`${id}-hint`}>
        {getMessage('scriptPathScope')}
      </p>
      <p id={`${id}-result`} role={invalid || current?.error ? 'alert' : 'status'}>
        {invalid
          ? getMessage(invalid)
          : (current?.error ??
            (current ? getMessage('scriptPathSaved') : getMessage('scriptPathUnchecked')))}
      </p>
    </div>
  );
}
