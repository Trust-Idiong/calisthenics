import test from 'node:test';
import assert from 'node:assert/strict';
import {initAuth} from '../dist/auth.js';
import {freshState,validateState} from '../dist/engine.js';
import {ConflictError,initCloud} from '../dist/cloud.js';

const USER=Object.freeze({uid:'account-alice',emailVerified:true,isAdmin:false,offline:false});
function fixture({user=USER,configured=true,responder,verify}={}){
  const calls=[],verifications=[];let session=user;
  const auth={configured,getSession:()=>session,ready:async()=>{verifications.push(true);if(verify)session=await verify(session);return session;},
    request:async(path,options)=>{calls.push({path,options});return responder?responder(path,options):{ok:true};}};
  const cloud=initCloud({}, {auth});return {auth,cloud,calls,verifications,setUser:user=>{session=user;}};
}

test('progress transport binds operations to one account and preserves revision preconditions',async()=>{
  const remote={state:{version:4,workouts:[{id:'saved'}]},revision:7,updatedAt:'2026-10-16T12:00:00Z'};
  const f=fixture({responder:(_path,options)=>options?.method==='PUT'?{revision:8}:options?.method==='DELETE'?{revision:9}:remote});
  assert.equal(f.cloud.configured,true);assert.deepEqual(await f.cloud.load(),remote);
  const state={version:4,workouts:[{id:'new'}]};assert.deepEqual(await f.cloud.save(state,7),{revision:8});
  await f.cloud.save(state,null);assert.deepEqual(await f.cloud.deleteData(8),{revision:9});await f.cloud.deleteData();
  assert.deepEqual(f.calls.map(call=>call.path),Array(5).fill('progress/'));
  assert.deepEqual(f.calls[0].options,{expectedUid:USER.uid});
  assert.deepEqual(f.calls[1].options,{method:'PUT',body:{state,baseRevision:7},expectedUid:USER.uid});
  assert.equal(f.calls[2].options.body.baseRevision,0);
  assert.deepEqual(f.calls[3].options,{method:'DELETE',body:{baseRevision:8},expectedUid:USER.uid});
  assert.deepEqual(f.calls[4].options,{method:'DELETE',body:{},expectedUid:USER.uid});
});

test('a missing cloud head starts at revision zero while a deleted head keeps its tombstone revision',async()=>{
  const absent=fixture({responder:(_path,options)=>options?.method==='PUT'?{revision:1}:null});assert.equal(await absent.cloud.load(),null);
  assert.deepEqual(await absent.cloud.save({version:4,workouts:[]},null),{revision:1});assert.equal(absent.calls[1].options.body.baseRevision,0);
  const f=fixture({responder:()=>({state:null,revision:12,updatedAt:'2026-10-16T12:00:00Z'})});
  const tombstone=await f.cloud.load();assert.equal(tombstone.revision,12);assert.equal(tombstone.deleted,true);assert.equal(tombstone.updatedAt,'2026-10-16T12:00:00Z');
  assert.equal(tombstone.state.version,freshState().version);assert.deepEqual(tombstone.state.workouts,[]);assert.deepEqual(tombstone.state.weights,[]);assert.equal(tombstone.state.profile.onboardingComplete,false);
  assert.doesNotThrow(()=>validateState(tombstone.state));assert.equal(f.calls.length,1);
});

test('guest and cached offline identities cannot sync or access owner data',async()=>{
  for(const user of [null,{...USER,isAdmin:true,offline:true}]){
    const f=fixture({user});assert.equal(await f.cloud.isAdmin(),false);
    for(const action of [()=>f.cloud.load(),()=>f.cloud.save({version:4},0),()=>f.cloud.deleteData(),()=>f.cloud.listUsers(),()=>f.cloud.readUserState('another-user')])
      await assert.rejects(action(),error=>error.code==='auth/session-changed');
    assert.equal(f.calls.length,0);
  }
});

test('an offline identity must be reverified as the same account before progress can load',async()=>{
  const f=fixture({user:{...USER,offline:true},verify:()=>USER});await f.cloud.load();assert.equal(f.verifications.length,1);assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.expectedUid,USER.uid);
  const switched=fixture({user:{...USER,offline:true},verify:()=>({...USER,uid:'account-bob',isAdmin:true})});
  await assert.rejects(switched.cloud.load(),error=>error.code==='auth/session-changed');assert.equal(switched.calls.length,0);assert.equal(await switched.cloud.isAdmin(),false);
});

test('an existing adapter cannot write previous-account data after the account changes',async()=>{
  const f=fixture();await f.cloud.load();f.setUser({...USER,uid:'account-bob',isAdmin:true});
  await assert.rejects(f.cloud.save({version:4,workouts:[{id:'alice-private'}]},1),error=>error.code==='auth/session-changed');
  await assert.rejects(f.cloud.deleteData(),error=>error.code==='auth/session-changed');await assert.rejects(f.cloud.listUsers(),error=>error.code==='auth/session-changed');
  assert.equal(await f.cloud.isAdmin(),false);assert.equal(f.calls.length,1);
});

