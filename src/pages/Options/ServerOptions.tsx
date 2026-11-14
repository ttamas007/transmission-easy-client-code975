import { getLocale, getMessage } from '../../tools/i18n';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { observer } from 'mobx-react';
import useRootStore from '../../hooks/useRootStore';
import ScriptPathField from './ScriptPathField';

const ALT_SPEED_DAYS = [
  { bit: 1, key: 'daySunday' },
  { bit: 2, key: 'dayMonday' },
  { bit: 4, key: 'dayTuesday' },
  { bit: 8, key: 'dayWednesday' },
  { bit: 16, key: 'dayThursday' },
  { bit: 32, key: 'dayFriday' },
  { bit: 64, key: 'daySaturday' },
] as const;

const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const ServerOptions = observer(() => {
  const rootStore = useRootStore();
  const client = rootStore.client;
  const settings = client?.settings ?? null;
  const [url, setUrl] = useState('');
  const [urlLoaded, setUrlLoaded] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [incompleteDir, setIncompleteDirInput] = useState('');
  const [incompleteDirLoaded, setIncompleteDirLoaded] = useState<string | null>(null);
  const [portTestResult, setPortTestResult] = useState<boolean | null>(null);
  const [portTesting, setPortTesting] = useState(false);

  const [actionError, setActionError] = useState('');
  const pendingToggles = useRef(new Map<unknown, boolean>());

  // Every daemon mutation on this page used to fail silently: the error only
  // went to ClientStore.lastErrorMessage, which no options component renders.
  const runAction = useCallback((promise: Promise<unknown> | undefined) => {
    setActionError('');
    Promise.resolve(promise).catch((err: Error) => {
      setActionError(`${err.name}: ${err.message || 'Unknown error'}`);
    });
  }, []);

  const fetchSettings = useCallback(() => {
    if (!client) return;
    setLoading(true);
    setError(false);
    client.updateSettings().then(
      () => setLoading(false),
      () => {
        setLoading(false);
        setError(true);
      }
    );
  }, [client]);

  // Always refresh on mount: the background mirror can hold settings fetched
  // long ago (or changed since from another client), and this page has no
  // polling loop, so it used to display frozen values whenever the service
  // worker happened to be warm.
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // All hooks below must run unconditionally on every render — the actual
  // "not ready yet" branching happens only in the JSX at the very end, so the
  // hook count never differs between the loading and loaded renders (a
  // mismatch there is what "Rendered fewer hooks than expected" means).

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
  }, []);

  const handleApplyUrl = useCallback(() => {
    runAction(client?.setBlocklistUrl(url));
  }, [client, url, runAction]);

  const handleUpdate = useCallback(() => {
    if (!client) return;
    setUpdating(true);
    runAction(client.blocklistUpdate().finally(() => setUpdating(false)));
  }, [client, runAction]);

  const handleEncryptionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      runAction(client?.setEncryption(e.target.value));
    },
    [client, runAction]
  );

  const handleIncompleteDirChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setIncompleteDirInput(e.target.value);
  }, []);

  const handleApplyIncompleteDir = useCallback(() => {
    runAction(client?.setIncompleteDir(incompleteDir));
  }, [client, incompleteDir, runAction]);

  const handlePortTest = useCallback(() => {
    if (!client) return;
    setPortTesting(true);
    setPortTestResult(null);
    setActionError('');
    client.portTest().then(
      (isOpen) => {
        setPortTestResult(isOpen);
        setPortTesting(false);
      },
      (err: Error) => {
        // A failed check is NOT a closed port: reporting it as one sent users
        // debugging their router for a request that never ran
        setPortTestResult(null);
        setActionError(`${err.name}: ${err.message}`);
        setPortTesting(false);
      }
    );
  }, [client]);

  // The daemon's bitfield only reaches us after a full session-set/get round
  // trip, so XOR-ing against the mirror lost days when several were clicked in
  // a row. Track the pending value locally and apply successive toggles to it.
  const pendingDayRef = useRef<number | null>(null);
  useEffect(() => {
    // Only clear once the daemon actually reports the pending value, or a
    // toggle still in flight would be recomputed from the stale mirror
    if (pendingDayRef.current === settings?.altSpeedTimeDay) {
      pendingDayRef.current = null;
    }
  }, [settings?.altSpeedTimeDay]);

  const handleDayToggle = useCallback(
    (dayBit: number) => () => {
      if (!settings || !client) return;
      const base = pendingDayRef.current ?? settings.altSpeedTimeDay;
      const next = base ^ dayBit;
      pendingDayRef.current = next;
      Promise.resolve(client.setAltSpeedTimeDay(next)).catch((err: Error) => {
        // A failed toggle must not stay latched, or it would silently ride
        // along with the next successful one
        if (pendingDayRef.current === next) {
          pendingDayRef.current = null;
        }
        setActionError(`${err.name}: ${err.message || 'Unknown error'}`);
      });
      setActionError('');
    },
    [client, settings]
  );

  if (!client || !settings) {
    return (
      <div className="page server">
        <h2>{getMessage('optServer')}</h2>
        {loading && <div className="loading-inline" />}
        {error && (
          <div>
            <p>{getMessage('checkSettings')}</p>
            <button type="button" onClick={fetchSettings}>
              {getMessage('errorRetry')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Re-seed each text field whenever its STORE value moves (daemon echo, the
  // mount-time refresh, an external client's change) — not merely once. The
  // old one-shot latches froze these fields on whatever the pre-refresh mirror
  // held for the rest of the session. In-progress typing is preserved: local
  // state only resets when the store value itself changes.
  if (urlLoaded !== settings.blocklistUrl) {
    setUrl(settings.blocklistUrl);
    setUrlLoaded(settings.blocklistUrl);
  }

  if (incompleteDirLoaded !== settings.incompleteDir) {
    setIncompleteDirInput(settings.incompleteDir);
    setIncompleteDirLoaded(settings.incompleteDir);
  }

  const handleToggle = (setter: (enabled: boolean) => Promise<unknown>, current: boolean) => () => {
    // Latch on the setter: a quick off-then-on double click read the SAME
    // stale render-time value twice and sent the same state twice, so the
    // second click didn't undo the first
    const pending = pendingToggles.current.get(setter);
    const next = !(pending ?? current);
    pendingToggles.current.set(setter, next);
    runAction(
      setter(next).finally(() => {
        pendingToggles.current.delete(setter);
      })
    );
  };

  /** Clamp to the input's own min/max — typed values bypass those attributes */
  const clampToInput = (value: number, input: HTMLInputElement): number => {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    let result = value;
    if (Number.isFinite(min) && result < min) result = min;
    if (Number.isFinite(max) && result > max) result = max;
    return result;
  };

  const handleNumberBlur =
    (setter: (value: number) => Promise<unknown>) => (e: React.FocusEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      // 0 is a legitimate value (e.g. "stop seeding immediately"); requiring
      // > 0 silently dropped it
      if (Number.isFinite(val)) {
        const clamped = clampToInput(val, e.target);
        // Show what was actually sent: the field kept displaying the raw
        // typed value while the daemon received the clamped one
        e.target.value = String(clamped);
        runAction(setter(clamped));
      }
    };

  const handleIntBlur =
    (setter: (value: number) => Promise<unknown>) => (e: React.FocusEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (Number.isFinite(val)) {
        const clamped = clampToInput(val, e.target);
        e.target.value = String(clamped);
        runAction(setter(clamped));
      }
    };

  const handleTimeChange =
    (setter: (minutes: number) => Promise<unknown>) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const [h, m] = e.target.value.split(':').map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) {
        runAction(setter(h * 60 + m));
      }
    };

  return (
    <div className="page server">
      <h2>{getMessage('optServer')}</h2>

      {settings.daemonVersionStr && <p className="daemon-version">{settings.daemonVersionStr}</p>}

      {actionError && <p className="red">{actionError}</p>}

      {/* The mount-time refresh failed but the mirror held cached settings:
          without this banner the form rendered stale data with nothing saying
          the daemon was never reached */}
      {error && !loading && (
        <p className="red">
          {getMessage('checkSettings')}{' '}
          <button type="button" onClick={fetchSettings}>
            {getMessage('errorRetry')}
          </button>
        </p>
      )}

      <h3>{getMessage('generalSettings')}</h3>

      <label>
        <span>{getMessage('startAddedTorrents')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(client.setStartAddedTorrents, settings.startAddedTorrents)}
            type="checkbox"
            checked={settings.startAddedTorrents}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>

      <label>
        <span>{getMessage('trashOriginalTorrentFiles')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(
              client.setTrashOriginalTorrentFiles,
              settings.trashOriginalTorrentFiles
            )}
            type="checkbox"
            checked={settings.trashOriginalTorrentFiles}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>

      <h3>{getMessage('peerSettings')}</h3>

      <label>
        <span>{getMessage('peerLimitGlobal')}</span>
        <input
          type="number"
          min="1"
          key={`peerLimitGlobal-${settings.peerLimitGlobal}`}
          defaultValue={settings.peerLimitGlobal}
          onBlur={handleIntBlur(client.setPeerLimitGlobal)}
        />
      </label>

      <label>
        <span>{getMessage('peerLimitPerTorrent')}</span>
        <input
          type="number"
          min="1"
          key={`peerLimitPerTorrent-${settings.peerLimitPerTorrent}`}
          defaultValue={settings.peerLimitPerTorrent}
          onBlur={handleIntBlur(client.setPeerLimitPerTorrent)}
        />
      </label>

      <h3>{getMessage('seedingSettings')}</h3>

      <label>
        <span>{getMessage('seedRatioLimited')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(client.setSeedRatioLimited, settings.seedRatioLimited)}
            type="checkbox"
            checked={settings.seedRatioLimited}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>

      {settings.seedRatioLimited && (
        <label>
          <span>{getMessage('seedRatioLimit')}</span>
          <input
            type="number"
            min="0"
            step="0.1"
            key={`seedRatioLimit-${settings.seedRatioLimit}`}
            defaultValue={settings.seedRatioLimit}
            onBlur={handleNumberBlur(client.setSeedRatioLimit)}
          />
        </label>
      )}

      <label>
        <span>{getMessage('idleSeedingLimitEnabled')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(
              client.setIdleSeedingLimitEnabled,
              settings.idleSeedingLimitEnabled
            )}
            type="checkbox"
            checked={settings.idleSeedingLimitEnabled}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>

      {settings.idleSeedingLimitEnabled && (
        <label>
          <span>{getMessage('idleSeedingLimit')}</span>
          <input
            type="number"
            min="1"
            key={`idleSeedingLimit-${settings.idleSeedingLimit}`}
            defaultValue={settings.idleSeedingLimit}
            onBlur={handleIntBlur(client.setIdleSeedingLimit)}
          />{' '}
          <span>{getMessage('minutes')}</span>
        </label>
      )}

      <h3>{getMessage('queueSettings')}</h3>

      <label>
        <span>{getMessage('downloadQueueEnabled')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(client.setDownloadQueueEnabled, settings.downloadQueueEnabled)}
            type="checkbox"
            checked={settings.downloadQueueEnabled}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>

      {settings.downloadQueueEnabled && (
        <label>
          <span>{getMessage('downloadQueueSize')}</span>
          <input
            type="number"
            min="1"
            key={`downloadQueueSize-${settings.downloadQueueSize}`}
            defaultValue={settings.downloadQueueSize}
            onBlur={handleIntBlur(client.setDownloadQueueSize)}
          />
        </label>
      )}

      <label>
        <span>{getMessage('seedQueueEnabled')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(client.setSeedQueueEnabled, settings.seedQueueEnabled)}
            type="checkbox"
            checked={settings.seedQueueEnabled}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>

      {settings.seedQueueEnabled && (
        <label>
          <span>{getMessage('seedQueueSize')}</span>
          <input
            type="number"
            min="1"
            key={`seedQueueSize-${settings.seedQueueSize}`}
            defaultValue={settings.seedQueueSize}
            onBlur={handleIntBlur(client.setSeedQueueSize)}
          />
        </label>
      )}

      <label>
        <span>{getMessage('queueStalledEnabled')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(client.setQueueStalledEnabled, settings.queueStalledEnabled)}
            type="checkbox"
            checked={settings.queueStalledEnabled}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>

      {settings.queueStalledEnabled && (
        <label>
          <span>{getMessage('queueStalledMinutes')}</span>
          <input
            type="number"
            min="1"
            key={`queueStalledMinutes-${settings.queueStalledMinutes}`}
            defaultValue={settings.queueStalledMinutes}
            onBlur={handleIntBlur(client.setQueueStalledMinutes)}
          />{' '}
          <span>{getMessage('minutes')}</span>
        </label>
      )}

      <h3>{getMessage('incompleteDirSettings')}</h3>

      <label>
        <span>{getMessage('incompleteDirEnabled')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(client.setIncompleteDirEnabled, settings.incompleteDirEnabled)}
            type="checkbox"
            checked={settings.incompleteDirEnabled}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>

      {settings.incompleteDirEnabled && (
        <label>
          <span>{getMessage('incompleteDir')}</span>
          <div className="blocklist-url-row">
            <input type="text" value={incompleteDir} onChange={handleIncompleteDirChange} />
            <button type="button" onClick={handleApplyIncompleteDir}>
              {getMessage('DLG_BTN_APPLY')}
            </button>
          </div>
        </label>
      )}

      <label>
        <span>{getMessage('renamePartialFiles')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(client.setRenamePartialFiles, settings.renamePartialFiles)}
            type="checkbox"
            checked={settings.renamePartialFiles}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>

      <h3>{getMessage('networkSettings')}</h3>
      <p className="hint">{getMessage('networkSettingsHint')}</p>

      <label>
        <span>{getMessage('peerPort')}</span>
        <input
          type="number"
          min="1"
          max="65535"
          key={`peerPort-${settings.peerPort}`}
          defaultValue={settings.peerPort}
          onBlur={handleIntBlur(client.setPeerPort)}
        />
      </label>

      <label>
        <span></span>
        <span>
          <button type="button" onClick={handlePortTest} disabled={portTesting}>
            {portTesting ? getMessage('portTesting') : getMessage('portTest')}
          </button>
          {portTestResult !== null && (
            <span className={portTestResult ? 'port-open' : 'port-closed'}>
              {' '}
              {/* Colour alone is not a status indicator */}
              <span aria-hidden="true">{portTestResult ? '✓' : '✗'}</span>{' '}
              {portTestResult ? getMessage('portOpen') : getMessage('portClosed')}
            </span>
          )}
        </span>
      </label>
      <p className="hint">{getMessage('peerPortHint')}</p>

      <label>
        <span>{getMessage('portForwardingEnabled')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(client.setPortForwardingEnabled, settings.portForwardingEnabled)}
            type="checkbox"
            checked={settings.portForwardingEnabled}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>
      <p className="hint">{getMessage('portForwardingHint')}</p>

      <label>
        <span>{getMessage('encryption')}</span>
        <select value={settings.encryption} onChange={handleEncryptionChange}>
          <option value="required">{getMessage('encryptionRequired')}</option>
          <option value="preferred">{getMessage('encryptionPreferred')}</option>
          <option value="tolerated">{getMessage('encryptionTolerated')}</option>
        </select>
      </label>
      <p className="hint">{getMessage('encryptionHint')}</p>

      <label>
        <span>{getMessage('dhtEnabled')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(client.setDhtEnabled, settings.dhtEnabled)}
            type="checkbox"
            checked={settings.dhtEnabled}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>
      <p className="hint">{getMessage('dhtHint')}</p>

      <label>
        <span>{getMessage('pexEnabled')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(client.setPexEnabled, settings.pexEnabled)}
            type="checkbox"
            checked={settings.pexEnabled}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>
      <p className="hint">{getMessage('pexHint')}</p>

      <label>
        <span>{getMessage('lpdEnabled')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(client.setLpdEnabled, settings.lpdEnabled)}
            type="checkbox"
            checked={settings.lpdEnabled}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>
      <p className="hint">{getMessage('lpdHint')}</p>

      <label>
        <span>{getMessage('utpEnabled')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(client.setUtpEnabled, settings.utpEnabled)}
            type="checkbox"
            checked={settings.utpEnabled}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>
      <p className="hint">{getMessage('utpHint')}</p>

      <h3>{getMessage('altSpeedSchedule')}</h3>
      <p className="hint">{getMessage('altSpeedScheduleHint')}</p>

      <label>
        <span>{getMessage('altSpeedTimeEnabled')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(client.setAltSpeedTimeEnabled, settings.altSpeedTimeEnabled)}
            type="checkbox"
            checked={settings.altSpeedTimeEnabled}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>

      {settings.altSpeedTimeEnabled && (
        <>
          <label>
            <span>{getMessage('altSpeedTimeBegin')}</span>
            <input
              type="time"
              value={minutesToTime(settings.altSpeedTimeBegin)}
              onChange={handleTimeChange(client.setAltSpeedTimeBegin)}
            />
          </label>

          <label>
            <span>{getMessage('altSpeedTimeEnd')}</span>
            <input
              type="time"
              value={minutesToTime(settings.altSpeedTimeEnd)}
              onChange={handleTimeChange(client.setAltSpeedTimeEnd)}
            />
          </label>

          <label>
            <span>{getMessage('altSpeedTimeDays')}</span>
            <div className="day-checkboxes">
              {ALT_SPEED_DAYS.map(({ bit, key }) => (
                <label key={key} className="day-checkbox">
                  <input
                    type="checkbox"
                    checked={(settings.altSpeedTimeDay & bit) !== 0}
                    onChange={handleDayToggle(bit)}
                  />
                  <span>{getMessage(key)}</span>
                </label>
              ))}
            </div>
          </label>
        </>
      )}

      <h3>{getMessage('scriptSettings')}</h3>
      <p className="hint">{getMessage('scriptSettingsHint')}</p>

      <label>
        <span>{getMessage('scriptTorrentDoneEnabled')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(
              client.setScriptTorrentDoneEnabled,
              settings.scriptTorrentDoneEnabled
            )}
            type="checkbox"
            checked={settings.scriptTorrentDoneEnabled}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>
      <p className="hint">{getMessage('scriptDoneHint')}</p>

      {settings.scriptTorrentDoneEnabled && (
        <ScriptPathField
          key={`${rootStore.config?.url}:done`}
          label={getMessage('scriptTorrentDoneFilename')}
          savedPath={settings.scriptTorrentDoneFilename}
          onSave={async (path) => {
            await client.setScriptTorrentDoneFilename(path);
            if (!client.settings) throw new Error(getMessage('checkSettings'));
            return client.settings.scriptTorrentDoneFilename;
          }}
        />
      )}

      {/* script-torrent-added / done-seeding need Transmission 4.0+ (rpc 17) */}
      {settings.features.scriptTorrentAdded && (
        <>
          <label>
            <span>{getMessage('scriptTorrentAddedEnabled')}</span>
            <span className="toggle-switch">
              <input
                onChange={handleToggle(
                  client.setScriptTorrentAddedEnabled,
                  settings.scriptTorrentAddedEnabled
                )}
                type="checkbox"
                checked={settings.scriptTorrentAddedEnabled}
              />
              <span className="toggle-slider"></span>
            </span>
          </label>
          <p className="hint">{getMessage('scriptAddedHint')}</p>

          {settings.scriptTorrentAddedEnabled && (
            <ScriptPathField
              key={`${rootStore.config?.url}:added`}
              label={getMessage('scriptTorrentAddedFilename')}
              savedPath={settings.scriptTorrentAddedFilename}
              onSave={async (path) => {
                await client.setScriptTorrentAddedFilename(path);
                if (!client.settings) throw new Error(getMessage('checkSettings'));
                return client.settings.scriptTorrentAddedFilename;
              }}
            />
          )}

          <label>
            <span>{getMessage('scriptTorrentDoneSeedingEnabled')}</span>
            <span className="toggle-switch">
              <input
                onChange={handleToggle(
                  client.setScriptTorrentDoneSeedingEnabled,
                  settings.scriptTorrentDoneSeedingEnabled
                )}
                type="checkbox"
                checked={settings.scriptTorrentDoneSeedingEnabled}
              />
              <span className="toggle-slider"></span>
            </span>
          </label>
          <p className="hint">{getMessage('scriptSeedingHint')}</p>

          {settings.scriptTorrentDoneSeedingEnabled && (
            <ScriptPathField
              key={`${rootStore.config?.url}:seeding`}
              label={getMessage('scriptTorrentDoneSeedingFilename')}
              savedPath={settings.scriptTorrentDoneSeedingFilename}
              onSave={async (path) => {
                await client.setScriptTorrentDoneSeedingFilename(path);
                if (!client.settings) throw new Error(getMessage('checkSettings'));
                return client.settings.scriptTorrentDoneSeedingFilename;
              }}
            />
          )}
        </>
      )}

      <h3>{getMessage('blocklist')}</h3>

      <label>
        <span>{getMessage('blocklistEnable')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleToggle(client.setBlocklistEnabled, settings.blocklistEnabled)}
            type="checkbox"
            checked={settings.blocklistEnabled}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>

      <label>
        <span>{getMessage('blocklistUrl')}</span>
        <div className="blocklist-url-row">
          <input type="text" value={url} onChange={handleUrlChange} placeholder="https://..." />
          <button type="button" onClick={handleApplyUrl}>
            {getMessage('DLG_BTN_APPLY')}
          </button>
        </div>
      </label>

      <label>
        <span>
          {getMessage('blocklistRules')}: {settings.blocklistSize.toLocaleString(getLocale())}
        </span>
      </label>

      <label>
        <button type="button" onClick={handleUpdate} disabled={updating}>
          {updating ? '...' : getMessage('blocklistUpdateNow')}
        </button>
      </label>
    </div>
  );
});

export default ServerOptions;
