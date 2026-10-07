import { createContext, useContext } from 'react';
import type { AuthUser } from '../models/auth';

export interface AuthContextValue {
  user: AuthUser | null; status: 'loading' | 'authenticated' | 'anonymous' | 'error'; error: string; notice: string;
  login: (login: string, password: string) => Promise<void>; logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>; restore: () => Promise<void>;
}
export const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
