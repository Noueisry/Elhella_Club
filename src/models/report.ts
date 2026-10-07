import type { Page, Obligation } from './business';
export type ReportKind = 'daily' | 'monthly' | 'annual' | 'events' | 'arrears' | 'statement';
export const reportTitles: Record<ReportKind, string> = { daily: 'التقرير اليومي', monthly: 'التقرير الشهري', annual: 'التقرير السنوي', events: 'تقرير الدورات', arrears: 'تقرير المتأخرات', statement: 'كشف حساب المنتسب' };
export interface ReportQuery { date?: string; month?: string; year?: number; from?: string; to?: string; asOf?: string; memberId?: string; eventId?: string; recordedBefore?: string; page?: number; limit?: number; paymentPage?: number; paymentLimit?: number }
export interface FinancialSummary { due: string; paid: string; remaining: string; monthlyDue: string; eventsDue: string; monthlyRemaining: string; eventRemaining: string; count: number; paidCount: number; partialCount: number; unpaidCount: number }
export interface Report {
  meta: { kind: ReportKind; title: string; from: string; to: string; asOf: string; recordedBefore: string; generatedAt: string; businessTimezone: string; currency: 'MRU'; clubName: string; basisLabel: string; member: { id: string; fullName: string; membershipNumber: string } | null; event: { id: string; name: string } | null };
  totals: { dueInPeriod: FinancialSummary; stock: FinancialSummary; future: FinancialSummary; collectionsInPeriod: string; collectionCount: number };
  contributions: Page<Obligation & { memberName: string; membershipNumber: string }>;
  arrears: Page<{ id: string; memberName: string; membershipNumber: string; monthlyArrears: string; eventArrears: string; totalArrears: string }>;
  payments: Page<{ id: string; receiptNumber: string; paidOn: string; amount: string; originalAmount: string; memberId: string; memberName: string; authorName: string; category: 'monthly' | 'event' | 'arrears' | 'other'; method: 'cash' | 'transfer' | 'other'; status: 'posted' | 'cancelled'; cancellationReason: string | null }>;
}
