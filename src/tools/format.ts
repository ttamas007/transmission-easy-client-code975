import { getMessage } from './i18n';
import { filesize } from 'filesize';

export const formatBytes = (bytes: number): string => {
  const sizeList: string[] = JSON.parse(getMessage('sizeList'));
  return filesize(bytes, { fullform: true, fullforms: sizeList }) as string;
};

export const formatSpeed = (bytes: number): string => {
  const sizePsList: string[] = JSON.parse(getMessage('sizePsList'));
  return filesize(bytes, { fullform: true, fullforms: sizePsList }) as string;
};

export function speedToStr(speed: number): string {
  if (!Number.isFinite(speed)) {
    return '';
  }
  return formatSpeed(speed);
}
