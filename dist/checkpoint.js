import {sequenceFor} from './engine.js';
export const CHECKPOINT_KEY='form-seven.workout.v1';
export function checkpointFor(timer,stamp=Date.now()){
  if(!['running','paused'].includes(timer.status))return null;
  return {version:1,id:timer.id,steps:timer.steps,index:timer.index,remaining:timer.remaining,elapsed:timer.elapsed,skipped:timer.skipped,stamp};
}
export function validateCheckpoint(value,now=Date.now()){
  if(!value||value.version!==1||!Number.isFinite(value.stamp)||value.stamp>now+60000||now-value.stamp>7*86400000)throw new Error('Expired workout');
  const expected=sequenceFor(value.id);
  if(!Array.isArray(value.steps)||value.steps.length!==expected.length)throw new Error('Invalid workout');
  let total=0;
  const steps=value.steps.map((step,i)=>{
    const base=expected[i];
    if(!step||step.type!==base.type||step.exercise!==base.exercise||step.round!==base.round||!Number.isFinite(step.duration)||step.duration<base.duration||step.duration>3600||(base.type==='work'&&step.duration!==base.duration))throw new Error('Invalid interval');
    total+=step.duration;return {...base,duration:step.duration};
  });
  if(total>3600||!Number.isInteger(value.index)||value.index<0||value.index>=steps.length||!Number.isFinite(value.remaining)||value.remaining<=0||value.remaining>steps[value.index].duration||!Number.isFinite(value.elapsed)||value.elapsed<0||value.elapsed>total||!Number.isInteger(value.skipped)||value.skipped<0||value.skipped>value.index)throw new Error('Invalid timing');
  const position=steps.slice(0,value.index).reduce((n,s)=>n+s.duration,0)+steps[value.index].duration-value.remaining;
  if(value.elapsed>position+0.01)throw new Error('Invalid elapsed time');
  return {...value,steps};
}
export function restoreCheckpoint(timer,value){
  const draft=validateCheckpoint(value);
  timer.reset(draft.id);Object.assign(timer,{steps:draft.steps,index:draft.index,remaining:draft.remaining,elapsed:draft.elapsed,skipped:draft.skipped,status:'paused',last:timer.now()});
}
