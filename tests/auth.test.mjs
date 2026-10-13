import test from 'node:test';
import assert from 'node:assert/strict';
import {authError, initAuth, validateAuthConfig} from '../dist/auth.js';

// Test fixtures only; this SDK substitute is never loaded by production code.
const config = Object.freeze({provider:'firebase', firebase:{apiKey:'unit-test-public-api-key', authDomain:'unit-project.firebaseapp.com', projectId:'unit-project', appId:'1:123:web:unit-test'}, googleEnabled:true, persistence:'local'});
function fixture({online=true, user=null, fail={}, persistence='local'}={}) {
  const handlers = new Map(), calls = [], listeners = new Set(), applications = [];
  const win = {document:{}, location:{protocol:'https:'}, navigator:{onLine:online},
    addEventListener:(name, handler)=>handlers.set(name,handler), removeEventListener:name=>handlers.delete(name)};
  Object.defineProperty(win, 'localStorage', {get(){throw new Error('The adapter must not implement its own credential storage.');}});
  const client = {currentUser:user, useDeviceLanguage:()=>calls.push(['language'])};
  function change(value) { client.currentUser=value; for(const listener of listeners)listener(value); }
  async function result(name, email='unit@example.test') {
    if(fail[name])throw fail[name];
    const next={uid:'sdk-user', email, displayName:'', emailVerified:false, accessToken:'test-provider-token', refreshToken:'test-refresh-token'};
    change(next); return {user:next, credential:{accessToken:'test-oauth-token'}};
  }
  const sdk = {
    getApps:()=>applications,
    initializeApp:(options,name)=>{const app={name,options};applications.push(app);return app;},
    getAuth:()=>client,
    browserLocalPersistence:{type:'LOCAL'}, browserSessionPersistence:{type:'SESSION'}, inMemoryPersistence:{type:'NONE'},
    setPersistence:async(_client,mode)=>{calls.push(['persistence',mode.type]);if(fail.persistence)throw fail.persistence;},
    onAuthStateChanged:(_client,listener)=>{listeners.add(listener);queueMicrotask(()=>{if(listeners.has(listener))listener(client.currentUser);});return()=>listeners.delete(listener);},
    createUserWithEmailAndPassword:async(_client,email,password)=>{calls.push(['signup',email,password]);return result('signup',email);},
    updateProfile:async(value,profile)=>{if(fail.profile)throw fail.profile;Object.assign(value,profile);calls.push(['profile',profile.displayName]);},
    signInWithEmailAndPassword:async(_client,email,password)=>{calls.push(['signin',email,password]);return result('signin',email);},
    sendPasswordResetEmail:async(_client,email)=>{if(fail.reset)throw fail.reset;calls.push(['reset',email]);},
    GoogleAuthProvider:class {setCustomParameters(params){this.params=params;}},
    signInWithPopup:async(_client,provider)=>{calls.push(['popup',provider.params]);return result('popup');},
    sendEmailVerification:async value=>calls.push(['verification',value.uid]),
    signOut:async()=>{if(fail.signout)throw fail.signout;calls.push(['signout']);change(null);},
    deleteUser:async value=>{if(fail.delete)throw fail.delete;calls.push(['delete',value.uid]);change(null);}
  };
  let loads=0;
  const changes=[], warnings=[];
  const api=initAuth(win,{config:{...config,persistence},loadSdk:async()=>{loads++;if(fail.load)throw fail.load;return sdk;},onSessionChanged:value=>changes.push(value),onError:error=>warnings.push(error)});
  return {api,win,client,sdk,calls,changes,warnings,change,handlers,listeners,getLoads:()=>loads};
}

test('unconfigured authentication never loads a provider or invents a session', async()=>{
  let loads=0;
  const win={document:{},location:{protocol:'https:'},navigator:{onLine:true}};
  const api=initAuth(win,{loadSdk:async()=>{loads++;throw new Error('must not load');}});
  assert.equal(api.configured,false);assert.equal(api.getStatus(),'unconfigured');
  assert.equal(await api.ready(),null);assert.equal(api.getSession(),null);
  for(const action of [()=>api.signUp('unit@example.test','test-password'),()=>api.signIn('unit@example.test','test-password'),()=>api.signInGoogle(),()=>api.resetPassword('unit@example.test')])await assert.rejects(action,{code:'auth/not-configured'});
  assert.equal(loads,0);api.dispose();
});

test('invalid/private config is rejected before any SDK request', async()=>{
  for(const firebase of [{...config.firebase,private_key:'never-publish'}, {...config.firebase,serviceAccount:'never-publish'}, {...config.firebase,apiKey:'REPLACE_API_KEY'}, {...config.firebase,authDomain:'https://bad.test/path'}])assert.throws(()=>validateAuthConfig({...config,firebase}),{code:'auth/configuration'});
  let loads=0;
  const api=initAuth({document:{},location:{protocol:'https:'},navigator:{onLine:true}},{config:{...config,firebase:{...config.firebase,private_key:'never-publish'}},loadSdk:async()=>{loads++;}});
  assert.equal(api.configured,false);await assert.rejects(()=>api.signIn('unit@example.test','test-password'),{code:'auth/configuration'});assert.equal(loads,0);api.dispose();
});

