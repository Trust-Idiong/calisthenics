import test from 'node:test';
import assert from 'node:assert/strict';
import {AuthError,initAuth,validateAuthConfig} from '../dist/auth.js';

const CONFIG=Object.freeze({provider:'django',apiBaseUrl:'/api/',requireAccounts:true});
const SESSION_KEY='form.auth.last-user.v1';
const USER=Object.freeze({uid:'account-alice',email:'alice@example.test',displayName:'Alice',emailVerified:true,isAdmin:false});
const CHALLENGE=Object.freeze({confirmationRequired:true,challengeId:'email-challenge-1',maskedEmail:'a***@example.test',expiresAt:'2026-10-16T12:15:00Z',resendAfter:60});
const json=(payload,status=200)=>({status,ok:status>=200&&status<300,json:async()=>JSON.parse(JSON.stringify(payload))});
function fixture({online=true,user=null,config=CONFIG,cached=null,storageBlocked=false,responder}={}){
  const handlers=new Map(),calls=[],changes=[],errors=[],stored=new Map();
  if(cached!==null)stored.set(SESSION_KEY,typeof cached==='string'?cached:JSON.stringify(cached));
  const storage={getItem(key){if(storageBlocked)throw new Error('Storage unavailable');return stored.get(key)??null;},
    setItem(key,value){if(storageBlocked)throw new Error('Storage unavailable');stored.set(key,value);},
    removeItem(key){if(storageBlocked)throw new Error('Storage unavailable');stored.delete(key);}};
  const win={location:{origin:'https://form.example',protocol:'https:'},navigator:{onLine:online},localStorage:storage,
    addEventListener:(name,handler)=>handlers.set(name,handler),removeEventListener:name=>handlers.delete(name)};
  let serverUser=user,pendingUser=null;
  let respond=responder||(({path,body})=>{
    if(path==='auth/session/')return json({user:serverUser,csrfToken:'session-csrf'});
    if(path==='auth/signup/'||path==='auth/login/'){
      pendingUser={...USER,email:body.email,displayName:body.displayName??USER.displayName};
      return json(CHALLENGE,202);
    }
    if(path==='auth/resend-confirmation/')return json(CHALLENGE,202);
    if(path==='auth/confirm-email/'){serverUser=pendingUser??USER;return json({user:serverUser,csrfToken:'rotated-csrf'});}
    if(path==='auth/logout/'||path==='auth/delete-account/'){serverUser=null;return json(null,204);}
    return json({ok:true});
  });
  const fetcher=async(url,options)=>{const parsed=new URL(url),call={url,path:parsed.pathname.slice('/api/'.length),options,
    body:options.body===undefined?undefined:JSON.parse(options.body)};calls.push(call);return respond(call);};
  const api=initAuth(win,{config,fetch:fetcher,onSessionChanged:user=>changes.push(user),onError:error=>errors.push(error)});
  return {api,win,calls,changes,errors,stored,handlers,setResponder:value=>{respond=value;}};
}

test('Django configuration accepts only the app origin and public account settings',()=>{
  const win={location:{origin:'https://form.example'}};
  assert.deepEqual(validateAuthConfig(CONFIG,win),{base:'https://form.example/api/',requireAccounts:true});
  assert.deepEqual(validateAuthConfig({...CONFIG,apiBaseUrl:'/api',requireAccounts:false},win),{base:'https://form.example/api/',requireAccounts:false});
  assert.equal(validateAuthConfig({provider:'other'},win),null);
  for(const apiBaseUrl of ['https://offsite.example/api/','//offsite.example/api/','https://name:password@form.example/api/','/api/?token=oops','/api/#credentials','javascript:alert(1)'])
    assert.throws(()=>validateAuthConfig({...CONFIG,apiBaseUrl},win),error=>error.code==='auth/configuration',apiBaseUrl);
  for(const key of ['secret_key','password','database_url','serviceAccount','privateKey','accessToken'])
    assert.throws(()=>validateAuthConfig({...CONFIG,[key]:'must-not-ship'},win),error=>error.code==='auth/configuration',key);
});

