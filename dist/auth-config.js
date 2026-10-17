// Django serves this PWA and its API on one HTTPS origin on Render.
// No database password, Django SECRET_KEY or session token belongs here.
export const AUTH_CONFIG = Object.freeze({provider:'django',apiBaseUrl:'/api/',requireAccounts:true});
