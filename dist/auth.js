import {AUTH_CONFIG} from './auth-config.js';
export class AuthError extends Error {
 constructor(code,message,status=0,details=null){super(message);this.name='AuthError';this.code=code;this.status=status;this.details=details;}
}
const SESSION_KEY='form.auth.last-user.v1';
const identity=user=>{
 if(!user||typeof user.uid!=='string'||user.uid.length<1||user.uid.length>100||/[^a-zA-Z0-9_.-]/.test(user.uid))return null;
 return Object.freeze({uid:user.uid,email:typeof user.email==='string'?user.email:null,displayName:typeof user.displayName==='string'?user.displayName.slice(0,80):'',emailVerified:user.emailVerified===true,isAdmin:user.isAdmin===true,provider:'django',offline:user.offline===true});
};
export function validateAuthConfig(config,win){
 if(config&&Object.keys(config).some(key=>/secret|password|token|database_?url|service.?account|private/i.test(key)))throw new AuthError('auth/configuration','Only public account-server settings belong in the frontend.');
 if(!config||config.provider!=='django'||!config.apiBaseUrl)return null;
 const base=new URL(config.apiBaseUrl,win.location.origin);
 if(base.origin!==win.location.origin||!['https:','http:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw new AuthError('auth/configuration','Open FORM at its account-server address to sign in securely.');
 if(!base.pathname.endsWith('/'))base.pathname+='/';
 return {base:base.href,requireAccounts:config.requireAccounts!==false};
}
export function initAuth(win,options={}){
 let configuration=null,configError=null;try{configuration=validateAuthConfig(options.config??AUTH_CONFIG,win);}catch(e){configError=e;}
 const fetcher=options.fetch||win.fetch?.bind(win),supported=!!fetcher,abort=new AbortController();
 let session=null,csrf='',status=configError?'error':configuration?'idle':'unconfigured',initialization=null,disposed=false;
 function emit(user){if(disposed)return;session=identity(user);try{if(session){win.localStorage.setItem(SESSION_KEY,JSON.stringify({...session,isAdmin:false,offline:true}));}else win.localStorage.removeItem(SESSION_KEY);}catch{}try{options.onSessionChanged?.(session);}catch{}}
 function restoreOffline(){if(session)session=Object.freeze({...session,isAdmin:false,offline:true});try{const cached=identity(JSON.parse(win.localStorage.getItem(SESSION_KEY)));if(cached)session=Object.freeze({...cached,isAdmin:false,offline:true});}catch{}return session;}
 function fail(code,message,httpStatus=0,details=null){return new AuthError(code,message,httpStatus,details);}
 async function request(path,{method='GET',body,skipReady=false,expectedUid}={}){
  if(disposed)throw fail('auth/disposed','The account connection has closed. Reload FORM.');
  if(configError)throw configError;
  if(!configuration||!fetcher)throw fail('auth/unconfigured','The account server is not connected at this address.');
  if(win.navigator?.onLine===false)throw fail('auth/offline','Reconnect to the internet to use your account. Your device records are kept.');
  if(!skipReady&&!csrf&&method!=='GET')await ready();
  const destination=new URL(path,configuration.base);if(destination.origin!==win.location.origin||!destination.pathname.startsWith(new URL(configuration.base).pathname))throw fail('auth/configuration','This account request is outside the configured API.');
  let response;try{response=await fetcher(destination.href,{method,credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRFToken':csrf}:{}),...(expectedUid?{'X-FORM-User':expectedUid}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:typeof AbortSignal.any==='function'?AbortSignal.any([abort.signal,AbortSignal.timeout(25000)]):abort.signal});}catch{throw fail('auth/network','The account server could not be reached. Your local records are kept.');}
  let data=null;try{data=response.status===204?null:await response.json();}catch{if(response.status===404||response.ok)status='unavailable';throw fail('auth/unavailable','The account server is not available at this address yet.',response.status);}
  if(typeof data?.csrfToken==='string'&&data.csrfToken.length<=256)csrf=data.csrfToken;
  if(!response.ok){if(response.status===404&&path.startsWith('auth/'))status='unavailable';const code=typeof data?.code==='string'&&data.code.length<=81&&/^[a-z]/.test(data.code)&&! /[^a-z0-9_/.-]/.test(data.code)?data.code:response.status===401?'auth/session-expired':response.status===403?'auth/permission-denied':response.status===409?'cloud/conflict':'auth/request-failed';const message=typeof data?.message==='string'&&data.message.length<=700?data.message:response.status===429?'Too many attempts. Please wait before trying again.':'The request could not complete. Try again.';throw fail(code,message,response.status,response.status===409?data:null);}
  return data;
 }
 async function ready(){
  if(disposed)return null;if(initialization)return initialization;
  if(!configuration||configError||!fetcher)return null;
  if(win.navigator?.onLine===false){status='offline';return restoreOffline();}
  initialization=(async()=>{try{const data=await request('auth/session/',{skipReady:true});status='ready';emit(data?.user||null);return session;}catch(error){status=error.code==='auth/unavailable'?'unavailable':'offline';if(status==='offline')restoreOffline();try{options.onError?.(error);}catch{}return session;}finally{initialization=null;}})();return initialization;
 }
 function requireEmail(email){if(typeof email!=='string'||email.length>254)throw fail('auth/invalid-email','Enter a valid email address.');const address=email.trim();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address))throw fail('auth/invalid-email','Enter a valid email address.');return address;}
 function requirePassword(password,signup=false){if(typeof password!=='string'||password.length>256||password.length<(signup?10:1))throw fail('auth/invalid-password',signup?'Use a password with at least 10 characters.':'Enter your password.');return password;}
 function confirmation(data){if(data?.confirmationRequired!==true||typeof data.challengeId!=='string'||data.challengeId.length<1||data.challengeId.length>100||/[^a-zA-Z0-9_.-]/.test(data.challengeId))throw fail('auth/invalid-response','The account server did not provide a valid email confirmation.');return {confirmationRequired:true,challengeId:data.challengeId,maskedEmail:typeof data.maskedEmail==='string'?data.maskedEmail.slice(0,254):'your email',expiresAt:data.expiresAt,resendAfter:data.resendAfter};}
 async function accountOperation(path,body){const data=await request(path,{method:'POST',body});status='confirmation';return confirmation(data);}
 const online=()=>{ready();};win.addEventListener?.('online',online);
 return Object.freeze({
  get configured(){return !!configuration&&!configError&&status!=='unavailable';},get supported(){return supported;},provider:'django',requiresAccounts:(options.config??AUTH_CONFIG).requireAccounts!==false,googleEnabled:false,
  getStatus:()=>status,getSession:()=>session,ready,request,
  signUp:(email,password,displayName='',trackingConsent=false)=>{if(!trackingConsent)return Promise.reject(fail('auth/consent-required','Please agree to progress storage and owner monitoring before creating an account.'));if(typeof displayName!=='string'||displayName.trim().length>80)return Promise.reject(fail('auth/invalid-name','Use a name with up to 80 characters.'));return accountOperation('auth/signup/',{email:requireEmail(email),password:requirePassword(password,true),displayName:displayName.trim(),trackingConsent:true});},
  signIn:(email,password)=>accountOperation('auth/login/',{email:requireEmail(email),password:requirePassword(password)}),
  resendConfirmation:async challengeId=>confirmation(await request('auth/resend-confirmation/',{method:'POST',body:{challengeId}})),
  confirmEmail:async(challengeId,token)=>{const data=await request('auth/confirm-email/',{method:'POST',body:{challengeId,token}});const user=identity(data?.user);if(!user||!user.emailVerified)throw fail('auth/invalid-response','Email confirmation did not establish a verified account session.');status='ready';emit(user);return session;},
  resetPassword:email=>request('auth/password-reset/',{method:'POST',body:{email:requireEmail(email)}}),
  confirmPasswordReset:({uid,token,password})=>request('auth/password-reset-confirm/',{method:'POST',body:{uid,token,password:requirePassword(password,true)}}),
  signOut:async()=>{await request('auth/logout/',{method:'POST',body:{}});emit(null);},
  deleteAccount:async password=>{await request('auth/delete-account/',{method:'POST',body:{password:requirePassword(password)}});emit(null);return {deleted:true};},
  dispose:()=>{disposed=true;abort.abort();win.removeEventListener?.('online',online);}
 });
}
