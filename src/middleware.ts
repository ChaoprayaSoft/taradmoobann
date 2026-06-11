import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';

export default createMiddleware({
  // A list of all locales that are supported
  locales,
 
  // Used when no locale matches
  defaultLocale,
  
  // Optional: keep the locale in the URL
  localePrefix: 'always'
});
 
export const config = {
  // Match only internationalized pathnames
  // We exclude /api, /_next, etc. so they are not affected by middleware
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
