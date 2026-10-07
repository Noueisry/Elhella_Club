import { navigation } from '../models/navigation';

export function mayRestoreRoute(destination: unknown, permissions: string[]): destination is string {
  if (typeof destination !== 'string' || !destination.startsWith('/') || destination.startsWith('//') || destination.includes('\\')) return false;
  const path = destination.split('?')[0]!;
  const required = navigation.find((item) => item.path === path)?.permission
    ?? (/^\/members\/[a-f0-9-]{36}$/i.test(path) ? 'members.read' : undefined)
    ?? (/^\/members\/[a-f0-9-]{36}\/report$/i.test(path) ? 'members.read' : undefined)
    ?? (/^\/events\/[a-f0-9-]{36}$/i.test(path) ? 'events.manage' : undefined)
    ?? (path === '/payments/new' ? 'payments.create' : undefined)
    ?? (/^\/payments\/[a-f0-9-]{36}$/i.test(path) ? 'payments.read' : undefined)
    ?? (/^\/payments\/[a-f0-9-]{36}\/receipt$/i.test(path) ? 'receipts.read' : undefined)
    ?? (/^\/payments\/[a-f0-9-]{36}\/replace$/i.test(path) ? 'payments.correct' : undefined)
    ?? (path === '/account/password' ? 'profile' : undefined);
  return Boolean(required && permissions.includes(required));
}
