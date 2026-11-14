import { getMessage } from '../../tools/i18n';
import React, {
  useRef,
  useState,
  useCallback,
  type FormEventHandler,
  type MouseEvent,
  type ChangeEvent,
} from 'react';
import { observer } from 'mobx-react';
import { useOptionsPage } from '../../hooks/useOptionsPage';
import type { Folder } from '../../types/bg';
import type { DownloadDirectories } from '../../bg/SettingsService';
import callApi from '../../tools/callApi';

interface ConfigStore {
  folders: Folder[];
  treeViewContextMenu: boolean;
  putDefaultPathInContextMenu: boolean;
  selectDownloadCategoryAfterPutTorrentFromContextMenu: boolean;
  hasFolder: (path: string) => boolean;
  addFolder: (path: string, name: string) => void;
  removeFolders: (folders: Folder[]) => void;
  moveFolders: (folders: Folder[], direction: number) => void;
}

interface CtxOptionsDirsFormElements extends HTMLFormControlsCollection {
  path: HTMLInputElement;
  name: HTMLInputElement;
}

interface CtxOptionsDirsFormElement extends HTMLFormElement {
  elements: CtxOptionsDirsFormElements;
}

interface CtxOptionsDirsProps {
  configStore: ConfigStore;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

const CtxOptionsDirs = observer(({ configStore, handleChange }: CtxOptionsDirsProps) => {
  const refDirectorySelect = useRef<HTMLSelectElement>(null);
  const refPath = useRef<HTMLInputElement>(null);
  const [knownDirectories, setKnownDirectories] = useState<DownloadDirectories | null>(null);
  const [directoriesLoading, setDirectoriesLoading] = useState(false);
  const [directoriesError, setDirectoriesError] = useState('');

  const handleLoadDirectories = useCallback(async () => {
    setDirectoriesLoading(true);
    setDirectoriesError('');
    setKnownDirectories(null);
    try {
      const result = await callApi<DownloadDirectories>({ action: 'getDownloadDirectories' });
      if (!refPath.current) return;
      setKnownDirectories(result);
    } catch (err) {
      if (!refPath.current) return;
      setDirectoriesError(err instanceof Error ? err.message : String(err));
    } finally {
      if (refPath.current) setDirectoriesLoading(false);
    }
  }, []);

  const getSelectedDirectories = useCallback(() => {
    if (!refDirectorySelect.current) return [];
    return Array.from(refDirectorySelect.current.selectedOptions).map((option) => {
      return configStore.folders[parseInt(option.value, 10)];
    });
  }, [configStore]);

  const [addError, setAddError] = useState('');

  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    (e) => {
      e.preventDefault();
      const form = e.currentTarget as CtxOptionsDirsFormElement;

      // Trailing slashes are stripped ('/' itself excepted): '/data/x' and
      // '/data/x/' passed the exact-string duplicate check as "different" and
      // then collapsed to one entry in the context-menu folder tree
      let path = form.elements.path.value.trim();
      if (path.length > 1) {
        path = path.replace(/[/\\]+$/, '') || path;
      }
      const name = form.elements.name.value.trim();
      if (!path) return;

      if (configStore.hasFolder(path)) {
        // A silent no-op looked like a broken Add button
        setAddError(getMessage('folderAlreadyExists') || 'This folder is already in the list');
        return;
      }
      setAddError('');
      configStore.addFolder(path, name);
      form.elements.path.value = '';
      form.elements.name.value = '';
    },
    [configStore]
  );

  const handleRemove = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      configStore.removeFolders(getSelectedDirectories());
    },
    [configStore, getSelectedDirectories]
  );

  const handleMoveUp = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      configStore.moveFolders(getSelectedDirectories(), -1);
    },
    [configStore, getSelectedDirectories]
  );

  const handleMoveDown = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      configStore.moveFolders(getSelectedDirectories(), 1);
    },
    [configStore, getSelectedDirectories]
  );

  const directories = configStore.folders.map((folder: Folder, index: number) => {
    let name = folder.path;
    if (folder.name) {
      name = `${folder.name} (${name})`;
    }
    return (
      <option key={JSON.stringify(folder)} value={index}>
        {name}
      </option>
    );
  });

  return (
    <div className="dir-manager">
      <h3>{getMessage('dirList')}</h3>
      <p className="section-hint">{getMessage('dirListHint')}</p>
      <form onSubmit={handleSubmit} autoComplete="off" className="dir-form">
        <p className="section-hint">{getMessage('knownDirectoriesHint')}</p>
        <div className="dir-form-row known-directories">
          <button type="button" onClick={handleLoadDirectories} disabled={directoriesLoading}>
            {directoriesLoading ? '...' : getMessage('loadKnownDirectories')}
          </button>
          {knownDirectories && (
            <select
              aria-label={getMessage('chooseKnownDirectory')}
              value=""
              onChange={(e) => {
                if (refPath.current) refPath.current.value = e.target.value;
              }}
            >
              <option value="" disabled>
                {getMessage('chooseKnownDirectory')}
              </option>
              {knownDirectories.directories.map((path) => (
                <option key={path} value={path}>
                  {path}
                  {path === knownDirectories.defaultDirectory
                    ? ` (${getMessage('defaultPath')})`
                    : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        {directoriesError && (
          <p className="red" role="alert">
            {directoriesError}
          </p>
        )}
        <div className="dir-form-row">
          <input
            ref={refPath}
            name="path"
            type="text"
            required
            placeholder={getMessage('subPath')}
          />
          <input name="name" type="text" placeholder={getMessage('shortName')} />
          <button type="submit">{getMessage('add')}</button>
        </div>
        {addError && <p className="red">{addError}</p>}
      </form>
      <div className="dir-list-container">
        <select ref={refDirectorySelect} id="folderList" multiple>
          {directories}
        </select>
        <div className="dir-list-actions">
          <button type="button" onClick={handleMoveUp} title={getMessage('up')}>
            ▲
          </button>
          <button type="button" onClick={handleMoveDown} title={getMessage('down')}>
            ▼
          </button>
          <button type="button" onClick={handleRemove} title={getMessage('deleteSelected')}>
            ✕
          </button>
        </div>
      </div>
      <h3>{getMessage('options')}</h3>
      <label>
        <span>{getMessage('treeViewContextMenu')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleChange}
            defaultChecked={configStore.treeViewContextMenu}
            type="checkbox"
            name="treeViewContextMenu"
          />
          <span className="toggle-slider"></span>
        </span>
      </label>
      <label>
        <span>{getMessage('showDefaultFolderContextMenuItem')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleChange}
            defaultChecked={configStore.putDefaultPathInContextMenu}
            type="checkbox"
            name="putDefaultPathInContextMenu"
          />
          <span className="toggle-slider"></span>
        </span>
      </label>
      <label>
        <span>{getMessage('selectDownloadCategoryOnAddItemFromContextMenu')}</span>
        <span className="toggle-switch">
          <input
            onChange={handleChange}
            defaultChecked={configStore.selectDownloadCategoryAfterPutTorrentFromContextMenu}
            type="checkbox"
            name="selectDownloadCategoryAfterPutTorrentFromContextMenu"
          />
          <span className="toggle-slider"></span>
        </span>
      </label>
    </div>
  );
});

const CtxOptions = observer(() => {
  const { configStore, handleChange } = useOptionsPage<ConfigStore>();

  return (
    <div className="page ctx">
      <h2>{getMessage('optCtx')}</h2>
      <CtxOptionsDirs configStore={configStore} handleChange={handleChange} />
    </div>
  );
});

export default CtxOptions;
