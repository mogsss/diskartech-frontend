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
let pendingGoogleSignIn: Promise<GoogleAuthProfile | null> | null = null;

function ensureGoogleSigninConfigured() {
  if (googleSigninConfigured) return;
  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSignin.configure({
      webClientId: GOOGLE_CONFIG.webClientId,
      // Login only uses the account profile; no server refresh-token flow is used.
      offlineAccess: false,
      forceCodeForRefreshToken: false,
    });
    googleSigninConfigured = true;
  } catch {
    // Native module might not be compiled yet in old dev build
  }
}

/**
 * Perform Native Android Google Play Services Sign-In
 * Triggers the official Android system account sheet on the phone.
 * Returns null only when the user cancels. Native errors are reported without provider data.
 */
export function promptNativeGoogleSignIn(options: { selectAccount?: boolean } = {}): Promise<GoogleAuthProfile | null> {
  // A second tap or another screen must not launch another native sign-in activity.
  if (pendingGoogleSignIn) return pendingGoogleSignIn;
  const request = performNativeGoogleSignIn(options.selectAccount !== false);
  pendingGoogleSignIn = request;
  const release = () => {
    if (pendingGoogleSignIn === request) pendingGoogleSignIn = null;
  };
  void request.then(release, release);
  return request;
}

async function performNativeGoogleSignIn(selectAccount: boolean): Promise<GoogleAuthProfile | null> {
  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    ensureGoogleSigninConfigured();

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Every interactive Google sign-in opens account selection by default.
    // This leaves the registration form intact until a new selection succeeds.
    if (selectAccount) await GoogleSignin.signOut();
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
    throw new Error('Google sign-in is unavailable right now. Please try again or register with email instead.');
  }
  return null;
}
