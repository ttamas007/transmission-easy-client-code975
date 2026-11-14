import { getMessage } from '../../tools/i18n';
import React, { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { observer } from 'mobx-react';
import useRootStore from '../../hooks/useRootStore';
import callApi from '../../tools/callApi';
import { DEFAULT_SEED_TIME_LIMIT, type SeedTimeLimitRule } from '../../types/seedTimeLimit';

const SeedTimeLimitOptions = observer(() => {
  const rootStore = useRootStore();
  const rules = rootStore.config?.seedTimeLimits ?? [];
  const page = useRef<HTMLDivElement>(null);
  const [tracker, setTracker] = useState('');
  const rule = rules.find((entry) => entry.tracker === tracker) ?? DEFAULT_SEED_TIME_LIMIT;
  const [enabled, setEnabled] = useState(false);
  const [hours, setHours] = useState('48');
  const [includeExisting, setIncludeExisting] = useState(false);
  const [trackers, setTrackers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setEnabled(rule.enabled);
    setHours(String(rule.hours));
    setIncludeExisting(rule.includeExisting);
  }, [rule]);

  const selectTracker = (host: string) => {
    const stored = rules.find((entry) => entry.tracker === host);
    setTracker(host);
    setEnabled(stored?.enabled ?? enabled);
    setHours(String(stored?.hours ?? DEFAULT_SEED_TIME_LIMIT.hours));
    setIncludeExisting(stored?.includeExisting ?? false);
    setSaved(false);
  };

  const loadTrackers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const hosts = await callApi<string[]>({ action: 'getSeedTimeLimitTrackers' });
      if (page.current) setTrackers(hosts);
    } catch (err) {
      if (page.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (page.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrackers();
  }, [loadTrackers]);

  const remove = async (host: string) => {
    if (!window.confirm(getMessage('seedTimeLimitRemoveConfirm', host))) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await callApi<void>({ action: 'removeSeedTimeLimit', tracker: host });
      if (!page.current) return;
      if (tracker === host) setTracker('');
      setSaved(true);
    } catch (err) {
      if (page.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (page.current) setSaving(false);
    }
  };

  const choices = Array.from(
    new Set([...trackers, ...rules.map((entry) => entry.tracker).filter(Boolean)])
  ).sort();
  const active = rules.filter((entry) => entry.enabled);

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    const input = {
      enabled,
      tracker,
      hours: enabled ? Number(hours) : rule.hours,
      includeExisting,
    };
    try {
      if (enabled) {
        const count = await callApi<number>({ action: 'previewSeedTimeLimit', rule: input });
        if (!page.current) return;
        if (!window.confirm(getMessage('seedTimeLimitConfirm', [tracker, hours, String(count)])))
          return;
      }
      const result = await callApi<SeedTimeLimitRule>({ action: 'setSeedTimeLimit', rule: input });
      if (!page.current) return;
      setEnabled(result.enabled);
      setTracker(result.tracker);
      setHours(String(result.hours));
      setIncludeExisting(result.includeExisting);
      setSaved(true);
    } catch (err) {
      if (page.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (page.current) setSaving(false);
    }
  };

  return (
    <div ref={page} className="page seed-time-limit">
      <h2>{getMessage('seedTimeLimit')}</h2>
      <p>{getMessage('seedTimeLimitHint')}</p>
      <h3>{getMessage('seedTimeLimitActiveRules')}</h3>
      {active.length ? (
        <ul className="seed-rule-list">
          {active.map((entry) => (
            <li key={entry.tracker}>
              <strong>{entry.tracker}</strong>
              <span>
                {entry.hours} {getMessage('seedTimeLimitHourUnit')}
              </span>
              <span>
                {getMessage(
                  entry.includeExisting ? 'seedTimeLimitExistingIncluded' : 'seedTimeLimitNewOnly'
                )}
              </span>
              <button type="button" disabled={saving} onClick={() => selectTracker(entry.tracker)}>
                {getMessage('seedTimeLimitEdit')}
              </button>
              <button type="button" disabled={saving} onClick={() => remove(entry.tracker)}>
                {getMessage('seedTimeLimitRemove')}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>{getMessage('seedTimeLimitNoRules')}</p>
      )}
      <h3>{getMessage('seedTimeLimitConfigure')}</h3>
      <form onSubmit={save}>
        <label>
          <span>{getMessage('seedTimeLimitEnabled')}</span>
          <span className="toggle-switch">
            <input
              type="checkbox"
              checked={enabled}
              disabled={saving}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setSaved(false);
              }}
            />
            <span className="toggle-slider" />
          </span>
        </label>
        <label>
          <span>{getMessage('seedTimeLimitTracker')}</span>
          <select
            value={tracker}
            onChange={(e) => selectTracker(e.target.value)}
            required={enabled}
            disabled={saving}
          >
            <option value="">{getMessage('seedTimeLimitChooseTracker')}</option>
            {tracker && !choices.includes(tracker) && <option value={tracker}>{tracker}</option>}
            {choices.map((host) => (
              <option key={host} value={host}>
                {host}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={loading || saving} onClick={loadTrackers}>
          {loading ? '...' : getMessage('seedTimeLimitRefreshTrackers')}
        </button>
        <label>
          <span>{getMessage('seedTimeLimitHours')}</span>
          <input
            type="number"
            min="1"
            step="1"
            value={hours}
            required={enabled}
            disabled={saving || !enabled}
            onChange={(e) => setHours(e.target.value)}
          />
        </label>
        <label>
          <span>{getMessage('seedTimeLimitIncludeExisting')}</span>
          <span className="toggle-switch">
            <input
              type="checkbox"
              checked={includeExisting}
              disabled={saving || !enabled}
              onChange={(e) => setIncludeExisting(e.target.checked)}
            />
            <span className="toggle-slider" />
          </span>
        </label>
        <p>{getMessage('seedTimeLimitSafety')}</p>
        <button type="submit" disabled={saving || (enabled && loading)}>
          {saving ? '...' : getMessage('DLG_BTN_APPLY')}
        </button>
        {saved && (
          <p className="green" role="status">
            {getMessage('DLG_BTN_OK')}
          </p>
        )}
        {error && (
          <p className="red" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
});

export default SeedTimeLimitOptions;
