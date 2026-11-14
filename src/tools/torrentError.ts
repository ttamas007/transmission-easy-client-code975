import { getMessage } from './i18n';

const messages: Record<string, string> = {
  'permission denied': 'torrentErrorPermission',
  'no such file or directory': 'torrentErrorMissingFile',
  'no space left on device': 'torrentErrorNoSpace',
  'read-only file system': 'torrentErrorReadOnly',
  'input/output error': 'torrentErrorIo',
  'too many open files': 'torrentErrorOpenFiles',
  'file too large': 'torrentErrorFileLarge',
  'connection refused': 'torrentErrorRefused',
  'connection timed out': 'torrentErrorTimeout',
  'operation timed out': 'torrentErrorTimeout',
  'connection reset by peer': 'torrentErrorReset',
  'could not connect to tracker': 'torrentErrorTrackerConnect',
  'tracker did not respond': 'torrentErrorTrackerTimeout',
  'unregistered torrent': 'torrentErrorUnregistered',
  'torrent not registered': 'torrentErrorUnregistered',
  'torrent not found': 'torrentErrorTorrentMissing',
  'invalid passkey': 'torrentErrorPasskey',
  'invalid auth': 'torrentErrorAuth',
  unauthorized: 'torrentErrorAuth',
  'unknown error': 'torrentErrorUnknown',
  'connection failed': 'torrentErrorConnection',
  'corrupt data': 'torrentErrorCorrupt',
  'corrupt piece': 'torrentErrorCorrupt',
  'piece checksum failed': 'torrentErrorCorrupt',
};

const missingData =
  'No data found! Ensure your drives are connected or use "Set Location". To re-download, remove the torrent and re-add it.';

const httpMessages: Record<string, string> = {
  unauthorized: 'torrentErrorHttpUnauthorized',
  forbidden: 'torrentErrorHttpForbidden',
  'not found': 'torrentErrorHttpMissing',
  'too many requests': 'torrentErrorHttpRate',
  'internal server error': 'torrentErrorHttpInternal',
  'bad gateway': 'torrentErrorHttpGateway',
  'service unavailable': 'torrentErrorHttpUnavailable',
  'gateway timeout': 'torrentErrorHttpTimeout',
};

export default function translateTorrentError(message: string): string {
  const text = message.replace(/^Error:\s*/i, '').trim();
  if (!text) return '';
  if (text === missingData || text === 'No data found!') {
    return getMessage('torrentErrorMissingData');
  }
  const key = Object.prototype.hasOwnProperty.call(messages, text.toLowerCase())
    ? messages[text.toLowerCase()]
    : undefined;
  if (key) return getMessage(key);

  // Match complete daemon templates; never replace words inside paths or tracker text.
  const http = /^Tracker HTTP response (\d{3}) \((.+)\)$/.exec(text);
  if (http)
    return getMessage('torrentErrorHttp', [
      http[1],
      Object.prototype.hasOwnProperty.call(httpMessages, http[2].toLowerCase())
        ? getMessage(httpMessages[http[2].toLowerCase()])
        : http[2],
    ]);
  const metainfo = /^Couldn't use metainfo from '(.+)' for '(.+)': (.+) \((-?\d+)\)$/.exec(text);
  if (metainfo)
    return getMessage('torrentErrorMetainfo', [
      metainfo[1],
      metainfo[2],
      translateTorrentError(metainfo[3]),
      metainfo[4],
    ]);
  const parse = /^Couldn't parse (announce|scrape) response: (.+) \((-?\d+)\)$/.exec(text);
  if (parse)
    return getMessage('torrentErrorTrackerParse', [
      parse[1],
      translateTorrentError(parse[2]),
      parse[3],
    ]);
  const lookup = /^Couldn't look up '(.+)': (.+) \((-?\d+)\)$/.exec(text);
  if (lookup)
    return getMessage('torrentErrorLookup', [
      lookup[1],
      translateTorrentError(lookup[2]),
      lookup[3],
    ]);
  const move = /^Couldn't move '(.+)' to '(.+)': (.+) \((-?\d+)\)$/.exec(text);
  if (move)
    return getMessage('torrentErrorMove', [
      move[1],
      move[2],
      translateTorrentError(move[3]),
      move[4],
    ]);
  const file = /^Couldn't (save|open|read|write) '(.+)': (.+) \((-?\d+)\)$/.exec(text);
  if (file)
    return getMessage(`torrentError${file[1][0].toUpperCase()}${file[1].slice(1)}`, [
      file[2],
      translateTorrentError(file[3]),
      file[4],
    ]);
  const system = /^(.+) \((-?\d+)\)$/.exec(text);
  if (system && Object.prototype.hasOwnProperty.call(messages, system[1].toLowerCase()))
    return `${translateTorrentError(system[1])} (${system[2]})`;
  const piece = /^(?:Corrupt piece|Piece checksum failed)[: ]+(\d+)$/i.exec(text);
  if (piece) return getMessage('torrentErrorCorruptPiece', piece[1]);
  return message;
}
