// Firebase Web configuration contains public identifiers, not admin credentials.
// Copy the real Web App config from your Firebase project after enabling
// Email/Password and Google in Authentication and authorizing this host.
// https://firebase.google.com/docs/web/learn-more#config-object
// https://firebase.google.com/docs/auth/web/password-auth
// https://firebase.google.com/docs/auth/web/google-signin
// Never put service-account JSON, private keys, or user passwords in this file.
// null deliberately leaves cloud authentication unavailable; it is not a demo.
export const AUTH_CONFIG = Object.freeze({
  provider: 'firebase',
  firebase: null,
  googleEnabled: true,
  persistence: 'local'
});
