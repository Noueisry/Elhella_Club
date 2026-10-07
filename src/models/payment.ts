import type { Page, Payment } from './business';
export type PaymentCategory = Payment['category'];
export type PaymentMethod = Payment['method'];
export interface AllocationInput { targetType: 'monthly' | 'event'; contributionId: string; amount: string }
export interface PaymentInput {
  memberId: string; amount: string; paidOn: string; category: PaymentCategory; method: PaymentMethod;
  notes: string | null; allocationMode: 'oldest_due' | 'explicit'; allocations?: AllocationInput[]; idempotencyKey: string;
}
export interface PaymentRequest { input: PaymentInput; replacementId?: string; reason?: string }
export interface ReceiptAllocation extends AllocationInput { label: string; dueOn: string; year: number | null; month: number | null }
export interface PaymentPreview {
  amount: string; paidOn: string; currency: 'MRU'; indicative: true; remainingBefore: string; remainingAfter: string;
  allocations: (ReceiptAllocation & { remainingBefore: string; remainingAfter: string })[];
}
export interface Allocation { id: string; memberId: string; paymentId: string; amount: string; monthlyContributionId: string | null; eventContributionId: string | null }
export interface PaymentDetail { payment: Payment; allocations: Allocation[]; replacementPaymentId: string | null; replayed?: boolean }
export interface Receipt {
  receiptNumber: string; isValid: boolean; status: Payment['status']; statusLabel: string; replacementPaymentId: string | null;
  cancellation: { at: string; byUserId: string; reason: string } | null;
  snapshot: { clubName: string; memberName: string; memberNumber?: string; amount: string; currency: 'MRU'; category: PaymentCategory; method?: PaymentMethod;
    paymentDate: string; remainingBalance: string; allocations: ReceiptAllocation[]; options?: { phone?: string | null; address?: string | null; footer?: string | null } | null };
}
export interface PaymentQuery { page: number; limit: number; search?: string; memberId?: string; from?: string; to?: string; category?: PaymentCategory; method?: PaymentMethod; status?: Payment['status'] }
export type PaymentPage = Page<Payment>;
