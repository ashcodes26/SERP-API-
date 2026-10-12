import * as SecureStore from 'expo-secure-store';
const key = 'aimora.session.v1';
export const readSession = () => SecureStore.getItemAsync(key);
export async function saveSession(token: string | null) {
  if (token) await SecureStore.setItemAsync(key, token);
  else await SecureStore.deleteItemAsync(key);
}
