import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLanguage, getLocale, getMessage, setLanguage } from '../i18n';

vi.unmock('../i18n');
afterEach(() => setLanguage('hu'));

describe('application translations', () => {
  it('switches real Hungarian and English text, placeholders and document language', () => {
    setLanguage('hu');
    expect(getMessage('footerActive', '0')).toBe('0 aktív');
    expect(getLocale()).toBe('hu-HU');
    setLanguage('en');
    expect(getMessage('footerActive', '12')).toBe('12 active');
    expect(getMessage('sessionStats', ['12', '7'])).toBe('12 active, 7 paused');
    expect(getMessage('seedTimeLimitConfirm', ['tracker.example', '48', '3'])).toContain(
      'tracker.example'
    );
    expect(getMessage('seedTimeLimitConfirm', ['tracker.example', '48', '3'])).not.toContain('$');
    expect(getMessage('missing-key')).toBe('');
    expect(getLanguage()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('keeps every catalog key and placeholder compatible with the Hungarian base', () => {
    const dir = join(process.cwd(), 'src', '_locales');
    type Entry = { message: string; placeholders?: Record<string, { content: string }> };
    const read = (lang: string): Record<string, Entry> =>
      JSON.parse(readFileSync(join(dir, lang, 'messages.json'), 'utf8'));
    const base = read('hu');
    for (const lang of readdirSync(dir)) {
      const catalog = read(lang);
      expect(Object.keys(catalog), lang).toEqual(Object.keys(base));
      for (const [key, value] of Object.entries(catalog)) {
        expect(value.message.trim(), `${lang}:${key}`).not.toBe('');
        expect(value.placeholders ?? {}, `${lang}:${key}`).toEqual(base[key].placeholders ?? {});
        for (const token of value.message.matchAll(/\$([a-z_]\w*)\$/gi)) {
          expect(
            Object.keys(value.placeholders ?? {}).map((k) => k.toLowerCase()),
            `${lang}:${key}`
          ).toContain(token[1].toLowerCase());
        }
      }
    }
  });
});