test('session verification coalesces requests and uses same-origin cookies without custom credentials',async()=>{
  let release;const held=new Promise(resolve=>{release=resolve;});
  const f=fixture({responder:async()=>{await held;return json({user:USER,csrfToken:'session-csrf'});}});
  const first=f.api.ready(),second=f.api.ready();assert.equal(f.calls.length,1);release();
  const [a,b]=await Promise.all([first,second]);assert.deepEqual(a,b);assert.equal(a.uid,USER.uid);assert.equal(Object.isFrozen(a),true);
  assert.equal(f.api.getStatus(),'ready');assert.equal(f.api.requiresAccounts,true);assert.equal(f.api.provider,'django');assert.equal(f.api.googleEnabled,false);assert.equal(f.changes.length,1);
  const request=f.calls[0].options;
  assert.equal(request.method,'GET');assert.equal(request.credentials,'same-origin');assert.equal(request.redirect,'error');assert.equal(request.cache,'no-store');
  assert.deepEqual(request.headers,{Accept:'application/json'});assert.equal(request.signal instanceof AbortSignal,true);f.api.dispose();
});

test('only a low privilege last-user identity is cached; credentials and admin privileges are excluded',async()=>{
  const f=fixture({user:{...USER,isAdmin:true,accessToken:'mock-token',refreshToken:'mock-refresh',password:'mock-password',csrfToken:'mock-csrf',unknown:'extra'}});
  const user=await f.api.ready();assert.equal(user.isAdmin,true);assert.equal(user.offline,false);
  assert.deepEqual(Object.keys(user).sort(),['uid','email','displayName','emailVerified','isAdmin','provider','offline'].sort());
  assert.deepEqual([...f.stored.keys()],[SESSION_KEY]);const cached=JSON.parse(f.stored.get(SESSION_KEY));
  assert.equal(cached.uid,USER.uid);assert.equal(cached.isAdmin,false);assert.equal(cached.offline,true);
  for(const forbidden of ['accessToken','refreshToken','password','csrfToken','unknown'])assert.equal(Object.hasOwn(cached,forbidden),false);
  assert.equal(f.stored.get(SESSION_KEY).includes('mock-'),false);f.api.dispose();
});

test('offline cached identity never grants verified account or owner privileges',async()=>{
  const f=fixture({online:false,cached:{...USER,isAdmin:true,offline:false,accessToken:'mock-token'}});
  const user=await f.api.ready();assert.equal(f.calls.length,0);assert.equal(f.api.getStatus(),'offline');assert.equal(user.uid,USER.uid);assert.equal(user.isAdmin,false);assert.equal(user.offline,true);assert.equal(Object.hasOwn(user,'accessToken'),false);
  await assert.rejects(f.api.signIn('alice@example.test','password'),error=>error.code==='auth/offline');f.api.dispose();
});

test('network failure restores only a safe cached identity and reports a recoverable error',async()=>{
  const f=fixture({cached:{...USER,isAdmin:true},responder:()=>{throw new Error('transport failed');}});
  const user=await f.api.ready();assert.equal(user.offline,true);assert.equal(user.isAdmin,false);assert.equal(f.api.getStatus(),'offline');assert.equal(f.errors.length,1);assert.equal(f.errors[0].code,'auth/network');assert.equal(f.errors[0].message.includes('transport failed'),false);f.api.dispose();
});

test('failed reverification downgrades an in-memory admin even when browser storage is blocked',async()=>{
  const f=fixture({user:{...USER,isAdmin:true},storageBlocked:true});assert.equal((await f.api.ready()).isAdmin,true);
  f.setResponder(()=>{throw new Error('transport failed');});const user=await f.api.ready();assert.equal(user.isAdmin,false);assert.equal(user.offline,true);f.api.dispose();
});