test('409 conflicts retain remote details while other errors preserve their original identity',async()=>{
  const details={state:{version:4},revision:11};
  for(const failure of [{status:409,details},{code:'cloud/conflict',details}]){
    const f=fixture({responder:()=>{throw failure;}});
    await assert.rejects(f.cloud.save({version:4},10),error=>{assert.equal(error instanceof ConflictError,true);assert.equal(error.code,'cloud/conflict');assert.equal(error.details,details);return true;});
  }
  const network=Object.assign(new Error('Offline'),{code:'auth/network'}),f=fixture({responder:()=>{throw network;}});
  await assert.rejects(f.cloud.load(),error=>error===network);
});

test('owner requests require verified staff access before any records are requested',async()=>{
  const member=fixture();assert.equal(await member.cloud.isAdmin(),false);
  await assert.rejects(member.cloud.listUsers(),error=>error.code==='auth/permission-denied'&&error.status===403);
  await assert.rejects(member.cloud.readUserState('another-user'),error=>error.code==='auth/permission-denied');assert.equal(member.calls.length,0);
  const owner=fixture({user:{...USER,isAdmin:true}});assert.equal(await owner.cloud.isAdmin(),true);
  await owner.cloud.listUsers({pageSize:10,cursor:'page / + ?',search:'Ada & Bob'});const list=new URL(owner.calls[0].path,'https://form.example/api/');
  assert.equal(list.pathname,'/api/owner/users/');assert.equal(list.searchParams.get('pageSize'),'10');assert.equal(list.searchParams.get('cursor'),'page / + ?');assert.equal(list.searchParams.get('search'),'Ada & Bob');
  await owner.cloud.readUserState('account-bob_2.1');assert.equal(owner.calls[1].path,'owner/users/account-bob_2.1/progress/');for(const call of owner.calls)assert.equal(call.options.expectedUid,USER.uid);
});

test('owner user identifiers reject traversal and trailing newlines',async()=>{
  const f=fixture({user:{...USER,isAdmin:true}});
  for(const uid of ['','account-bob\n','../account-bob','account/bob','a'.repeat(101),3,null])await assert.rejects(f.cloud.readUserState(uid),/valid user/,JSON.stringify(uid));
  assert.equal(f.calls.length,0);
});

test('disposal prevents transport and an unconfigured server is not advertised as cloud-ready',async()=>{
  assert.equal(fixture({configured:false}).cloud.configured,false);const f=fixture();f.cloud.dispose();
  await assert.rejects(f.cloud.load(),/closed/);await assert.rejects(f.cloud.save({version:4},0),/closed/);assert.equal(f.calls.length,0);
});

test('REST transport sends cookies, CSRF and the expected user UID without bearer tokens',async()=>{
  const calls=[],stored=new Map();
  const win={location:{origin:'https://form.example'},navigator:{onLine:true},localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)}};
  const fetcher=async(url,options)=>{calls.push({url,options});const payload=url.endsWith('auth/session/')?{user:{...USER,email:'alice@example.test'},csrfToken:'known-csrf'}:{revision:1};return {status:200,ok:true,json:async()=>payload};};
  const auth=initAuth(win,{config:{provider:'django',apiBaseUrl:'/api/',requireAccounts:true},fetch:fetcher});await auth.ready();const cloud=initCloud(win,{auth});await cloud.save({version:4,workouts:[]},null);
  const call=calls[1];assert.equal(call.url,'https://form.example/api/progress/');assert.equal(call.options.method,'PUT');assert.equal(call.options.credentials,'same-origin');assert.equal(call.options.redirect,'error');
  assert.equal(call.options.headers['X-CSRFToken'],'known-csrf');assert.equal(call.options.headers['X-FORM-User'],USER.uid);assert.equal(Object.hasOwn(call.options.headers,'Authorization'),false);
  assert.deepEqual(JSON.parse(call.options.body),{state:{version:4,workouts:[]},baseRevision:0});auth.dispose();cloud.dispose();
});

test('a 202 sign-in challenge grants no cloud access until email confirmation returns a verified session',async()=>{
  const calls=[],stored=new Map(),challenge={confirmationRequired:true,challengeId:'challenge-1',maskedEmail:'a***@example.test',expiresAt:'2026-10-16T12:15:00Z',resendAfter:60};
  const win={location:{origin:'https://form.example'},navigator:{onLine:true},localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)}};
  const fetcher=async(url,options)=>{
    calls.push({url,options});
    const payload=url.endsWith('auth/session/')?{user:null,csrfToken:'known-csrf'}:url.endsWith('auth/login/')?challenge:url.endsWith('auth/confirm-email/')?{user:{...USER,email:'alice@example.test'},csrfToken:'verified-csrf'}:{state:freshState(),revision:1};
    return {status:url.endsWith('auth/login/')?202:200,ok:true,json:async()=>payload};
  };
  const auth=initAuth(win,{config:{provider:'django',apiBaseUrl:'/api/',requireAccounts:true},fetch:fetcher});await auth.ready();await auth.signIn('alice@example.test','password');
  const unverified=initCloud(win,{auth});await assert.rejects(unverified.load(),error=>error.code==='auth/session-changed');assert.equal(calls.length,2);
  await auth.confirmEmail(challenge.challengeId,'123456');const verified=initCloud(win,{auth});await verified.load();assert.equal(calls.at(-1).options.headers['X-FORM-User'],USER.uid);
  await assert.rejects(unverified.load(),error=>error.code==='auth/session-changed');unverified.dispose();verified.dispose();auth.dispose();
});
