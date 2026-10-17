import test from 'node:test';
import assert from 'node:assert/strict';
import {initSync} from '../dist/sync.js';
const clone=value=>value===null?null:JSON.parse(JSON.stringify(value));
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function memory(){const values=new Map(),access=[];return {values,access,getItem:key=>{access.push(['get',key]);return values.get(key)??null;},setItem:(key,value)=>{access.push(['set',key]);values.set(key,value);},removeItem:key=>{access.push(['remove',key]);values.delete(key);}};}
function rig({local={count:0},remote=null,storage=memory(),uid='alice',locked=false,saveHook,loadHook,hasLocalData}={}){
  let device=clone(local),server=clone(remote),protectedLocal=locked;
  const calls=[],statuses=[],conflicts=[],applied=[];
  const validate=value=>{if(!value||!Number.isInteger(value.count)||value.count<0)throw new Error('Invalid workout records');return clone(value);};
  const cloud={
    load:async()=>{calls.push({kind:'load'});return loadHook?loadHook(clone(server),calls):clone(server);},
    save:async(state,baseRevision)=>{
      calls.push({kind:'save',state:clone(state),baseRevision});
      if(saveHook)await saveHook(state,baseRevision,calls);
      if(baseRevision!==(server?.revision??null))throw Object.assign(new Error('Changed'),{code:'cloud/conflict'});
      server={state:clone(state),revision:(server?.revision??0)+1};return {revision:server.revision};
    },
    deleteData:async()=>{calls.push({kind:'delete'});server={state:{count:0},deleted:true,revision:(server?.revision??0)+1};return {revision:server.revision};}
  };
  const sync=initSync({getLocal:()=>device,saveLocal:state=>{device=clone(state);},validate,cloud,uid,storage,isLocalLocked:()=>protectedLocal,hasLocalData:hasLocalData??(()=>device.count>0),onStatus:status=>statuses.push(status),onRemoteApplied:state=>applied.push(state),onConflict:value=>conflicts.push(value)});
  return {sync,cloud,storage,calls,statuses,conflicts,applied,getLocal:()=>clone(device),getRemote:()=>clone(server),setRemote:remote=>{server=clone(remote);},setLocked:value=>{protectedLocal=value;},change:state=>{device=clone(state);return sync.queue(device);},setLocal:state=>{device=clone(state);}};
}
test('clean startup reads and applies the cloud copy before uploading any device defaults',async()=>{
  const t=rig({remote:{state:{count:7},revision:3}});await t.sync.start();assert.deepEqual(t.getLocal(),{count:7});assert.deepEqual(t.calls.map(call=>call.kind),['load']);assert.equal(t.sync.getStatus().phase,'synced');assert.equal(t.sync.getStatus().revision,3);assert.equal(t.sync.getStatus().pending,false);assert.equal(JSON.parse(t.storage.getItem(t.sync.metadataKey)).pending,false);
  t.applied[0].count=999;assert.equal(t.getLocal().count,7);
});
test('queued edits during startup never overwrite an existing cloud record without a conflict choice',async()=>{
  const gate=deferred(),t=rig({loadHook:()=>gate.promise});const started=t.sync.start();await turn();t.change({count:1});gate.resolve({state:{count:7},revision:3});await started;assert.equal(t.sync.getStatus().phase,'conflict');assert.equal(t.getLocal().count,1);assert.equal(t.calls.filter(call=>call.kind==='save').length,0);assert.deepEqual(t.conflicts[0],{local:{count:1},remote:{count:7},revision:3});
});
test('untracked existing account records conflict rather than disappearing on the first cloud read',async()=>{
  const t=rig({local:{count:2},remote:{state:{count:7},revision:3}});await t.sync.start();assert.equal(t.sync.getStatus().phase,'conflict');assert.equal(t.getLocal().count,2);assert.equal(t.getRemote().state.count,7);
  await t.sync.resolveConflict('use-cloud');assert.equal(t.getLocal().count,7);assert.equal(t.calls.filter(call=>call.kind==='save').length,0);assert.equal(t.sync.getStatus().pending,false);
});
test('an empty cloud account uploads existing records only after an explicit queued save',async()=>{
  const t=rig({local:{count:4}});await t.sync.start();assert.equal(t.sync.getStatus().phase,'idle');assert.equal(t.calls.filter(call=>call.kind==='save').length,0);assert.equal(t.getRemote(),null);
  t.change({count:4});await t.sync.flush();assert.deepEqual(t.getRemote(),{state:{count:4},revision:1});assert.equal(t.sync.getStatus().phase,'synced');
});
test('writes serialize and coalesce to the latest immutable snapshot without cleaning a newer pending edit',async()=>{
  const first=deferred(),second=deferred();let write=0;
  const t=rig({saveHook:async()=>{await (++write===1?first.promise:second.promise);}});await t.sync.start();t.change({count:1});await turn();t.change({count:2});t.change({count:3});
  assert.equal(t.calls.filter(call=>call.kind==='save').length,1);first.resolve();await turn();const mid=JSON.parse(t.storage.getItem(t.sync.metadataKey));assert.equal(mid.pending,true);assert.equal(mid.revision,1);assert.equal(t.sync.getStatus().pending,true);
  second.resolve();await t.sync.flush();assert.deepEqual(t.calls.filter(call=>call.kind==='save').map(call=>[call.state.count,call.baseRevision]),[[1,null],[3,1]]);assert.equal(t.getRemote().state.count,3);assert.equal(t.sync.getStatus().pending,false);
});
test('snapshots passed to a backend cannot be mutated by later edits or backend code',async()=>{
  const gate=deferred();let captured;
  const t=rig({saveHook:async state=>{captured=state;await gate.promise;}});await t.sync.start();const state={count:1};t.setLocal(state);t.sync.queue(state);state.count=999;await turn();assert.equal(captured.count,1);gate.resolve();await t.sync.flush();assert.equal(t.getRemote().state.count,1);
});
test('network errors preserve pending edits and explicit retry safely resumes an unchanged known revision',async()=>{
  let offline=true;const t=rig({remote:{state:{count:5},revision:2},saveHook:async()=>{if(offline)throw new Error('Offline');}});await t.sync.start();t.change({count:6});await t.sync.flush();assert.equal(t.sync.getStatus().phase,'offline');assert.equal(t.sync.getStatus().pending,true);assert.equal(JSON.parse(t.storage.getItem(t.sync.metadataKey)).pending,true);assert.equal(t.getRemote().state.count,5);
  offline=false;await t.sync.retry();assert.equal(t.sync.getStatus().phase,'synced');assert.equal(t.getRemote().state.count,6);assert.equal(t.sync.getStatus().pending,false);
});
test('a reload with a durable dirty marker protects both device and cloud copies',async()=>{
  const t=rig({remote:{state:{count:5},revision:2},saveHook:async()=>{throw new Error('Offline');}});await t.sync.start();t.change({count:6});await t.sync.flush();t.sync.dispose();
  const restored=rig({local:t.getLocal(),remote:t.getRemote(),storage:t.storage});await restored.sync.start();assert.equal(restored.sync.getStatus().phase,'conflict');assert.equal(restored.getLocal().count,6);assert.equal(restored.calls.filter(call=>call.kind==='save').length,0);
  await restored.sync.resolveConflict('keep-local');assert.equal(restored.getRemote().state.count,6);assert.equal(restored.getRemote().revision,3);assert.equal(restored.sync.getStatus().pending,false);
});
test('a concurrent backend revision produces a recoverable conflict instead of a blind overwrite',async()=>{
  const t=rig({remote:{state:{count:5},revision:2}});await t.sync.start();t.setRemote({state:{count:8},revision:3});t.change({count:6});await t.sync.flush();assert.equal(t.sync.getStatus().phase,'conflict');assert.equal(t.getRemote().state.count,8);assert.equal(t.getLocal().count,6);
  await t.sync.resolveConflict('keep-local');assert.equal(t.getRemote().state.count,6);assert.equal(t.getRemote().revision,4);
});
test('choosing cloud refreshes it and keeps a new device mutation made while the read is in flight',async()=>{
  const t=rig({local:{count:2},remote:{state:{count:7},revision:3}});await t.sync.start();const gate=deferred();t.cloud.load=async()=>gate.promise;const decision=t.sync.resolveConflict('use-cloud');await turn();t.change({count:4});gate.resolve({state:{count:8},revision:4});await decision;assert.equal(t.getLocal().count,4);assert.equal(t.sync.getStatus().phase,'conflict');assert.equal(t.conflicts.at(-1).remote.count,8);
});
test('invalid remote records remain untouched and locked local data never contacts or uploads to the backend',async()=>{
  const invalid=rig({local:{count:2},remote:{state:{count:'broken'},revision:3}});await invalid.sync.start();assert.equal(invalid.sync.getStatus().phase,'protected');assert.equal(invalid.getLocal().count,2);assert.deepEqual(invalid.getRemote().state,{count:'broken'});assert.equal(invalid.applied.length,0);invalid.change({count:4});await invalid.sync.flush();assert.equal(invalid.calls.filter(call=>call.kind==='save').length,0);
  const locked=rig({locked:true,local:{count:2},remote:{state:{count:8},revision:3}});await locked.sync.start();assert.equal(locked.sync.getStatus().phase,'protected');assert.equal(locked.change({count:3}),false);await locked.sync.deleteData();assert.equal(locked.calls.length,0);
});
test('invalid or foreign sync metadata is protected and the guest storage key is never accessed',async()=>{
  const storage=memory();storage.values.set('form-seven.v1','Guest records must not be read');storage.values.set('form.user.alice.sync.v1',JSON.stringify({version:1,uid:'bob',revision:2,pending:false,fingerprint:null,lastSyncedAt:null}));const t=rig({storage});await t.sync.start();assert.equal(t.sync.getStatus().phase,'protected');assert.equal(t.calls.length,0);assert.ok(storage.access.every(([,key])=>key==='form.user.alice.sync.v1'));assert.equal(JSON.parse(storage.values.get(t.sync.metadataKey)).uid,'bob');
});
test('deletion waits for an in-flight upload, clears old queued snapshots, and retains clean account tombstone metadata',async()=>{
  const gate=deferred(),t=rig({saveHook:async()=>gate.promise});t.storage.values.set('form-seven.v1','Guest data');await t.sync.start();t.change({count:1});await turn();t.change({count:2});const deletion=t.sync.deleteData();assert.equal(t.sync.queue({count:3}),false);gate.resolve();await deletion;await t.sync.flush();assert.deepEqual(t.calls.map(call=>call.kind),['load','save','delete']);assert.deepEqual(t.getRemote(),{state:{count:0},deleted:true,revision:2});const metadata=JSON.parse(t.storage.getItem(t.sync.metadataKey));assert.equal(metadata.revision,2);assert.equal(metadata.pending,false);assert.equal(metadata.fingerprint,null);assert.equal(t.storage.values.get('form-seven.v1'),'Guest data');assert.equal(t.sync.getStatus().pending,false);assert.equal(t.sync.getStatus().revision,2);
});

