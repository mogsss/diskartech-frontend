import { Alert, Platform } from 'react-native';

export interface GoogleAuthProfile {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
}

export const GOOGLE_CONFIG = {
  webClientId:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    '895948439637-h30don7ig4h53d8320q4m0e1v1anflpm.apps.googleusercontent.com',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
};

let googleSigninConfigured = false;

function ensureGoogleSigninConfigured() {
  if (googleSigninConfigured) return;
  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSignin.configure({
      webClientId: GOOGLE_CONFIG.webClientId,
      offlineAccess: true,
      forceCodeForRefreshToken: true,
    });
    googleSigninConfigured = true;
  } catch {
    // Native module might not be compiled yet in old dev build
  }
}

/**
 * Perform Native Android Google Play Services Sign-In
 * Triggers the official Android system account sheet on the phone.
 * If native module is not yet compiled into the running APK, returns null gracefully.
 */
export async function promptNativeGoogleSignIn(): Promise<GoogleAuthProfile | null> {
  try {
    const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin');
    ensureGoogleSigninConfigured();

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    // Support both v13+ response.data.user and older response.user
    const user = response?.data?.user || (response as any)?.user;
    if (user) {
      const givenName = user.givenName || user.name?.split(' ')[0] || 'User';
      const familyName =
        user.familyName ||
        (user.name && user.name.split(' ').length > 1
          ? user.name.split(' ').slice(1).join(' ')
          : 'Account');

      return {
        id: user.id || `google_${Date.now()}`,
        email: user.email,
        name: user.name || `${givenName} ${familyName}`,
        firstName: givenName,
        lastName: familyName,
        photoUrl: user.photo || undefined,
      };
    }
  } catch (error: any) {
    if (
      error.code === 'SIGN_IN_CANCELLED' ||
      error.code === '12501' ||
      error.message?.includes?.('canceled') ||
      error.message?.includes?.('cancelled')
    ) {
      // User dismissed the native dialog
      return null;
    }
    console.warn('Native Google Play Services Sign-In:', error?.message || error);
  }
  return null;
}
