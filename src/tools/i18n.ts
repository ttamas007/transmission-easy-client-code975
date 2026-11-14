import { observable, runInAction } from 'mobx';
import hu from '../_locales/hu/messages.json';
import en from '../_locales/en/messages.json';

export type Language = 'hu' | 'en';
interface Message {
  message: string;
  placeholders?: Record<string, { content: string }>;
}
const catalogs: Record<Language, Record<string, Message>> = { hu, en };
const language = observable.box<Language>('hu');

export function getLanguage(): Language {
  return language.get();
}

export function getLocale(): string {
  return getLanguage() === 'hu' ? 'hu-HU' : 'en-US';
}

export function setLanguage(value: Language): void {
  runInAction(() => language.set(value));
  if (typeof document !== 'undefined') {
    document.documentElement.lang = value;
    document.documentElement.dir = 'ltr';
  }
}

export function getMessage(key: string, substitutions?: string | string[]): string {
  const entry = catalogs[getLanguage()][key];
  if (!entry) return '';
  const values = typeof substitutions === 'string' ? [substitutions] : (substitutions ?? []);
  const substitute = (text: string) =>
    text.replace(/\$(\d+)/g, (_, n: string) => values[Number(n) - 1] ?? '');
  return entry.message.replace(
    /\$\$|\$([a-z_]\w*)\$|\$(\d+)/gi,
    (token, name: string | undefined, index: string | undefined) => {
      if (token === '$$') return '$';
      if (index) return values[Number(index) - 1] ?? '';
      const placeholder = Object.entries(entry.placeholders ?? {}).find(
        ([key]) => key.toLowerCase() === name?.toLowerCase()
      );
      return placeholder ? substitute(placeholder[1].content) : token;
    }
  );
}
