import { getMessage } from '../tools/i18n';
import React, { useEffect, useState } from 'react';
import HoverTooltip from './HoverTooltip';
import TorrentName from './TorrentName';
import callApi from '../tools/callApi';
import { formatBytes } from '../tools/format';
import stripBidiControls from '../tools/stripBidiControls';

interface SpaceResult {
  path: string;
  sizeBytes: number;
}

interface CacheEntry {
  expiresAt: number;
  promise: Promise<SpaceResult>;
}

const cache = new Map<string, CacheEntry>();

function getSpace(key: string, path: string, serverUrl: string): Promise<SpaceResult> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const promise = callApi<SpaceResult>({ action: 'getFreeSpace', path, serverUrl }).catch(
    (error: unknown) => {
      if (cache.get(key)?.promise === promise) cache.delete(key);
      throw error;
    }
  );
  if (cache.size >= 128) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + 60000, promise });
  return promise;
}

interface Props {
  name: string;
  width: number;
  title: string;
  directory?: string;
  serverUrl?: string;
}

type Result =
  | { key: string; sizeBytes: number; error?: never }
  | { key: string; error: string; sizeBytes?: never };

export default function TorrentNameTooltip({ name, width, title, directory, serverUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const enabled = !!directory && !!serverUrl;
  const key = JSON.stringify([serverUrl, directory]);

  useEffect(() => {
    if (!open || !directory || !serverUrl) {
      setResult(null);
      return;
    }
    let active = true;
    getSpace(key, directory, serverUrl).then(
      ({ sizeBytes }) => {
        if (active) setResult({ key, sizeBytes });
      },
      (error: unknown) => {
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
  }, [open, key, directory, serverUrl]);

  if (!enabled) return <TorrentName name={name} width={width} title={title} />;
  const current = result?.key === key ? result : null;
  return (
    <HoverTooltip
      className="torrent-name-target"
      onOpenChange={setOpen}
      content={
        <>
          <div className="torrent-tooltip-info">{stripBidiControls(title)}</div>
          <div className="torrent-tooltip-space">
            {current?.error !== undefined ? (
              <span className="red">
                {getMessage('torrentFreeSpaceError')}: {current.error}
              </span>
            ) : current ? (
              <span>
                {getMessage('torrentFreeSpace')}: {formatBytes(current.sizeBytes)}
              </span>
            ) : (
              getMessage('torrentFreeSpaceLoading')
            )}
          </div>
          <div className="torrent-tooltip-hint">{getMessage('torrentFreeSpaceHint')}</div>
        </>
      }
    >
      <TorrentName name={name} width={width} title={title} nativeTitle={false} />
    </HoverTooltip>
  );
}
