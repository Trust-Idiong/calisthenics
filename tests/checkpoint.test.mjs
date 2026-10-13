import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorkoutTimer} from '../dist/engine.js';
import {checkpointFor,validateCheckpoint,restoreCheckpoint} from '../dist/checkpoint.js';
test('unfinished workout resumes paused without counting time while closed',()=>{
 let now=0;const timer=new WorkoutTimer('foundation',()=>now);timer.start();now=90000;timer.tick();timer.pause();const draft=checkpointFor(timer);const resumed=new WorkoutTimer('core',()=>999999);restoreCheckpoint(resumed,draft);assert.equal(resumed.status,'paused');assert.equal(resumed.id,'foundation');assert.equal(resumed.elapsed,90);assert.equal(resumed.remaining,30);
});
test('added warm-up and skipped interval accounting survive restart',()=>{
 let now=0;const timer=new WorkoutTimer('foundation',()=>now);timer.steps[0].duration=360;timer.remaining=360;timer.start();now=10000;timer.tick();timer.next();timer.pause();const draft=checkpointFor(timer);const restored=new WorkoutTimer();restoreCheckpoint(restored,draft);assert.equal(restored.steps[0].duration,360);assert.equal(restored.skipped,1);assert.equal(restored.elapsed,10);
});
test('malformed, excessive and expired checkpoints cannot inject a workout',()=>{
 const timer=new WorkoutTimer();timer.start();const draft=checkpointFor(timer);assert.throws(()=>validateCheckpoint({...draft,id:'fake'}));assert.throws(()=>validateCheckpoint({...draft,index:999}));assert.throws(()=>validateCheckpoint({...draft,remaining:NaN}));assert.throws(()=>validateCheckpoint({...draft,elapsed:9999}));assert.throws(()=>validateCheckpoint({...draft,stamp:0}));assert.throws(()=>validateCheckpoint({...draft,steps:draft.steps.map((s,i)=>i===1?{...s,duration:3000}:s)}));
});
test('a personalized workout restores its saved movement plan and title rather than the current plan',()=>{
 const descriptor={id:'personalized',title:'A personalized session',minutes:10,steps:[{type:'warmup',exercise:'march',duration:120,round:0},{type:'work',exercise:'wall',duration:180,round:1},{type:'rest',exercise:'wall',duration:120,round:1},{type:'cooldown',exercise:'cool',duration:180,round:0}]};
 let now=0;const timer=new WorkoutTimer('personalized',()=>now,descriptor);timer.start();now=135000;timer.tick();timer.pause();const draft=checkpointFor(timer);const restored=new WorkoutTimer('strength',()=>999999);restoreCheckpoint(restored,draft);
 assert.equal(restored.id,'personalized');assert.equal(restored.sessionTitle,descriptor.title);assert.equal(restored.status,'paused');assert.equal(restored.index,1);assert.equal(restored.remaining,165);assert.equal(restored.elapsed,135);assert.equal(restored.total,600);assert.deepEqual(restored.descriptor,descriptor);
 restored.reset();assert.equal(restored.total,600);assert.equal(restored.remaining,120);
});
test('personalized checkpoints reject malformed descriptors and movement substitutions',()=>{
 const descriptor={id:'personalized',title:'Saved session',minutes:10,steps:[{type:'warmup',exercise:'march',duration:120,round:0},{type:'work',exercise:'wall',duration:300,round:1},{type:'cooldown',exercise:'cool',duration:180,round:0}]};
 const timer=new WorkoutTimer('personalized',()=>0,descriptor);timer.start();const draft=checkpointFor(timer);
 assert.throws(()=>validateCheckpoint({...draft,descriptor:undefined}));
 assert.throws(()=>validateCheckpoint({...draft,descriptor:{...draft.descriptor,title:'<script>alert(1)</script>'}}));
 assert.throws(()=>validateCheckpoint({...draft,descriptor:{...draft.descriptor,steps:draft.descriptor.steps.map((step,i)=>i===1?{...step,exercise:'eval'}:step)}}));
 assert.throws(()=>validateCheckpoint({...draft,steps:draft.steps.map((step,i)=>i===1?{...step,exercise:'chair'}:step)}));
 assert.throws(()=>validateCheckpoint({...draft,steps:draft.steps.map((step,i)=>i===0?{...step,duration:120.5}:step)}));
 const restored=new WorkoutTimer('core');assert.throws(()=>restoreCheckpoint(restored,{...draft,descriptor:null}));assert.equal(restored.id,'core');assert.equal(restored.status,'ready');
});
