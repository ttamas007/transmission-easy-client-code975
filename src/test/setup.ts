import '@testing-library/jest-dom';
import './chromeMock';
import { vi } from 'vitest';

vi.mock('../tools/i18n', () => ({
  getMessage: (key: string, substitutions?: string | string[]) =>
    chrome.i18n.getMessage(key, substitutions),
  getLanguage: () => 'hu',
  getLocale: () => 'en-US',
  setLanguage: vi.fn(),
}));
