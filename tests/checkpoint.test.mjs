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