test('malformed cached and server identities are never admitted',async()=>{
  for(const uid of ['',USER.uid+'\n','../alice','a/b','a'.repeat(101),null]){
    const cached=fixture({online:false,cached:{...USER,uid}});assert.equal(await cached.api.ready(),null,JSON.stringify(uid));cached.api.dispose();
    const server=fixture({user:{...USER,uid}});assert.equal(await server.api.ready(),null,JSON.stringify(uid));server.api.dispose();
  }
  const malformed=fixture({online:false,cached:'{broken-json'});assert.equal(await malformed.api.ready(),null);malformed.api.dispose();
});

test('signup requires explicit progress-storage consent and validates inputs before sending them',async()=>{
  const f=fixture();
  await assert.rejects(async()=>f.api.signUp('alice@example.test','long-password','Alice',false),error=>error.code==='auth/consent-required');
  await assert.rejects(async()=>f.api.signUp('alice@example.test','short','Alice',true),error=>error.code==='auth/invalid-password');
  await assert.rejects(async()=>f.api.signUp('bad@@example.test','long-password','Alice',true),error=>error.code==='auth/invalid-email');
  await assert.rejects(async()=>f.api.signUp('alice@example.test','long-password','A'.repeat(81),true),error=>error.code==='auth/invalid-name');
  assert.equal(f.calls.length,0);const challenge=await f.api.signUp('  alice@example.test  ','long-password','  Alice  ',true);assert.deepEqual(challenge,CHALLENGE);
  assert.equal(f.api.getSession(),null);assert.equal(f.api.getStatus(),'confirmation');assert.equal(f.stored.has(SESSION_KEY),false);assert.equal(f.changes.some(user=>user!==null),false);
  assert.deepEqual(f.calls.map(call=>call.path),['auth/session/','auth/signup/']);assert.deepEqual(f.calls[1].body,{email:'alice@example.test',password:'long-password',displayName:'Alice',trackingConsent:true});
  assert.equal(f.calls[1].options.headers['X-CSRFToken'],'session-csrf');assert.equal(f.calls[1].options.credentials,'same-origin');assert.equal([...f.stored.values()].join('').includes('long-password'),false);f.api.dispose();
});

test('login, email confirmation, reset and logout use CSRF-protected POST endpoints',async()=>{
  const f=fixture();await f.api.ready();f.changes.length=0;
  assert.deepEqual(await f.api.signIn(' alice@example.test ','password'),CHALLENGE);
  assert.equal(f.api.getSession(),null);assert.equal(f.changes.length,0);assert.equal(f.stored.has(SESSION_KEY),false);
  assert.deepEqual(await f.api.resendConfirmation(CHALLENGE.challengeId),CHALLENGE);
  assert.equal(f.api.getSession(),null);assert.equal(f.changes.length,0);
  assert.equal((await f.api.confirmEmail(CHALLENGE.challengeId,'123456')).uid,USER.uid);assert.equal(f.changes.length,1);assert.equal(f.api.getSession().emailVerified,true);
  await f.api.resetPassword('alice@example.test');await f.api.confirmPasswordReset({uid:'reset-uid',token:'single-use-reset-token',password:'new-long-password'});
  assert.equal(f.api.getSession().uid,USER.uid);await f.api.signOut();assert.equal(f.api.getSession(),null);assert.equal(f.stored.has(SESSION_KEY),false);
  assert.deepEqual(f.calls.slice(1).map(call=>[call.path,call.options.method]),[['auth/login/','POST'],['auth/resend-confirmation/','POST'],['auth/confirm-email/','POST'],['auth/password-reset/','POST'],['auth/password-reset-confirm/','POST'],['auth/logout/','POST']]);
  assert.deepEqual(f.calls[1].body,{email:'alice@example.test',password:'password'});assert.deepEqual(f.calls[2].body,{challengeId:CHALLENGE.challengeId});assert.deepEqual(f.calls[3].body,{challengeId:CHALLENGE.challengeId,token:'123456'});
  assert.deepEqual(f.calls[5].body,{uid:'reset-uid',token:'single-use-reset-token',password:'new-long-password'});assert.deepEqual(f.calls[6].body,{});
  assert.equal(f.calls[2].options.headers['X-CSRFToken'],'session-csrf');assert.equal(f.calls[3].options.headers['X-CSRFToken'],'session-csrf');
  for(const call of f.calls.slice(4))assert.equal(call.options.headers['X-CSRFToken'],'rotated-csrf');assert.equal([...f.stored.values()].join('').includes('reset-token'),false);f.api.dispose();
});

