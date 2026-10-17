import {freshState} from './engine.js';
export class ConflictError extends Error {
 constructor(details){super('Your progress changed on another device. Choose which copy to keep.');this.name='ConflictError';this.code='cloud/conflict';this.details=details;}
}
export function initCloud(win,{auth}={}){
 let disposed=false;const boundUid=auth?.getSession()?.uid||null;
 const request=async(path,options)=>{if(disposed)throw new Error('Progress connection closed.');await requireAccount();try{return await auth.request(path,{...options,expectedUid:boundUid});}catch(error){if(error.status===409||error.code==='cloud/conflict')throw new ConflictError(error.details);throw error;}};
 async function requireAccount(){let user=auth?.getSession();if(user?.offline){await auth.ready();user=auth.getSession();}if(!user||user.offline||user.uid!==boundUid)throw Object.assign(new Error('Verify this account online before syncing progress.'),{code:'auth/session-changed'});return user;}
 async function requireOwner(){const user=await requireAccount();if(!user.isAdmin)throw Object.assign(new Error('Owner access is required.'),{code:'auth/permission-denied',status:403});}
 return Object.freeze({
  get configured(){return auth?.configured===true&&typeof auth?.request==='function';},
  load:async()=>{const value=await request('progress/');return value&&value.state===null?{...value,state:freshState(),deleted:true}:value;},
  save:async(state,baseRevision)=>request('progress/',{method:'PUT',body:{state,baseRevision:baseRevision??0}}),
  deleteData:async baseRevision=>request('progress/',{method:'DELETE',body:{...(baseRevision!==undefined?{baseRevision}:{})}}),
  isAdmin:async()=>{const user=auth?.getSession();return !!user&&user.uid===boundUid&&user.isAdmin===true&&!user.offline;},
  listUsers:async({pageSize=25,cursor,search}={})=>{await requireOwner();const params=new URLSearchParams({pageSize:String(pageSize)});if(cursor)params.set('cursor',cursor);if(search)params.set('search',search);return request('owner/users/?'+params);},
  readUserState:async uid=>{await requireOwner();if(typeof uid!=='string'||uid.length<1||uid.length>100||/[^a-zA-Z0-9_.-]/.test(uid))throw new Error('Choose a valid user.');return request('owner/users/'+encodeURIComponent(uid)+'/progress/');},
  dispose:()=>{disposed=true;}
 });
}
