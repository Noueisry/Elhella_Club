import type { AuthUser } from './auth';
export type ManagedUser = Omit<AuthUser, 'permissions'>;
export interface UserInput { login: string; fullName: string; password: string; role: ManagedUser['role'] }
export interface UserUpdate { fullName?: string; role?: ManagedUser['role']; isActive?: boolean }
export interface MonthlyRate { id: string; amount: string; effectiveOn: string; createdAt: string }
export interface ReceiptOptions { address?: string | null; phone?: string | null; footer?: string | null }
export interface SettingsInput { clubName: string; businessTimezone: string; receiptOptions: ReceiptOptions }
export interface ClubSettings extends Omit<SettingsInput, 'receiptOptions'> { id: number; currency: 'MRU'; receiptOptions: ReceiptOptions | null; updatedAt: string; updatedByUserId: string | null }
export interface Settings { club: ClubSettings; businessToday: string; currentMonthlyRate: MonthlyRate | null; nextMonthlyRate: MonthlyRate | null }