test('offline core does not import Firebase and can restore provider state after reconnection', async()=>{
  const f=fixture({online:false,user:{uid:'restored',email:'unit@example.test',displayName:'Saved user',emailVerified:true}});
  assert.equal(await f.api.ready(),null);assert.equal(f.api.getSession(),null);assert.equal(f.getLoads(),0);
  await assert.rejects(()=>f.api.signIn('unit@example.test','test-password'),{code:'auth/offline'});
  f.win.navigator.onLine=true;await f.handlers.get('online')();await f.api.ready();
  assert.equal(f.getLoads(),1);assert.equal(f.api.getSession().uid,'restored');f.api.dispose();
});

test('restored SDK session exposes identity only and persistence belongs to the SDK', async()=>{
  const f=fixture({user:{uid:'saved',email:'unit@example.test',displayName:'User',emailVerified:true,refreshToken:'never-export',stsTokenManager:{accessToken:'never-export'}},persistence:'session'});
  await f.api.ready();
  assert.deepEqual(f.api.getSession(),{uid:'saved',email:'unit@example.test',displayName:'User',emailVerified:true,provider:'firebase'});
  assert.ok(Object.isFrozen(f.api.getSession()));assert.ok(f.calls.some(x=>x[0]==='persistence'&&x[1]==='SESSION'));
  assert.doesNotMatch(JSON.stringify(f.api.getSession()),/never-export|Token/);f.api.dispose();
});

test('signup validates inputs, creates the real provider account and saves the optional name', async()=>{
  const f=fixture();await f.api.ready();
  await assert.rejects(()=>f.api.signUp('bad-email','test-password'),{code:'auth/invalid-email'});
  await assert.rejects(()=>f.api.signUp('unit@example.test','short'),{code:'auth/weak-password'});
  assert.equal(f.calls.some(x=>x[0]==='signup'),false);
  const value=await f.api.signUp(' unit@example.test ','test-password',' Example ');
  assert.equal(value.uid,'sdk-user');assert.equal(value.displayName,'Example');assert.equal(value.emailVerified,false);
  assert.ok(f.calls.some(x=>x[0]==='signup'&&x[1]==='unit@example.test'&&x[2]==='test-password'));
  assert.doesNotMatch(JSON.stringify(value),/test-password|test-provider-token|test-refresh-token/);f.api.dispose();
});

test('optional profile failure reports an existing account rather than pretending signup failed', async()=>{
  const f=fixture({fail:{profile:new Error('request failed')}});await f.api.ready();
  const value=await f.api.signUp('unit@example.test','test-password','Example');
  assert.equal(value.uid,'sdk-user');assert.equal(f.warnings[0].code,'auth/profile-not-saved');f.api.dispose();
});

test('provider rejection cannot authenticate a user or leak raw provider messages', async()=>{
  const f=fixture({fail:{signin:{code:'auth/invalid-credential',message:'private request details and token'}}});await f.api.ready();
  await assert.rejects(()=>f.api.signIn('unit@example.test','test-password'),error=>error.code==='auth/invalid-credential'&&!error.message.includes('private'));
  assert.equal(f.api.getSession(),null);assert.equal(f.changes.some(x=>x?.uid),false);
  assert.equal(authError({code:'auth/unrecognized',message:'private request details'}).message.includes('private'),false);f.api.dispose();
});

test('Google uses only the provider popup and cancellation does not create a session', async()=>{
  const f=fixture({fail:{popup:{code:'auth/popup-closed-by-user',message:'closed'}}});await f.api.ready();
  await assert.rejects(()=>f.api.signInGoogle(),{code:'auth/popup-closed-by-user'});assert.equal(f.api.getSession(),null);
  assert.deepEqual(f.calls.find(x=>x[0]==='popup')[1],{prompt:'select_account'});f.api.dispose();
});

test('reset, verification, offline sign-out and deletion invoke the real SDK methods', async()=>{
  const f=fixture();await f.api.ready();
  assert.deepEqual(await f.api.resetPassword('unit@example.test'),{requested:true});
  await f.api.signIn('unit@example.test','test-password');await f.api.sendVerificationEmail();
  f.win.navigator.onLine=false;await f.api.signOut();assert.equal(f.api.getSession(),null);
  f.win.navigator.onLine=true;await f.api.signIn('unit@example.test','test-password');
  assert.deepEqual(await f.api.deleteAccount(),{deleted:true});assert.equal(f.api.getSession(),null);
  for(const method of ['reset','verification','signout','delete'])assert.ok(f.calls.some(x=>x[0]===method));f.api.dispose();
});

test('recent-login deletion requirement preserves the session and disposal detaches observers', async()=>{
  const f=fixture({user:{uid:'existing',email:'unit@example.test'},fail:{delete:{code:'auth/requires-recent-login',message:'private'}}});await f.api.ready();
  await assert.rejects(()=>f.api.deleteAccount(),{code:'auth/requires-recent-login'});assert.equal(f.api.getSession().uid,'existing');
  const count=f.changes.length;f.api.dispose();f.change(null);assert.equal(f.changes.length,count);assert.equal(f.listeners.size,0);
  await assert.rejects(()=>f.api.signIn('unit@example.test','test-password'),{code:'auth/disposed'});
});
