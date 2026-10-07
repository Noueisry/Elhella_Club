export interface AuthUser {
  id: string; login: string; fullName: string; role: 'admin' | 'treasurer'; isActive: boolean;
  createdAt: string; updatedAt: string; permissions: string[];
}
export interface AuthSession { user: AuthUser; expiresAt: string }
export const homeFor = (user: AuthUser) => user.role === 'admin' ? '/' : '/members';