test('expired, reused and rate-limited confirmation attempts cannot create an account session',async()=>{
  const f=fixture();await f.api.ready();await f.api.signIn('alice@example.test','password');f.changes.length=0;
  for(const [status,code] of [[400,'auth/invalid-confirmation'],[410,'auth/confirmation-expired'],[429,'auth/rate-limited']]){
    f.setResponder(()=>json({code,message:'Request another confirmation code.'},status));
    await assert.rejects(f.api.confirmEmail(CHALLENGE.challengeId,'000000'),error=>error.code===code&&error.status===status);
    assert.equal(f.api.getSession(),null);assert.equal(f.changes.length,0);assert.equal(f.stored.has(SESSION_KEY),false);
  }
  f.setResponder(()=>json({code:'auth/rate-limited',message:'Please wait.'},429));
  await assert.rejects(f.api.resendConfirmation(CHALLENGE.challengeId),error=>error.code==='auth/rate-limited');
  assert.equal(f.api.getSession(),null);f.api.dispose();
});

test('an unexpected immediate user or malformed challenge cannot bypass email confirmation',async()=>{
  for(const response of [{user:USER},{...CHALLENGE,confirmationRequired:false},{...CHALLENGE,challengeId:'unsafe\n'},{...CHALLENGE,challengeId:'../unsafe'}]){
    const f=fixture();await f.api.ready();f.changes.length=0;f.setResponder(()=>json(response,202));
    await assert.rejects(f.api.signIn('alice@example.test','password'),error=>error.code==='auth/invalid-response');
    assert.equal(f.api.getSession(),null);assert.equal(f.changes.length,0);assert.equal(f.stored.has(SESSION_KEY),false);f.api.dispose();
  }
});

test('email confirmation must return an actual verified user and never stores the code or challenge',async()=>{
  const f=fixture();await f.api.ready();await f.api.signIn('alice@example.test','password');f.changes.length=0;
  for(const user of [null,{...USER,emailVerified:false},{...USER,uid:'unsafe\n'}]){
    f.setResponder(()=>json({user}));await assert.rejects(f.api.confirmEmail(CHALLENGE.challengeId,'654321'),error=>error.code==='auth/invalid-response');
    assert.equal(f.api.getSession(),null);assert.equal(f.changes.length,0);
  }
  f.setResponder(()=>json({user:USER,csrfToken:'new-csrf'}));await f.api.confirmEmail(CHALLENGE.challengeId,'654321');
  assert.equal(f.api.getSession().emailVerified,true);assert.equal(f.changes.length,1);
  const cache=f.stored.get(SESSION_KEY);assert.equal(cache.includes('654321'),false);assert.equal(cache.includes(CHALLENGE.challengeId),false);assert.equal(cache.includes('new-csrf'),false);f.api.dispose();
});

test('account deletion requires the current password and retains identity if the server rejects it',async()=>{
  const f=fixture({user:USER});await f.api.ready();await assert.rejects(async()=>f.api.deleteAccount(''),error=>error.code==='auth/invalid-password');assert.equal(f.calls.length,1);
  f.setResponder(()=>json({code:'auth/invalid-password',message:'Password did not match.'},403));await assert.rejects(f.api.deleteAccount('wrong-password'),error=>error.code==='auth/invalid-password');assert.equal(f.api.getSession().uid,USER.uid);
  f.setResponder(()=>json(null,204));assert.deepEqual(await f.api.deleteAccount('current-password'),{deleted:true});assert.equal(f.api.getSession(),null);assert.equal(f.stored.has(SESSION_KEY),false);
  const deletion=f.calls.at(-1);assert.equal(deletion.path,'auth/delete-account/');assert.equal(deletion.options.method,'POST');assert.deepEqual(deletion.body,{password:'current-password'});f.api.dispose();
});

