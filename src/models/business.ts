export interface Page<T> { items: T[]; total: number; page: number; limit: number }
export type MemberStatus = 'active' | 'inactive';
export interface Member {
  id: string; fullName: string; phone: string; membershipNumber: string; joinedOn: string;
  status: MemberStatus; notes: string | null; archivedAt: string | null; createdAt: string; updatedAt: string;
}
export interface MemberInput { fullName: string; phone: string; membershipNumber: string; joinedOn: string; status: MemberStatus; notes: string | null }
export type MemberUpdate = Pick<MemberInput, 'fullName' | 'phone' | 'membershipNumber' | 'notes'>;
export interface MemberQuery { search?: string; status?: MemberStatus; archived?: 'exclude' | 'include' | 'only'; page: number; limit: number }
export interface Payment {
  id: string; memberId: string; amount: string; paidOn: string; receiptNumber: string;
  category: 'monthly' | 'event' | 'arrears' | 'other'; method: 'cash' | 'transfer' | 'other';
  status: 'posted' | 'cancelled'; notes: string | null; cancellationReason: string | null;
  createdByUserId?: string; member?: { id: string; fullName: string; membershipNumber: string };
  createdBy?: { id: string; fullName: string }; cancelledAt?: string | null; replacesPaymentId?: string | null;
}
export interface Obligation {
  id: string; memberId: string; targetType: 'monthly' | 'event'; dueOn: string; label: string;
  year: number | null; month: number | null; eventId: string | null;
  amount: string; paidAmount: string; remainingAmount: string;
  paymentStatus: 'unpaid' | 'partial' | 'paid'; paymentStatusLabel: string;
  isDue: boolean; isOverdue: boolean; dueStatusLabel: string;
}
export interface Statement {
  member: Member; asOf: string; businessTimezone: string; currency: 'MRU';
  currentMonthlyRate: { amount: string; effectiveOn: string; asOf: string } | null;
  totals: { monthlyDue: string; eventsDue: string; totalDue: string; totalPaid: string; remaining: string;
    monthlyArrears: string; eventArrears: string; arrears: string; financialStatusLabel: string };
  lastPayment: Payment | null; contributions: Page<Obligation>;
}
export interface StatementQuery { page: number; limit: number; maturity: 'all' | 'due' | 'future'; asOf?: string }
export interface ClubEvent { id: string; name: string; type: string; eventOn: string; contributionAmount: string; notes: string | null }
export interface EventInput { name: string; type: string; eventOn: string; contributionAmount: string; notes: string | null; memberIds: string[] }
export type EventUpdate = Omit<EventInput, 'memberIds'>;
export interface EventQuery { search?: string; from?: string; to?: string; page: number; limit: number }
export interface ParticipantQuery { paymentStatus?: Obligation['paymentStatus']; page: number; limit: number }
export interface EventDetail {
  event: ClubEvent; asOf: string; currency: 'MRU';
  summary: { participantCount: number; paidCount: number; partialCount: number; unpaidCount: number; totalDue: string; totalPaid: string; remaining: string };
  participants: Page<Obligation & { fullName: string; membershipNumber: string }>;
}
export interface Dashboard {
  asOf: string; businessTimezone: string; currency: 'MRU'; collectionPeriod: { from: string; toExclusive: string };
  memberCount: number; activeMemberCount: number; inactiveMemberCount: number; membersWhoPaid: number;
  membersWithArrears: number; monthlyCollections: string; totalArrears: string; monthlyArrears: string; eventArrears: string;
}
export interface ArrearsMember extends Pick<Member, 'id' | 'fullName' | 'membershipNumber' | 'phone' | 'status' | 'archivedAt'> {
  monthlyArrears: string; eventArrears: string; arrears: string;
}
export interface ArrearsQuery { search?: string; status?: MemberStatus; category: 'all' | 'monthly' | 'event'; page: number; limit: number }
export interface Arrears extends Page<ArrearsMember> {
  asOf: string; businessTimezone: string; currency: 'MRU'; totals: { monthlyArrears: string; eventArrears: string; totalArrears: string };
}
export type MemberRemoval = { action: 'deleted'; id: string } | { action: 'archived'; member: Member };
