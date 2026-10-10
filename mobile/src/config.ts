/** Client configuration. Only EXPO_PUBLIC_* variables are bundled; never place provider keys here. */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');
export const API_TIMEOUT_MS = 15000;