test('the first fresh profile queued after deletion saves against its retained tombstone revision',async()=>{
  const t=rig({remote:{state:{count:5},revision:7}});await t.sync.start();await t.sync.deleteData();assert.equal(t.sync.getStatus().revision,8);assert.equal(t.sync.getStatus().phase,'idle');assert.equal(t.sync.getStatus().pending,false);
  assert.equal(t.change({count:0}),true);await t.sync.flush();assert.deepEqual(t.calls.map(call=>call.kind),['load','delete','save']);assert.deepEqual(t.calls.at(-1),{kind:'save',state:{count:0},baseRevision:8});assert.deepEqual(t.getRemote(),{state:{count:0},revision:9});assert.equal(t.sync.getStatus().phase,'synced');assert.equal(t.sync.getStatus().pending,false);assert.equal(JSON.parse(t.storage.getItem(t.sync.metadataKey)).revision,9);
});

test('invalid deletion revisions protect old queued records instead of resuming their uploads',async()=>{
  const t=rig({remote:{state:{count:5},revision:7},saveHook:async()=>{throw new Error('Offline');}});await t.sync.start();t.change({count:6});await t.sync.flush();t.cloud.deleteData=async()=>({revision:null});await t.sync.deleteData();assert.equal(t.sync.getStatus().phase,'protected');assert.equal(t.sync.getStatus().pending,true);assert.equal(t.sync.getStatus().revision,7);await t.sync.flush();assert.equal(t.calls.filter(call=>call.kind==='save').length,1);assert.equal(t.getRemote().state.count,5);
});
test('account scopes and disposal prevent a completed old-account request from changing another device profile',async()=>{
  const storage=memory(),gate=deferred(),alice=rig({uid:'alice',storage,saveHook:async()=>gate.promise});await alice.sync.start();alice.change({count:1});await turn();const callbackCount=alice.statuses.length;alice.sync.dispose();const bob=rig({uid:'bob',storage,remote:{state:{count:9},revision:4}});await bob.sync.start();gate.resolve();await turn();assert.equal(bob.getLocal().count,9);assert.equal(bob.sync.getStatus().revision,4);assert.equal(alice.statuses.length,callbackCount);assert.equal(JSON.parse(storage.values.get(alice.sync.metadataKey)).pending,true);assert.equal(JSON.parse(storage.values.get(bob.sync.metadataKey)).pending,false);
});
