// Account-scoped coordination only. Authentication and compare-and-swap storage
// belong to the supplied backend client; workout checkpoints remain device-only.
const copy=value=>JSON.parse(JSON.stringify(value));
const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
function fingerprint(serial){
  // Change detection, not authentication. Exact canonical strings decide whether
  // an in-flight snapshot and a newer pending snapshot contain the same data.
  let a=2166136261,b=2654435761;
  for(let i=0;i<serial.length;i++){const code=serial.charCodeAt(i);a=Math.imul(a^code,16777619);b=Math.imul(b^code,2246822519);}
  return `v1:${serial.length.toString(16)}:${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}
const validRevision=value=>value===null||(Number.isInteger(value)&&value>=0)||(typeof value==='string'&&value.length>0&&value.length<=200&&!/[\u0000-\u001f\u007f]/.test(value));
const fault=(code,message)=>Object.assign(new Error(message),{code});
const meaningful=value=>['weights','bodyMeasurements','workouts','walks','assessments','favorites','customRoutines'].some(key=>Array.isArray(value?.[key])&&value[key].length>0)||!!(value?.activeProgram||value?.profile?.onboardingComplete||value?.profile?.safetyAccepted||value?.profile?.name);

export function initSync({getLocal,saveLocal,validate,cloud,uid,storage,isLocalLocked=()=>false,hasLocalData,onStatus=()=>{},onRemoteApplied=()=>{},onConflict=()=>{}}){
  if(typeof uid!=='string'||!uid.length||uid.length>200||/[\u0000-\u001f\u007f]/.test(uid))throw new Error('Cloud sync needs a valid account identifier.');
  if(!cloud||typeof cloud.load!=='function'||typeof cloud.save!=='function'||typeof getLocal!=='function'||typeof saveLocal!=='function'||typeof validate!=='function')throw new Error('Cloud sync needs a backend client and local state callbacks.');
  const metadataKey=`form.user.${encodeURIComponent(uid)}.sync.v1`;
  let revision=null,lastSyncedAt=null,storedFingerprint=null,metadataPresent=false,dirty=false,pending=null;
  let phase='idle',error=null,blocked='',loaded=false,disposed=false,clearing=false,knownServerSerial=null,conflict=null;
  let startFlight=null,writeFlight=null,decisionFlight=null,deleteFlight=null;
  const callbacks=(fn,value)=>{if(!disposed)try{fn(value);}catch{}};
  const getStatus=()=>({phase,pending:dirty||pending!==null,revision,lastSyncedAt,error});
  function publish(next,message=null){if(disposed)return getStatus();phase=next;error=message;callbacks(onStatus,getStatus());return getStatus();}
  function protect(reason,message){blocked=reason;return publish('protected',message);}
  function localSnapshot(value=getLocal()){
    if(isLocalLocked())throw fault('sync/local-protected','Recover your saved device records before syncing. The cloud copy has not been replaced.');
    try{const state=copy(validate(copy(value))),serial=canonical(state);return {state,serial,fingerprint:fingerprint(serial)};}
    catch(e){if(e.code==='sync/local-protected')throw e;throw fault('sync/local-protected','Your device records need recovery before syncing. '+(e.message||''));}
  }
  function metadata(){return {version:1,uid,revision,pending:dirty||pending!==null,fingerprint:pending?.fingerprint??storedFingerprint,lastSyncedAt};}
  function persist(){
    if(!storage)return;
    try{storage.setItem(metadataKey,JSON.stringify(metadata()));metadataPresent=true;}
    catch{throw fault('sync/metadata-protected','Sync status could not be saved on this device. Free some browser storage, then retry. Your records remain on this device.');}
  }
  function readMetadata(){
    if(!storage)return;
    try{
      const raw=storage.getItem(metadataKey);
      if(raw===null)return;
      const value=JSON.parse(raw);
      if(!value||value.version!==1||value.uid!==uid||typeof value.pending!=='boolean'||!validRevision(value.revision)||(value.fingerprint!==null&&(typeof value.fingerprint!=='string'||value.fingerprint.length>200||/[^a-z0-9:]/.test(value.fingerprint)||!/^v1:[a-f0-9]+:[a-f0-9]{16}$/.test(value.fingerprint)))||(value.lastSyncedAt!==null&&(!Number.isFinite(value.lastSyncedAt)||value.lastSyncedAt<0)))throw new Error('Invalid metadata');
      metadataPresent=true;revision=value.revision;lastSyncedAt=value.lastSyncedAt;storedFingerprint=value.fingerprint;dirty=dirty||value.pending;
    }catch{protect('metadata','Your saved sync status needs recovery. Device and cloud records have not been replaced.');}
  }
  function remoteSnapshot(value){
    if(value===null)return null;
    if(!value||typeof value!=='object'||!validRevision(value.revision)||value.revision===null)throw fault('sync/remote-protected','Your cloud copy has invalid revision data. It has not been replaced.');
    try{const state=copy(validate(copy(value.state))),serial=canonical(state);return {state,serial,fingerprint:fingerprint(serial),revision:value.revision};}
    catch(e){throw fault('sync/remote-protected','Your cloud copy needs recovery. It has not been replaced. '+(e.message||''));}
  }
  function failed(e){
    if(disposed)return getStatus();
    if(e?.code?.startsWith('sync/'))return protect(e.code.includes('metadata')?'metadata':e.code.includes('remote')?'remote':'local',e.message);
    return publish('offline','Cloud sync is unavailable. Your changes remain on this device. Retry when connected.');
  }
  function announceConflict(remote){
    conflict=remote;loaded=true;blocked='';publish('conflict','Your device and cloud copies differ. Export a device backup and choose which copy to keep.');
    callbacks(onConflict,{local:copy(pending?.state??localSnapshot().state),remote:copy(remote.state),revision:remote.revision});
    return getStatus();
  }
  function applyRemote(remote){
    if(isLocalLocked())throw fault('sync/local-protected','Recover your saved device records before replacing them from the cloud.');
    saveLocal(copy(remote.state));
    revision=remote.revision;storedFingerprint=remote.fingerprint;knownServerSerial=remote.serial;lastSyncedAt=Date.now();dirty=false;pending=null;conflict=null;blocked='';loaded=true;
    // Refresh the app even when persisting the small sync marker subsequently
    // fails: the atomic local state replacement has already succeeded.
    callbacks(onRemoteApplied,copy(remote.state));persist();return publish('synced');
  }
  function markPending(snapshot){pending=snapshot;dirty=true;persist();}
  function mayWrite(){return loaded&&!disposed&&!clearing&&!conflict&&!blocked&&phase!=='offline'&&pending!==null;}
  async function handleWriteConflict(e){
    const raw=e?.remote===undefined?await cloud.load():e.remote;
    const remote=remoteSnapshot(raw);
    if(!remote)throw fault('sync/remote-protected','The cloud copy changed or was deleted. Retry before uploading your device copy.');
    return announceConflict(remote);
  }
  function pump(){
    if(writeFlight||!mayWrite())return writeFlight;
    writeFlight=Promise.resolve().then(async()=>{
      while(mayWrite()){
        const snapshot=pending,baseRevision=revision;publish('syncing');
        try{
          const result=await cloud.save(copy(snapshot.state),baseRevision);
          if(disposed||clearing)break;
          if(!result||!validRevision(result.revision)||result.revision===null)throw fault('sync/remote-protected','The cloud save returned invalid revision data. Retry before uploading more changes.');
          revision=result.revision;lastSyncedAt=Date.now();knownServerSerial=snapshot.serial;
          if(pending?.serial===snapshot.serial){pending=null;dirty=false;storedFingerprint=snapshot.fingerprint;}
          persist();publish(pending?'syncing':'synced');
        }catch(e){
          if(disposed||clearing)break;
          if(e?.code==='cloud/conflict'){
            try{await handleWriteConflict(e);}catch(conflictError){failed(conflictError);}
          }else failed(e);
          break;
        }
      }
      return getStatus();
    }).finally(()=>{writeFlight=null;if(mayWrite())void pump();});
    return writeFlight;
  }
  async function readCloud({retrying=false}={}){
    if(disposed||clearing)return getStatus();
    if(blocked==='metadata')return getStatus();
    let first;
    try{first=localSnapshot();}
    catch(e){return failed(e);}
    if(storedFingerprint&&first.fingerprint!==storedFingerprint&&!dirty){dirty=true;pending=first;}
    if(dirty&&!pending)pending=first;
    const priorRevision=revision,priorSerial=knownServerSerial;
    publish('loading');
    try{
      const remote=remoteSnapshot(await cloud.load());
      if(disposed||clearing)return getStatus();
      const current=localSnapshot();
      if(current.serial!==first.serial){markPending(current);}
      else if(dirty&&pending?.serial!==current.serial)markPending(current);
      if(remote){
        const untrackedLocal=(!metadataPresent||(revision===null&&lastSyncedAt===null))&&(hasLocalData?hasLocalData():meaningful(current.state));
        const canResumeKnownWrite=retrying&&priorSerial!==null&&priorRevision===remote.revision&&priorSerial===remote.serial;
        if(current.serial!==remote.serial&&(dirty||pending||untrackedLocal)&&!canResumeKnownWrite)return announceConflict(remote);
        revision=remote.revision;knownServerSerial=remote.serial;loaded=true;blocked='';
        if(pending&&canResumeKnownWrite){persist();publish('syncing');await pump();return getStatus();}
        return applyRemote(remote);
      }
      revision=null;knownServerSerial=null;loaded=true;blocked='';conflict=null;
      if(pending){persist();publish('syncing');await pump();}
      else {storedFingerprint=current.fingerprint;persist();publish('idle');}
      return getStatus();
    }catch(e){loaded=false;return failed(e);}
  }
  function start(){
    if(disposed||clearing)return Promise.resolve(getStatus());
    if(startFlight)return startFlight;
    if(loaded)return Promise.resolve(getStatus());
    startFlight=Promise.resolve().then(()=>readCloud()).finally(()=>{startFlight=null;});return startFlight;
  }
  function queue(value){
    if(disposed||clearing)return false;
    try{
      const snapshot=localSnapshot(value);
      pending=snapshot;dirty=true;
      if(blocked==='metadata')return false;
      persist();
      if(conflict){announceConflict(conflict);return true;}
      if(blocked||phase==='offline'){callbacks(onStatus,getStatus());return true;}
      if(!loaded)void start();else void pump();
      return true;
    }catch(e){failed(e);return false;}
  }
  async function flush(){
    if(disposed||clearing)return getStatus();
    if(startFlight)await startFlight;
    else if(!loaded&&!blocked&&phase!=='offline')await start();
    while(writeFlight||mayWrite()){if(writeFlight)await writeFlight;else await pump();}
    return getStatus();
  }
  async function retry(){
    if(disposed||clearing)return getStatus();
    if(startFlight)await startFlight;
    if(writeFlight)await writeFlight;
    if(decisionFlight)await decisionFlight;
    if(blocked==='metadata'){blocked='';readMetadata();if(blocked)return getStatus();}
    if(isLocalLocked())return protect('local','Recover your saved device records before syncing.');
    blocked='';loaded=false;startFlight=Promise.resolve().then(()=>readCloud({retrying:true})).finally(()=>{startFlight=null;});return startFlight;
  }
  function resolveConflict(choice){
    if(!['use-cloud','keep-local'].includes(choice))return Promise.reject(new Error('Choose which sync copy to keep.'));
    if(decisionFlight)return decisionFlight;
    if(!conflict||disposed||clearing)return Promise.resolve(getStatus());
    decisionFlight=Promise.resolve().then(async()=>{
      try{
        const before=localSnapshot();
        if(choice==='keep-local'){
          revision=conflict.revision;knownServerSerial=conflict.serial;conflict=null;blocked='';loaded=true;markPending(before);publish('syncing');await flush();return getStatus();
        }
        publish('loading');
        const remote=remoteSnapshot(await cloud.load());
        if(disposed||clearing)return getStatus();
        if(!remote)throw fault('sync/remote-protected','The cloud copy was deleted. Your device copy has been kept.');
        const current=localSnapshot();
        if(current.serial!==before.serial){markPending(current);return announceConflict(remote);}
        return applyRemote(remote);
      }catch(e){return failed(e);}
    }).finally(()=>{decisionFlight=null;});return decisionFlight;
  }
  function deleteData(){
    if(deleteFlight)return deleteFlight;
    if(disposed)return Promise.resolve(getStatus());
    if(isLocalLocked())return Promise.resolve(protect('local','Recover or deliberately reset your protected device records before deleting the cloud copy.'));
    if(typeof cloud.deleteData!=='function')return Promise.resolve(protect('remote','Cloud deletion is unavailable from this backend client.'));
    clearing=true;
    deleteFlight=Promise.resolve().then(async()=>{
      publish('deleting');
      try{
        if(startFlight)await startFlight;if(writeFlight)await writeFlight;if(decisionFlight)await decisionFlight;
        const result=await cloud.deleteData();
        if(disposed)return getStatus();
        if(!result||!validRevision(result.revision)||result.revision===null)throw fault('sync/remote-protected','The cloud deletion returned invalid revision data. Retry before uploading more changes.');
        // Deletion is a versioned tombstone. A new profile must compare against
        // that revision, and snapshots queued before deletion must stay cleared.
        revision=result.revision;lastSyncedAt=Date.now();storedFingerprint=null;pending=null;dirty=false;conflict=null;blocked='';knownServerSerial=null;loaded=true;
        persist();
        return publish('idle');
      }catch(e){return failed(e);}
      finally{clearing=false;}
    }).finally(()=>{deleteFlight=null;});return deleteFlight;
  }
  function dispose(){disposed=true;}
  readMetadata();
  return {metadataKey,start,queue,retry,resolveConflict,flush,deleteData,getStatus,dispose};
}
