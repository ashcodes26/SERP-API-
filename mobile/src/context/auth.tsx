import { createContext, useContext } from 'react';
import type { AccountOut, AuthSessionOut } from '@/types/contracts';
export interface AuthState { account: AccountOut | null; opening: boolean; error: string; retry: () => void; accept: (result: AuthSessionOut) => Promise<void>; logout: () => Promise<void> }
export const AuthContext = createContext<AuthState | null>(null);
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('Auth provider is unavailable'); return value; }
