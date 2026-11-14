import React, { useCallback, type ChangeEvent } from 'react';
import { observer } from 'mobx-react';
import { useOptionsPage } from '../../hooks/useOptionsPage';
import showError from '../../tools/showError';
import { getMessage } from '../../tools/i18n';

interface ConfigStore {
  theme: string;
  language: 'hu' | 'en';
  setOptions: (options: Record<string, unknown>) => Promise<void>;
  showFreeSpace: boolean;
  hideSeedingTorrents: boolean;
  hideFinishedTorrents: boolean;
  showSpeedGraph: boolean;
  uiUpdateInterval: number;
  setTheme: (theme: string) => void;
}

const UiOptions = observer(() => {
  const { configStore, handleChange, handleSetInt, handleIntBlur } = useOptionsPage<ConfigStore>();

  const handleThemeChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      configStore.setTheme(e.target.value);
    },
    [configStore]
  );

  return (
    <div className="page main">
      <h2>{getMessage('optMain')}</h2>
      <label>
        <span>{getMessage('language')}</span>
        <select
          aria-label={getMessage('language')}
          value={configStore.language}
          onChange={(event) => {
            configStore
              .setOptions({ language: event.target.value })
              .catch((error: Error) => showError(getMessage('OV_FL_ERROR'), error));
          }}
        >
          <option value="hu">Magyar</option>
          <option value="en">English</option>
        </select>
      </label>
      <label>
        <span>{getMessage('theme')}</span>
        <select value={configStore.theme} onChange={handleThemeChange}>
          <option value="system">{getMessage('themeSystem')}</option>
          <option value="light">{getMessage('themeLight')}</option>
          <option value="dark">{getMessage('themeDark')}</option>
        </select>
      </label>
      <label>
        <span>{getMessage('showFreeSpace')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleChange}
            name="showFreeSpace"
            type="checkbox"
            defaultChecked={configStore.showFreeSpace}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>
      <label>
        <span>{getMessage('hideSeedStatusItem')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleChange}
            name="hideSeedingTorrents"
            type="checkbox"
            defaultChecked={configStore.hideSeedingTorrents}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>
      <label>
        <span>{getMessage('hideFinishStatusItem')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleChange}
            name="hideFinishedTorrents"
            type="checkbox"
            defaultChecked={configStore.hideFinishedTorrents}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>
      <label>
        <span>{getMessage('showSpeedGraph')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleChange}
            name="showSpeedGraph"
            type="checkbox"
            defaultChecked={configStore.showSpeedGraph}
          />
          <span className="toggle-slider"></span>
        </span>
      </label>
      <label>
        <span>{getMessage('popupUpdateInterval')}</span>
        <input
          onChange={handleSetInt}
          onBlur={handleIntBlur}
          name="uiUpdateInterval"
          type="number"
          min="100"
          defaultValue={configStore.uiUpdateInterval}
        />{' '}
        <span>{getMessage('ms')}</span>
      </label>
    </div>
  );
});

export default UiOptions;
