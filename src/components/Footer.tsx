import { getMessage } from '../tools/i18n';
import React, { useCallback, MouseEvent } from 'react';
import { observer } from 'mobx-react';
import SpeedContextMenu from './menu/SpeedMenu';
import SpaceWatcher from './SpaceWatcher';
import useRootStore from '../hooks/useRootStore';
import FooterActiveTrackers from './FooterActiveTrackers';
import { formatBytes } from '../tools/format';
import { getLocale } from '../tools/i18n';
import stripBidiControls from '../tools/stripBidiControls';
import showError from '../tools/showError';

const Footer = observer(() => {
  const rootStore = useRootStore();

  const handleResetDownloadSpeed = useCallback(
    (e: MouseEvent<HTMLSpanElement>) => {
      e.preventDefault();
      const client = rootStore?.client;
      if (!client) return;
      if (client.settings?.altSpeedEnabled) {
        client.setAltSpeedEnabled(false);
      } else {
        client.setDownloadSpeedLimitEnabled(false);
      }
    },
    [rootStore]
  );

  const handleResetUploadSpeed = useCallback(
    (e: MouseEvent<HTMLSpanElement>) => {
      e.preventDefault();
      const client = rootStore?.client;
      if (!client) return;
      if (client.settings?.altSpeedEnabled) {
        client.setAltSpeedEnabled(false);
      } else {
        client.setUploadSpeedLimitEnabled(false);
      }
    },
    [rootStore]
  );

  const handleOpenTab = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    chrome.tabs.create({ url: `${location.origin}${location.pathname}` });
  }, []);

  if (!rootStore.client || !rootStore.config) return null;

  const client = rootStore.client;
  const config = rootStore.config;

  const { downloadSpeedStr, uploadSpeedStr } = client.currentSpeedStr ?? {
    downloadSpeedStr: '',
    uploadSpeedStr: '',
  };
  let downloadLimit: React.ReactNode = null;
  let uploadLimit: React.ReactNode = null;
  const settings = client.settings;

  if (settings) {
    if (settings.altSpeedEnabled || settings.downloadSpeedLimitEnabled) {
      const speedStr = settings.altSpeedEnabled
        ? settings.altDownloadSpeedLimitStr
        : settings.downloadSpeedLimitStr;
      downloadLimit = (
        <span
          onClick={handleResetDownloadSpeed}
          className="limit dl"
          title={`${getMessage('footerSpeedHint')}\n${getMessage('footerLimitClickHint')}`}
        >
          {speedStr}
        </span>
      );
    }
    if (settings.altSpeedEnabled || settings.uploadSpeedLimitEnabled) {
      const speedStr = settings.altSpeedEnabled
        ? settings.altUploadSpeedLimitStr
        : settings.uploadSpeedLimitStr;
      uploadLimit = (
        <span
          onClick={handleResetUploadSpeed}
          className="limit up"
          title={`${getMessage('footerSpeedHint')}\n${getMessage('footerLimitClickHint')}`}
        >
          {speedStr}
        </span>
      );
    }
  }

  let openInTab: React.ReactNode = null;
  if (rootStore.isPopup) {
    openInTab = (
      <div onClick={handleOpenTab} className="openInTab" title={getMessage('openInTab')} />
    );
  }

  let spaceWatcher: React.ReactNode = null;
  if (config.showFreeSpace) {
    spaceWatcher = <SpaceWatcher />;
  }

  const paused = Array.from(client.torrents.values())
    .filter((t) => t.isStopped)
    .sort((a, b) => a.name.localeCompare(b.name, getLocale()));
  const pausedTitle = [
    ...(paused.length
      ? paused.slice(0, 5).map((t) => stripBidiControls(t.name))
      : [getMessage('footerPausedEmpty')]),
    ...(paused.length > 5 ? [getMessage('footerMore', String(paused.length - 5))] : []),
    getMessage('footerPausedHint'),
  ].join('\n');
  const sessionTitle = (direction: 'Downloaded' | 'Uploaded') =>
    [
      getMessage(`footerSession${direction}`),
      typeof settings?.sessionStartedAt === 'number'
        ? getMessage(
            'footerSessionSince',
            new Date(settings.sessionStartedAt).toLocaleString(getLocale())
          )
        : getMessage('footerSessionDateUnknown'),
      typeof settings?.[`session${direction}`] === 'number'
        ? getMessage('footerSessionNote')
        : getMessage('footerSessionMissing'),
    ].join('\n');
  const showPaused = () => {
    config.setSearchQuery('');
    config.setSelectedLabel('PAUSED', true).catch((error: Error) => {
      showError(getMessage('OV_FL_ERROR'), error);
    });
  };

  return (
    <div className="status-panel" role="contentinfo">
      {spaceWatcher}
      {client.torrents.size > 0 && (
        <div className="torrent-counts">
          <FooterActiveTrackers count={client.activeCount} serverUrl={config.url} />
          <button type="button" className="footer-paused" title={pausedTitle} onClick={showPaused}>
            {getMessage('footerPaused', String(client.pausedCount))}
          </button>
        </div>
      )}
      <span className="session-totals">
        <span className="total-dl" title={sessionTitle('Downloaded')}>
          {typeof settings?.sessionDownloaded === 'number'
            ? formatBytes(settings.sessionDownloaded)
            : '-'}
        </span>
        <span className="total-up" title={sessionTitle('Uploaded')}>
          {typeof settings?.sessionUploaded === 'number'
            ? formatBytes(settings.sessionUploaded)
            : '-'}
        </span>
      </span>
      <SpeedContextMenu type="download">
        <span className="speed download" aria-live="polite" title={getMessage('footerSpeedHint')}>
          {downloadSpeedStr}
          {downloadLimit}
        </span>
      </SpeedContextMenu>
      <SpeedContextMenu type="upload">
        <span className="speed upload" aria-live="polite" title={getMessage('footerSpeedHint')}>
          {uploadSpeedStr}
          {uploadLimit}
        </span>
      </SpeedContextMenu>
      {client.lastErrorMessage && (
        <span
          className="status"
          role="status"
          aria-live="assertive"
          title={client.lastErrorMessage}
        >
          {client.lastErrorMessage}
        </span>
      )}
      {openInTab}
    </div>
  );
});

export default Footer;
