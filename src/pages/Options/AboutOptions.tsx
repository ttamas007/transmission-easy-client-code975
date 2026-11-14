import React from 'react';
import { observer } from 'mobx-react';
import { getMessage } from '../../tools/i18n';

const AboutOptions = observer(() => (
  <div className="page main">
    <h2>{getMessage('about')}</h2>
    <h3>{getMessage('appName')}</h3>
    <p>
      {getMessage('aboutVersion')}: {chrome.runtime.getManifest().version}
    </p>
    <p>{getMessage('aboutLineage')}</p>
    <ul>
      <li>
        {getMessage('aboutForkAuthor')}:{' '}
        <a href="https://github.com/ttamas007" target="_blank" rel="noopener noreferrer">
          ttamas007
        </a>
      </li>
      <li>
        {getMessage('aboutUpstreamAuthor')}:{' '}
        <a href="https://github.com/mthcore" target="_blank" rel="noopener noreferrer">
          mthcore
        </a>
      </li>
      <li>
        {getMessage('aboutOriginalAuthor')}:{' '}
        <a href="https://github.com/Feverqwe" target="_blank" rel="noopener noreferrer">
          Feverqwe
        </a>
      </li>
    </ul>
    <p>
      <a
        href="https://github.com/ttamas007/transmission-easy-client-code975"
        target="_blank"
        rel="noopener noreferrer"
      >
        {getMessage('aboutSource')}
      </a>
    </p>
    <p>
      <a
        href="https://github.com/mthcore/Transmission-Easy-Client"
        target="_blank"
        rel="noopener noreferrer"
      >
        mthcore / Transmission-Easy-Client
      </a>
      {' · '}
      <a href="https://github.com/Feverqwe/Transmission" target="_blank" rel="noopener noreferrer">
        Feverqwe / Transmission
      </a>
    </p>
  </div>
));

export default AboutOptions;
