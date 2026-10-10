import axios from 'axios';
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

  return path === '/login' || path === '/google-login' || path === '/register' || path.startsWith('/register/');
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

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.warn('No userToken found in AsyncStorage for request:', config.url);
      }
    } catch (error) {
      console.error('Error fetching token from storage:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const method = error.config?.method?.toUpperCase();
    const url = error.config?.url;
    console.warn(`⚠️ [API ${status || 'ERR'}] ${method} ${url}:`, error.response?.data || error.message);

    // Kapag 401 (Unauthenticated), i-clear ang expired token at awtomatikong ibalik sa login
    if (status === 401 && !isPublicAuthRequest(url)) {
      if (!isLoggingOut) {
        isLoggingOut = true;
        console.log('🔄 Session expired or invalid token. Redirecting to login...');
        try {
          await AsyncStorage.multiRemove(['userToken', 'userData', 'userProfile']);
          router.replace('/auth/welcome');
        } catch (e) {
          console.error('Error during auto-logout:', e);
        } finally {
          setTimeout(() => {
            isLoggingOut = false;
          }, 3000);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
