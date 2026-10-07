import type { PaymentRequest } from '../models/payment';
const key = (userId: string) => `smd:pending-payment:${userId}`;
// A submitted request only. No credentials, automatic posting or cross-account restore.
export function readPendingPayment(userId: string): PaymentRequest | undefined {
  try {
    const raw = sessionStorage.getItem(key(userId));
    if (!raw) return undefined;
    const value = JSON.parse(raw) as PaymentRequest;
    return value?.input?.idempotencyKey && value.input.memberId && typeof value.input.amount === 'string' ? value : undefined;
  } catch { return undefined; }
}
export function savePendingPayment(userId: string, request: PaymentRequest) { sessionStorage.setItem(key(userId), JSON.stringify(request)); }
export function clearPendingPayment(userId: string) { sessionStorage.removeItem(key(userId)); }
