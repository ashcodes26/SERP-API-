const key = 'aimora.session.v1';
export async function readSession(): Promise<string | null> { return window.sessionStorage.getItem(key); }
export async function saveSession(token: string | null) {
  if (token) window.sessionStorage.setItem(key, token);
  else window.sessionStorage.removeItem(key);
}
