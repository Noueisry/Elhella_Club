const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const businessTimezone = import.meta.env.VITE_BUSINESS_TIMEZONE ?? 'Africa/Nouakchott';
const loginDomain = import.meta.env.VITE_AUTH_LOGIN_DOMAIN ?? 'club.invalid';
let configurationError = '';
try {
  const url = new URL(supabaseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
  if (!supabaseKey || supabaseKey.startsWith('sb_secret_')) throw new Error();
  if (supabaseKey.startsWith('eyJ')) {
    const payload = JSON.parse(atob(supabaseKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.role !== 'anon') throw new Error();
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(loginDomain)) throw new Error();
  new Intl.DateTimeFormat('ar-MR', { timeZone: businessTimezone }).format();
} catch {
  configurationError = 'يجب إعداد رابط Supabase والمفتاح العام في ملف البيئة قبل الاتصال.';
}
export const env = Object.freeze({ supabaseUrl, supabaseKey, businessTimezone, loginDomain, configurationError });
