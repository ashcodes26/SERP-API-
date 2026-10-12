import type { AccountOut } from '@/types/contracts';

export function permittedPath(role: AccountOut['role'], path: string) {
  path = path.split('?')[0];
  if (role === 'admin') return ['/admin', '/admin-import'].includes(path);
  return ['/', '/jobs', '/market', '/resume', '/linkedin', '/placement'].includes(path);
}
export const homePath = (role: AccountOut['role']) => role === 'admin' ? '/admin' : '/';
