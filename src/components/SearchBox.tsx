import { getMessage } from '../tools/i18n';
import React, {
  useState,
  useRef,
  useCallback,
  ChangeEvent,
  KeyboardEvent,
  MouseEvent,
} from 'react';
import { observer } from 'mobx-react';
import useRootStore from '../hooks/useRootStore';
import ToolbarIcon from './ToolbarIcon';

const SearchBox = observer(() => {
  const rootStore = useRootStore();
  const config = rootStore?.config;
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleToggle = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      setExpanded((prev) => {
        if (!prev) {
          setTimeout(() => inputRef.current?.focus(), 0);
        } else {
          // Collapsing must clear the filter, exactly like Escape: a hidden
          // input kept filtering the list with no visible indicator, and
          // torrents just seemed to be missing
          config?.setSearchQuery('');
        }
        return !prev;
      });
    },
    [config]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      config?.setSearchQuery(e.target.value);
    },
    [config]
  );

  const handleClear = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      config?.setSearchQuery('');
      inputRef.current?.focus();
    },
    [config]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        config?.setSearchQuery('');
        setExpanded(false);
      }
    },
    [config]
  );

  const query = config?.searchQuery || '';

  return (
    <li className={`search ${expanded ? 'expanded' : ''}`}>
      {expanded && (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={getMessage('search')}
          aria-label={getMessage('search')}
        />
      )}
      <a
        onClick={handleToggle}
        title={getMessage('search')}
        aria-label={getMessage('search')}
        className="btn search-icon"
        href="#search"
      >
        <ToolbarIcon name="search" />
      </a>
      {expanded && query && (
        <a
          onClick={handleClear}
          className="btn clear-icon"
          aria-label={getMessage('clearSearch')}
          href="#clear"
        >
          <ToolbarIcon name="clear" />
        </a>
      )}
    </li>
  );
});

export default SearchBox;
