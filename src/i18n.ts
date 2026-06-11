import {notFound} from 'next/navigation';
import {getRequestConfig} from 'next-intl/server';

export const locales = ['en', 'th'];
export const defaultLocale = 'th';

export default getRequestConfig(async (config) => {
  // In next-intl 3.x/4.x, the parameter name is requestLocale (a Promise)
  let requestLocale = (config as any).requestLocale;
  let locale = requestLocale ? await requestLocale : (config as any).locale;

  // Fallback to default if undefined
  if (!locale) {
    locale = defaultLocale;
  }

  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as any)) notFound();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
