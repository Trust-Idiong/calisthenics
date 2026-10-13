import {AUTH_CONFIG} from './auth-config.js';

// Official modular SDK only; no analytics, Firestore, custom token/password
// storage or invented cloud sessions. The imports are lazy so the offline
// workout shell can load with no connection to Firebase.
// https://firebase.google.com/docs/web/alt-setup
export const FIREBASE_SDK_VERSION = '13.0.0';
export class AuthError extends Error {
  constructor(code, message) { super(message); this.name = 'AuthError'; this.code = code; }
}

const ERROR_MESSAGES = Object.freeze({
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/weak-password': 'Use a password with at least 8 characters that meets the account password policy.',
  'auth/password-does-not-meet-requirements': 'That password does not meet the account password policy. Choose a stronger password.',
  'auth/invalid-credential': 'The email or password could not be verified. Try again or reset your password.',
  'auth/wrong-password': 'The email or password could not be verified. Try again or reset your password.',
  'auth/user-not-found': 'The email or password could not be verified. Try again or reset your password.',
  'auth/email-already-in-use': 'This email cannot create a new account. Try signing in or resetting your password.',
  'auth/user-disabled': 'This account is unavailable. Contact app support.',
  'auth/too-many-requests': 'Too many attempts. Wait a little before trying again.',
  'auth/network-request-failed': 'Connect to the internet and try again. Your local workout records are unchanged.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled. You can try again or sign in with email.',
  'auth/cancelled-popup-request': 'Another Google sign-in window is already open. Complete that window first.',
  'auth/popup-blocked': 'Allow the Google sign-in window in your browser, then try again. Email sign-in is also available.',
  'auth/unauthorized-domain': 'This website has not been authorized for sign-in by the app owner.',
  'auth/operation-not-allowed': 'This sign-in method has not been enabled by the app owner.',
  'auth/invalid-api-key': 'The app owner needs to finish the sign-in service configuration.',
  'auth/app-not-authorized': 'The app owner needs to authorize this app with the sign-in service.',
  'auth/account-exists-with-different-credential': 'Use the original sign-in method for this email address.',
  'auth/requires-recent-login': 'Sign in again before deleting your account, then retry deletion.',
  'auth/web-storage-unsupported': 'This browser cannot keep the sign-in session. Allow site storage or use another browser.',
  'auth/unsupported-persistence-type': 'This browser cannot keep the requested sign-in session. Use another browser.'
});

export function authError(error) {
  if (error instanceof AuthError) return error;
  const code = typeof error?.code === 'string' && /^auth\/[a-z-]+$/.test(error.code) ? error.code : 'auth/unavailable';
  // Provider messages can contain account data and internal request details.
  // Present only a known, safe message and never retain the original error.
  return new AuthError(code, ERROR_MESSAGES[code] || 'Sign-in could not complete. Try again when you are online.');
}

export function validateAuthConfig(value) {
  if (!value || value.provider !== 'firebase' || !value.firebase) return null;
  const input = value.firebase;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AuthError('auth/configuration', 'The app owner needs to provide a valid public Firebase Web configuration.');
  if (Object.keys(input).some(key => /private|secret|service.?account|password|refresh.?token/i.test(key))) throw new AuthError('auth/configuration', 'Only public Firebase Web configuration belongs in the browser.');
  const config = {};
  for (const field of ['apiKey', 'authDomain', 'projectId', 'appId']) {
    const entry = input[field];
    if (typeof entry !== 'string' || !entry.trim() || entry.length > 300 || /REPLACE|YOUR_|PLACEHOLDER|BEGIN .*PRIVATE KEY/i.test(entry)) throw new AuthError('auth/configuration', 'The app owner needs to finish the public Firebase Web configuration.');
    config[field] = entry.trim();
  }
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z0-9-]+$/i.test(config.authDomain) || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId)) throw new AuthError('auth/configuration', 'The Firebase project or authentication domain is invalid.');
  if (!['local', 'session', 'none'].includes(value.persistence ?? 'local')) throw new AuthError('auth/configuration', 'Choose a supported sign-in persistence mode.');
  return Object.freeze({firebase: Object.freeze(config), persistence: value.persistence ?? 'local', googleEnabled: value.googleEnabled !== false});
}

function emailAddress(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new AuthError('auth/invalid-email', ERROR_MESSAGES['auth/invalid-email']);
  return value.trim();
}

function passwordValue(value, signup = false) {
  if (typeof value !== 'string' || value.length === 0) throw new AuthError('auth/missing-password', ERROR_MESSAGES['auth/missing-password']);
  if (value.length > 4096 || (signup && value.length < 8)) throw new AuthError('auth/weak-password', ERROR_MESSAGES['auth/weak-password']);
  return value;
}

function publicSession(user) {
  if (!user || typeof user.uid !== 'string' || !user.uid) return null;
  return Object.freeze({
    uid: user.uid,
    email: typeof user.email === 'string' ? user.email : null,
    displayName: typeof user.displayName === 'string' ? user.displayName : '',
    emailVerified: user.emailVerified === true,
    provider: 'firebase'
  });
}

async function officialSdk() {
  const [app, auth] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js')
  ]);
  return {...app, ...auth};
}

