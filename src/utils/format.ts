import { env } from '../config/env';

export function formatBusinessDate(date: Date = new Date(), timezone: string = env.businessTimezone): string {
  return new Intl.DateTimeFormat('ar-MA', {
    numberingSystem: 'latn',
    dateStyle: 'long',
    timeZone: timezone,
  }).format(date);
}
