import React from 'react';

const shapes = {
  refresh: (
    <>
      <path d="M20 10a8 8 0 1 0-2 8" />
      <path d="M20 4v6h-6" />
    </>
  ),
  web: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 9v11" />
      <path d="m13 13 3 2-3 2" />
    </>
  ),
  file: (
    <>
      <path fill="currentColor" fillOpacity=".12" d="M5 3h9l5 5v13H5Z" />
      <path d="M14 3v5h5M19 11V8l-5-5H5v18h7" />
      <path className="toolbar-icon-positive" d="M18 14v8m-4-4h8" />
    </>
  ),
  magnet: (
    <>
      <path d="M5 4v9a7 7 0 0 0 14 0V4h-5v9a2 2 0 0 1-4 0V4Z" />
      <path d="M5 8h5m4 0h5" />
    </>
  ),
  speed: (
    <>
      <path d="M4 19a10 10 0 1 1 16 0M5 12h2m10 0h2M8 6l1 2m7-2-1 2" />
      <path d="m12 13 5-5M8 20h8" />
      <circle cx="12" cy="13" r="1" />
    </>
  ),
  start: (
    <>
      <path fill="currentColor" stroke="none" d="m7 4 13 8L7 20Z" />
      <path d="M3 5v14" />
    </>
  ),
  pause: (
    <>
      <rect x="5" y="4" width="5" height="16" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="5" height="16" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 6 6" />
    </>
  ),
  clear: <path d="m6 6 12 12M6 18 18 6" />,
};

export default function ToolbarIcon({ name }: { name: keyof typeof shapes }) {
  return (
    <svg
      className="toolbar-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[name]}
    </svg>
  );
}