export function initAuth(win, options = {}) {
  let configuration = null, configurationError = null;
  try { configuration = validateAuthConfig(options.config ?? AUTH_CONFIG); }
  catch (error) { configurationError = authError(error); }
  const supported = !!(win?.document && win?.location && ['http:', 'https:'].includes(win.location.protocol));
  const loadSdk = options.loadSdk || officialSdk;
  let sdk = null, auth = null, initialization = null, unsubscribe = null, session = null, disposed = false;
  let status = configurationError ? 'error' : !configuration ? 'unconfigured' : !supported ? 'unsupported' : win.navigator?.onLine === false ? 'offline' : 'idle';

  function notifyError(error) { try { options.onError?.(error); } catch {} }
  function emit(user) {
    if (disposed) return;
    session = publicSession(user);
    try { options.onSessionChanged?.(session); } catch {}
  }
  function available(requireNetwork = true) {
    if (disposed) throw new AuthError('auth/disposed', 'The sign-in session has closed. Reload the app to continue.');
    if (configurationError) throw configurationError;
    if (!configuration) throw new AuthError('auth/not-configured', 'Account sign-in is not connected yet. The app owner must configure the authentication service.');
    if (!supported) throw new AuthError('auth/unsupported', 'Use the app in an HTTPS browser or localhost to sign in.');
    if (requireNetwork && win.navigator?.onLine === false) throw new AuthError('auth/offline', 'Connect to the internet to sign in or manage an account. Local workouts remain available.');
  }
  async function initialize() {
    available();
    if (sdk && auth && status === 'ready') return;
    if (initialization) return initialization;
    status = 'loading';
    initialization = (async () => {
      try {
        const loaded = await loadSdk();
        available();
        const name = 'form-auth';
        const existing = loaded.getApps().find(app => app.name === name);
        if (existing && existing.options?.projectId !== configuration.firebase.projectId) throw new AuthError('auth/configuration', 'The configured authentication project changed. Reload before signing in.');
        const app = existing || loaded.initializeApp(configuration.firebase, name);
        const client = loaded.getAuth(app);
        client.useDeviceLanguage?.();
        const persistence = {local: loaded.browserLocalPersistence, session: loaded.browserSessionPersistence, none: loaded.inMemoryPersistence}[configuration.persistence];
        await loaded.setPersistence(client, persistence);
        available();
        sdk = loaded; auth = client;
        await new Promise((resolve, reject) => {
          unsubscribe?.();
          unsubscribe = loaded.onAuthStateChanged(client, user => { status = 'ready'; emit(user); resolve(); }, error => reject(error));
        });
      } catch (error) {
        unsubscribe?.(); unsubscribe = null; sdk = null; auth = null;
        const safe = authError(error); status = safe.code === 'auth/offline' ? 'offline' : 'error';
        throw safe;
      } finally { initialization = null; }
    })();
    return initialization;
  }
  async function operation(action, {network = true} = {}) {
    try { available(network); await initialize(); available(network); return await action(sdk, auth); }
    catch (error) { throw authError(error); }
  }
  function requireUser(client) {
    if (!client.currentUser) throw new AuthError('auth/not-signed-in', 'Sign in before managing your account.');
    return client.currentUser;
  }
  function handleOnline() { if (!disposed && configuration && supported) initialize().catch(notifyError); }
  win?.addEventListener?.('online', handleOnline);
  if (configurationError) notifyError(configurationError);
  if (configuration && supported && win.navigator?.onLine !== false) initialize().catch(notifyError);

  return Object.freeze({
    provider: 'firebase',
    configured: !!configuration && !configurationError,
    supported,
    googleEnabled: !!configuration?.googleEnabled,
    getSession: () => session,
    getStatus: () => status,
    // Unconfigured/offline boot can still render the local workout shell.
    ready: async () => {
      if (!configuration || !supported || win.navigator?.onLine === false) return null;
      await initialize(); return session;
    },
    signUp: (email, password, displayName = '') => operation(async (api, client) => {
      const address = emailAddress(email), secret = passwordValue(password, true);
      if (typeof displayName !== 'string' || displayName.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(displayName)) throw new AuthError('auth/invalid-name', 'Use a display name with up to 80 characters.');
      const result = await api.createUserWithEmailAndPassword(client, address, secret);
      // A profile-write failure does not undo an account already created.
      if (displayName.trim()) {
        try { await api.updateProfile(result.user, {displayName: displayName.trim()}); }
        catch { notifyError(new AuthError('auth/profile-not-saved', 'Your account was created, but its display name could not be saved.')); }
      }
      emit(result.user); return session;
    }),
    signIn: (email, password) => operation(async (api, client) => {
      const result = await api.signInWithEmailAndPassword(client, emailAddress(email), passwordValue(password));
      emit(result.user); return session;
    }),
    resetPassword: email => operation(async (api, client) => {
      await api.sendPasswordResetEmail(client, emailAddress(email));
      return {requested: true};
    }),
    signInGoogle: () => operation(async (api, client) => {
      if (!configuration.googleEnabled) throw new AuthError('auth/operation-not-allowed', ERROR_MESSAGES['auth/operation-not-allowed']);
      const provider = new api.GoogleAuthProvider();
      provider.setCustomParameters({prompt: 'select_account'});
      // Popup avoids the cross-origin redirect storage problem on GitHub Pages.
      // https://firebase.google.com/docs/auth/web/redirect-best-practices
      const result = await api.signInWithPopup(client, provider);
      emit(result.user); return session;
    }),
    sendVerificationEmail: () => operation(async (api, client) => {
      await api.sendEmailVerification(requireUser(client)); return {requested: true};
    }),
    signOut: async () => {
      if (!configuration) { session = null; return; }
      try {
        available(false);
        if (!sdk || !auth) {
          if (win.navigator?.onLine === false) throw new AuthError('auth/offline', 'Reconnect to finish signing out of the saved account session.');
          await initialize();
        }
        await sdk.signOut(auth); emit(null);
      } catch (error) { throw authError(error); }
    },
    deleteAccount: () => operation(async (api, client) => {
      await api.deleteUser(requireUser(client)); emit(null);
      return {deleted: true};
    }),
    dispose: () => { disposed = true; unsubscribe?.(); win?.removeEventListener?.('online', handleOnline); }
  });
}