test('requests cannot leave the configured API and account-bound writes carry an explicit UID',async()=>{
  const f=fixture();await f.api.ready();
  for(const path of ['https://offsite.example/api/progress/','//offsite.example/api/progress/','../outside/','/api-other/progress/'])await assert.rejects(f.api.request(path),error=>error.code==='auth/configuration',path);
  assert.equal(f.calls.length,1);await f.api.request('progress/',{method:'PUT',body:{state:{version:4},baseRevision:0},expectedUid:USER.uid});
  const write=f.calls.at(-1);assert.equal(write.options.headers['X-FORM-User'],USER.uid);assert.equal(write.options.headers['X-CSRFToken'],'session-csrf');assert.equal(Object.hasOwn(write.options.headers,'Authorization'),false);assert.equal(write.options.redirect,'error');assert.equal(write.url,'https://form.example/api/progress/');f.api.dispose();
});

test('errors retain bounded messages and revision conflicts but omit unrelated private payloads',async()=>{
  const f=fixture();await f.api.ready();f.setResponder(()=>json({code:'auth/invalid-credentials',message:'Email or password did not match.',secret:'server-private'},401));
  await assert.rejects(f.api.signIn('alice@example.test','wrong'),error=>{assert.equal(error instanceof AuthError,true);assert.equal(error.status,401);assert.equal(error.details,null);assert.equal(error.code,'auth/invalid-credentials');assert.equal(error.message,'Email or password did not match.');return true;});
  f.setResponder(()=>json({code:'bad-code\n',message:'m'.repeat(701)},403));await assert.rejects(f.api.request('progress/'),error=>error.code==='auth/permission-denied'&&error.message.length<701);
  f.setResponder(()=>json({},429));await assert.rejects(f.api.request('progress/'),error=>error.message.includes('Too many attempts'));
  const conflict={code:'cloud/conflict',message:'Progress changed.',state:{version:4},revision:9};f.setResponder(()=>json(conflict,409));
  await assert.rejects(f.api.request('progress/',{method:'PUT',body:{}}),error=>error.code==='cloud/conflict'&&error.status===409&&JSON.stringify(error.details)===JSON.stringify(conflict));f.api.dispose();
});

test('an unavailable account server does not fabricate a successful sign-in',async()=>{
  const f=fixture({responder:()=>({status:404,ok:false,json:async()=>{throw new SyntaxError('HTML page');}})});
  assert.equal(await f.api.ready(),null);assert.equal(f.api.getStatus(),'unavailable');assert.equal(f.api.configured,false);assert.equal(f.changes.length,0);assert.equal(f.errors[0].code,'auth/unavailable');f.api.dispose();
});

test('invalid configuration and disposed adapters cannot issue requests',async()=>{
  const bad=fixture({config:{...CONFIG,apiBaseUrl:'https://other.example/api/'}});assert.equal(bad.api.configured,false);assert.equal(await bad.api.ready(),null);
  await assert.rejects(bad.api.signIn('alice@example.test','password'),error=>error.code==='auth/configuration');assert.equal(bad.calls.length,0);bad.api.dispose();
  const f=fixture({config:{...CONFIG,requireAccounts:false}});assert.equal(f.api.requiresAccounts,false);await f.api.ready();const signal=f.calls[0].options.signal;assert.equal(f.handlers.has('online'),true);
  f.api.dispose();assert.equal(signal.aborted,true);assert.equal(f.handlers.has('online'),false);await assert.rejects(f.api.request('progress/'),error=>error.code==='auth/disposed');assert.equal(await f.api.ready(),null);assert.equal(f.calls.length,1);
});
