import React, { useEffect, useRef, useState } from 'react';
import { getMessage } from '../tools/i18n';
import callApi from '../tools/callApi';
import type { ActiveTrackerHosts } from '../types/footer';
import HoverTooltip from './HoverTooltip';

interface Result {
  key: string;
  data?: ActiveTrackerHosts;
  error?: string;
}

export default function FooterActiveTrackers({
  count,
  serverUrl,
}: {
  count: number;
  serverUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const cache = useRef<{
    key: string;
    expiresAt: number;
    promise: Promise<ActiveTrackerHosts>;
  } | null>(null);
  const key = JSON.stringify([serverUrl, count]);
  useEffect(() => {
    if (!open) {
      setResult(null);
      return;
    }
    if (count === 0) {
      setResult({ key, data: { hosts: [], withoutTracker: 0 } });
      return;
    }
    let active = true;
    if (!cache.current || cache.current.key !== key || cache.current.expiresAt <= Date.now()) {
      const promise = callApi<ActiveTrackerHosts>({ action: 'getActiveTrackerHosts', serverUrl });
      cache.current = { key, expiresAt: Date.now() + 60000, promise };
    }
    const request = cache.current;
    request.promise.then(
      (data) => {
        if (active) setResult({ key, data });
      },
      (error: unknown) => {
        if (cache.current === request) cache.current = null;
        if (active)
          setResult({
            key,
            error:
              error !== null &&
              typeof error === 'object' &&
              'message' in error &&
              typeof error.message === 'string'
                ? error.message
                : String(error),
          });
      }
    );
    return () => {
      active = false;
    };
  }, [open, key, count, serverUrl]);
  const current = result?.key === key ? result : null;
  const data = current?.data;
  return (
    <HoverTooltip
      className="footer-active"
      onOpenChange={setOpen}
      content={
        <>
          <strong>{getMessage('footerTrackerTitle')}</strong>
          {current?.error !== undefined ? (
            <p className="red">
              {getMessage('footerTrackersError')}: {current.error}
            </p>
          ) : data ? (
            <>
              {data.hosts.length ? (
                <ul className="footer-tracker-list">
                  {data.hosts.map(({ host, count }) => (
                    <li key={host}>
                      {host}: {count}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{getMessage('footerTrackersNone')}</p>
              )}
              {data.withoutTracker > 0 && (
                <p>{getMessage('footerTrackersUnknown', String(data.withoutTracker))}</p>
              )}
            </>
          ) : (
            <p>{getMessage('footerTrackersLoading')}</p>
          )}
          <div className="torrent-tooltip-hint">{getMessage('footerTrackerHint')}</div>
        </>
      }
    >
      {getMessage('footerActive', String(count))}
    </HoverTooltip>
  );
}
