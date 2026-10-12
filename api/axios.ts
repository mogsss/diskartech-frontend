import axios, { CanceledError, isCancel } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

let isLoggingOut = false;

export const BACKEND_URL = 'https://diskartech-backend.onrender.com';
export const STORAGE_URL = `${BACKEND_URL}/storage/`;

function isPublicAuthRequest(url?: string): boolean {
  const path = (url || '')
    .replace(/^https?:\/\/[^/]+/i, '')
    .split(/[?#]/)[0]
    .replace(/\/+$/, '')
    .replace(/^\/api(?=\/)/, '');

  return path === '/login' || path === '/google-login' || path === '/register' || path.startsWith('/register/')
    || ['/password/forgot', '/password/verify-code', '/password/reset'].includes(path);
}

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    // Public authentication requests create the session and do not need a stored token.
    if (isPublicAuthRequest(config.url)) {
      return config;
    }

    const token = await AsyncStorage.getItem('userToken');
    // Screens retained in the navigation stack must not send anonymous refreshes after logout.
    if (!token) throw new CanceledError('No active session.', config);
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (isCancel(error)) return Promise.reject(error);
    const status = error.response?.status;
    const method = error.config?.method?.toUpperCase();
    const url = error.config?.url;
    // Only expire the session that actually made this request. Late responses from
    // a logged-out device/account must not clear a newer login or interrupt registration.
    if (status === 401 && !isPublicAuthRequest(url)) {
      if (isLoggingOut) return Promise.reject(error);
      isLoggingOut = true;
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (token && error.config?.headers?.Authorization === `Bearer ${token}`) {
          await AsyncStorage.multiRemove(['userToken', 'userData', 'userProfile']);
          router.replace('/auth/welcome');
        }
      } catch {
        console.warn('Unable to finish session cleanup.');
      } finally { isLoggingOut = false; }
      return Promise.reject(error);
    }
    // Do not print response bodies: server exceptions may contain credentials.
    console.warn(`[API ${status || 'ERR'}] ${method} ${url}`);
    return Promise.reject(error);
  }
);

export default api;
