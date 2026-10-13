import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkoutTimer,SESSIONS,sequenceFor,validateSessionDescriptor,formatTime,freshState,validateState,addMonths,validDate,weeklySummary} from '../dist/engine.js';
import {EXERCISES} from '../dist/exercises.js';

const legacyState=(version=2)=>({version,profile:{startDate:'2026-10-12',deadline:'2027-05-12',startWeight:null,goalLoss:10},weights:[],workouts:[],walks:[],sound:true});
const personalized=()=>({id:'personalized',title:'My strength session',minutes:10,steps:[
  {type:'warmup',exercise:'march',duration:120,round:0,label:'Warm up'},
  {type:'work',exercise:'wall',duration:60,round:1},
  {type:'rest',exercise:'wall',duration:60,round:1},
  {type:'work',exercise:'chair',duration:60,round:1},
  {type:'rest',exercise:'chair',duration:60,round:1},
  {type:'work',exercise:'plank',duration:60,round:1},
  {type:'cooldown',exercise:'cool',duration:180,round:0,label:'Cool down'}
]});

test('each named workout has the promised total duration and a demo for every movement',()=>{
  for(const s of Object.values(SESSIONS)){
    const steps=sequenceFor(s.id);
    assert.equal(steps.reduce((n,x)=>n+x.duration,0),s.minutes*60);
    assert.equal(steps.filter(x=>x.type==='work').length,s.rounds*s.exercises.length);
    for(const step of steps)assert.match(EXERCISES[step.exercise].video,/^[\w-]{11}$/);
  }
});
test('timer uses elapsed clock time and carries delay accurately into the next interval',()=>{
  let now=0;const t=new WorkoutTimer('foundation',()=>now);t.start();now=125250;t.tick();
  assert.equal(t.index,1);assert.equal(t.remaining,24.75);assert.equal(t.elapsed,125.25);assert.equal(t.step.exercise,'chair');
});
test('pause excludes time away; resume continues the same activity',()=>{
  let now=0;const t=new WorkoutTimer('foundation',()=>now);t.start();now=12000;t.pause();now=180000;t.tick();
  assert.equal(t.elapsed,12);assert.equal(t.remaining,108);assert.equal(t.status,'paused');
  t.start();now+=5000;t.tick();assert.equal(t.elapsed,17);assert.equal(t.remaining,103);
});
test('natural completion caps elapsed at session duration and fires only once',()=>{
  let now=0;const t=new WorkoutTimer('core',()=>now);t.start();now=800000;const events=t.tick();
  assert.equal(t.status,'complete');assert.equal(t.elapsed,720);assert.equal(t.remaining,0);assert.equal(events.filter(e=>e==='complete').length,1);assert.deepEqual(t.tick(),[]);
});
test('skipping does not award time and marks the session as partial',()=>{
  let now=0;const t=new WorkoutTimer('foundation',()=>now);t.start();now=15000;t.tick();t.next();
  assert.equal(t.elapsed,15);assert.equal(t.skipped,1);assert.equal(t.remaining,30);
  now=1000000;t.tick();assert.equal(t.status,'complete');assert.equal(t.elapsed,495);
});
test('a delayed skip at a completion boundary cannot advance beyond the end',()=>{
  let now=0;const t=new WorkoutTimer('foundation',()=>now);t.start();now=600000;t.next();assert.equal(t.index,t.steps.length);assert.equal(t.skipped,0);assert.equal(t.status,'complete');
});
test('additional warm-up extends both remaining time and session duration',()=>{
  const t=new WorkoutTimer();t.steps[0].duration+=240;t.remaining+=240;assert.equal(t.total,840);assert.equal(t.remaining,360);assert.equal(t.position,0);
});
test('reset clears elapsed, skips and completion state',()=>{
  let now=0;const t=new WorkoutTimer('foundation',()=>now);t.start();now=6000;t.next();t.reset('strength');assert.equal(t.elapsed,0);assert.equal(t.skipped,0);assert.equal(t.status,'ready');assert.equal(t.total,960);
});
test('date and display helpers handle calendar boundaries',()=>{
  assert.equal(addMonths('2026-10-11',7),'2027-05-11');assert.equal(addMonths('2026-01-31',1),'2026-02-28');assert.equal(validDate('2026-02-30'),false);assert.equal(formatTime(60.001),'01:01');assert.equal(formatTime(0),'00:00');
});
test('backup validation round trips good data and rejects invalid goals and measurements',()=>{
  const state=freshState('2026-10-11');state.profile.startWeight=100;state.weights=[{date:'2026-10-12',weight:99.5}];state.workouts=[{id:'session-1',date:'2026-10-12',session:'foundation',seconds:600,skipped:0}];
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))),state);
  assert.throws(()=>validateState({...state,profile:{...state.profile,goalLoss:110}}));
  assert.throws(()=>validateState({...state,weights:[{date:'2026-02-30',weight:90}]}));
  assert.throws(()=>validateState({...state,workouts:[{date:'2026-10-11',session:'fake',seconds:600,skipped:0}]}));
});
test('imported identifiers cannot inject markup into history controls',()=>{
  const state=freshState('2026-10-11');state.walks=[{id:'\" onclick=\"alert(1)',date:'2026-10-11',minutes:10}];const clean=validateState(state);assert.match(clean.walks[0].id,/^[\w.-]+$/);
});
test('fresh profiles use a flexible eight-week conditioning plan without a forced weight target',()=>{
  const s=freshState('2026-10-12');assert.equal(s.version,3);assert.equal(s.profile.goalType,'conditioning');assert.equal(s.profile.goalLoss,0);assert.equal(s.profile.deadline,'2026-12-07');assert.equal(s.profile.startWeight,null);assert.equal(s.profile.targetValue,180);assert.equal(s.profile.targetUnit,'minutes');assert.equal(s.profile.durationWeeks,8);assert.equal(s.profile.trackMeasurements,false);assert.equal(s.profile.safetyAccepted,false);assert.deepEqual(s.assessments,[]);assert.deepEqual(validateState(s),s);
});
test('old default and custom deadlines survive migration with all existing progress',()=>{
  const old={...legacyState(1),sound:false};old.profile.goalLoss=30;old.profile.startWeight=100;old.profile.deadline='2028-02-29';old.weights=[{date:'2026-10-12',weight:99.6}];old.walks=[{id:'walk-old',date:'2026-10-12',minutes:10}];old.workouts=[{id:'workout-old',date:'2026-10-12',session:'foundation',seconds:600,skipped:0}];
  const updated=validateState(old);assert.equal(updated.version,3);assert.equal(updated.profile.goalLoss,30);assert.equal(updated.profile.deadline,old.profile.deadline);assert.equal(updated.profile.startDate,old.profile.startDate);assert.equal(updated.profile.startWeight,100);assert.equal(updated.profile.goalType,'weight');assert.equal(updated.profile.targetValue,70);assert.equal(updated.profile.targetUnit,'kg');assert.equal(updated.profile.trackMeasurements,true);assert.equal(updated.profile.safetyAccepted,true);assert.deepEqual(updated.weights,old.weights);assert.deepEqual(updated.walks,old.walks);assert.deepEqual(updated.workouts,old.workouts);assert.equal(updated.sound,false);assert.equal(old.profile.goalLoss,30);
});
test('custom targets survive migration and migration runs only once',()=>{
  const old=legacyState(1);old.profile.goalLoss=12;assert.equal(validateState(old).profile.goalLoss,12);assert.equal(validateState(old).profile.targetValue,null);
  const current=validateState(old);current.profile.goalType='core';current.profile.targetValue=60;current.profile.targetUnit='seconds';assert.deepEqual(validateState(current),current);
});
test('waist and walking pace round trip; invalid optional values are rejected',()=>{
  const s=freshState('2026-10-12');s.weights=[{date:'2026-10-12',weight:100,waist:105}];s.walks=[{id:'walk-1',date:'2026-10-12',minutes:20,intensity:'brisk'}];assert.deepEqual(validateState(s),s);
  assert.throws(()=>validateState({...s,weights:[{date:'2026-10-12',weight:100,waist:-1}]}));
  assert.throws(()=>validateState({...s,walks:[{id:'walk-1',date:'2026-10-12',minutes:20,intensity:'unknown'}]}));
});
test('weekly goals count distinct strength days and only explicitly brisk walking minutes',()=>{
  const s=freshState('2026-10-12');s.workouts=[
    {id:'1',date:'2026-10-12',session:'foundation',seconds:600,skipped:0},
    {id:'2',date:'2026-10-12',session:'core',seconds:720,skipped:0},
    {id:'3',date:'2026-10-13',session:'foundation',seconds:300,skipped:1}
  ];s.walks=[{id:'a',date:'2026-10-12',minutes:20,intensity:'brisk'},{id:'b',date:'2026-10-12',minutes:10,intensity:'easy'},{id:'c',date:'2026-10-12',minutes:5},{id:'d',date:'2026-10-11',minutes:40,intensity:'brisk'}];
  const summary=weeklySummary(s,'2026-10-12','2026-10-13');assert.equal(summary.strengthDays,1);assert.equal(summary.complete.length,2);assert.equal(summary.walkMinutes,35);assert.equal(summary.briskMinutes,20);assert.equal(summary.minutes,62);
});

test('restoring duplicate activity IDs rejects ambiguity within and across activity kinds',()=>{
  const state=freshState('2026-10-12');
  const workout={id:'shared-id',date:'2026-10-12',session:'foundation',seconds:600,skipped:0};
  const walk={id:'shared-id',date:'2026-10-12',minutes:10};
  for(const version of [1,2]){
    assert.throws(()=>validateState({...legacyState(version),workouts:[workout,{...workout,date:'2026-10-13'}]}),/duplicate activity identifiers/);
    assert.throws(()=>validateState({...legacyState(version),walks:[walk,{...walk,date:'2026-10-13'}]}),/duplicate activity identifiers/);
    assert.throws(()=>validateState({...legacyState(version),workouts:[workout],walks:[walk]}),/duplicate activity identifiers/);
  }
  assert.throws(()=>validateState({...state,walks:[{...walk,id:'unsafe\" id'},{...walk,id:'unsafe\" id'}]}),/duplicate activity identifiers/);
  assert.throws(()=>validateState({...state,walks:[{...walk,id:123},{...walk,id:123}]}),/duplicate activity identifiers/);
});

test('restoring duplicate weigh-in dates cannot silently replace or delete two entries',()=>{
  const state=freshState('2026-10-12');
  state.weights=[{date:'2026-10-12',weight:100,waist:105},{date:'2026-10-12',weight:99}];
  assert.throws(()=>validateState(state),/more than one weigh-in/);
  assert.equal(state.weights.length,2);
  assert.equal(state.weights[0].waist,105);
});

test('legacy missing and malformed IDs are repaired without colliding with supplied IDs',()=>{
  const state=freshState('2026-10-12');
  state.workouts=[{date:'2026-10-12',session:'foundation',seconds:600,skipped:0}];
  const unsafeIds=['\" onclick=\"alert(1)','id\n','<script>','', 'a'.repeat(101),123,null];
  state.walks=[{id:'imported-1',date:'2026-10-12',minutes:10},...unsafeIds.map(id=>({id,date:'2026-10-12',minutes:10}))];
  const clean=validateState(state);
  const ids=[...clean.workouts,...clean.walks].map(record=>record.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(clean.walks[0].id,'imported-1');
  for(const id of ids){assert.ok(id.length>=1&&id.length<=100);assert.equal(/[^a-zA-Z0-9_.-]/.test(id),false);}
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(clean))),clean);
  assert.equal(state.workouts[0].id,undefined);
  assert.equal(state.walks[2].id,'id\n');
});

test('valid v1 and v2 activity identifiers and measurements survive restoration unchanged',()=>{
  for(const version of [1,2]){
    const state=legacyState(version);
    state.workouts=[{id:'6ab7939e-a643-4b4c-8113-516251522e82',date:'2026-10-12',session:'core',seconds:720,skipped:0}];
    state.walks=[{id:'0.123456789',date:'2026-10-12',minutes:15,intensity:'brisk'},{id:'walk_old-2',date:'2026-10-12',minutes:5}];
    state.weights=[{date:'2026-10-12',weight:99.5,waist:105},{date:'2026-10-13',weight:99.4}];
    const restored=validateState(state);assert.equal(restored.version,3);assert.deepEqual(restored.weights,state.weights);assert.deepEqual(restored.workouts,state.workouts);assert.deepEqual(restored.walks,state.walks);assert.equal(restored.profile.deadline,state.profile.deadline);assert.equal(restored.profile.goalLoss,state.profile.goalLoss);assert.deepEqual(validateState(restored),restored);
  }
});

test('null or non-record imported entries fail with useful validation errors',()=>{
  const state=freshState('2026-10-12');
  assert.throws(()=>validateState({...state,weights:[null]}),/weight entry is invalid/);
  assert.throws(()=>validateState({...state,workouts:[null]}),/activity entry is invalid/);
  assert.throws(()=>validateState({...state,walks:[[]]}),/activity entry is invalid/);
});

test('personalized sessions run for exactly their requested duration and reset with the same descriptor',()=>{
  let now=0;const descriptor=personalized();const timer=new WorkoutTimer('personalized',()=>now,descriptor);
  assert.equal(timer.total,600);assert.equal(timer.sessionTitle,'My strength session');assert.deepEqual(sequenceFor('personalized',descriptor),descriptor.steps);
  descriptor.steps[1].duration=999;assert.equal(timer.steps[1].duration,60);
  timer.start();now=600000;timer.tick();assert.equal(timer.status,'complete');assert.equal(timer.elapsed,600);
  timer.reset();assert.equal(timer.total,600);assert.equal(timer.status,'ready');assert.equal(timer.descriptor.id,'personalized');
  timer.reset('core');assert.equal(timer.sessionTitle,'Core & control');assert.equal(timer.descriptor,null);
});

test('personalized sessions reject unknown movements, injected labels, fractional timing and duration mismatch',()=>{
  const draft=personalized();
  for(const change of [{exercise:'javascript:alert(1)'},{exercise:'__proto__'},{duration:0},{duration:1.5},{type:'script'},{label:'<img onerror=alert(1)>'},{round:-1}]){
    assert.throws(()=>validateSessionDescriptor({...draft,steps:draft.steps.map((step,i)=>i===1?{...step,...change}:step)}));
  }
  assert.throws(()=>validateSessionDescriptor({...draft,title:'<script>'}));assert.throws(()=>validateSessionDescriptor({...draft,minutes:11}));assert.throws(()=>sequenceFor('personalized'));
  const timer=new WorkoutTimer();assert.throws(()=>timer.reset('personalized',{...draft,minutes:11}));assert.equal(timer.id,'foundation');assert.equal(timer.total,600);
});

test('v3 preferences, optional measurements, assessments and personalized workout metadata round trip',()=>{
  const state=freshState('2026-10-12');Object.assign(state.profile,{name:'Alex & Sam',goalType:'test',targetValue:120,targetUnit:'seconds',baselineValue:30,durationWeeks:12,deadline:'2027-02-03',ageBand:'older',experience:'intermediate',coaching:'quiet',equipment:['wall'],restrictions:['no-floor','knee'],heightCm:170,trackMeasurements:true,safetyAccepted:true});
  state.assessments=[{date:'2026-10-12',value:42,goalType:'test',unit:'seconds',notes:'First assessment <after rest>',time:60}];state.workouts=[{id:'custom-1',date:'2026-10-12',session:'personalized',title:'Core & control <beginner>',goalType:'test',seconds:1200,skipped:1,effort:7,soreness:2}];
  assert.deepEqual(validateState(state),state);const normalized=validateState({...state,profile:{...state.profile,equipment:'none'}});assert.deepEqual(normalized.profile.equipment,['none']);
});

test('invalid assessment records and personalized metadata fail without modifying existing history',()=>{
  const state=freshState('2026-10-12');state.assessments=[{date:'2026-10-12',value:0}];
  for(const value of [NaN,Infinity,-1,10001])assert.throws(()=>validateState({...state,assessments:[{date:'2026-10-12',value}]}),/assessment entry/);
  assert.throws(()=>validateState({...state,assessments:[...state.assessments,{date:'2026-10-12',value:1}]}),/more than one assessment/);
  assert.throws(()=>validateState({...state,workouts:[{id:'x',date:'2026-10-12',session:'personalized',title:'x'.repeat(121),seconds:600,skipped:0}]}),/workout title/);
  assert.throws(()=>validateState({...state,workouts:[{id:'x',date:'2026-10-12',session:'personalized',goalType:'magic',seconds:600,skipped:0}]}),/workout goal/);
  assert.deepEqual(state.assessments,[{date:'2026-10-12',value:0}]);
});

test('workout feedback and goal-specific assessment metadata validate their allowed ranges',()=>{
  const state=freshState('2026-10-12');const workout={id:'x',date:'2026-10-12',session:'personalized',seconds:600,skipped:0};
  for(const effort of [0,11,1.5,NaN,'5'])assert.throws(()=>validateState({...state,workouts:[{...workout,effort}]}),/effort rating/);
  for(const soreness of [0,6,1.5,NaN,'2'])assert.throws(()=>validateState({...state,workouts:[{...workout,soreness}]}),/soreness rating/);
  for(const effort of [1,10])for(const soreness of [1,5]){const record={...workout,effort,soreness};assert.deepEqual(validateState({...state,workouts:[record]}).workouts,[record]);}
  assert.throws(()=>validateState({...state,assessments:[{date:'2026-10-12',value:5,goalType:'unknown',unit:'reps'}]}),/assessment goal/);
  assert.throws(()=>validateState({...state,assessments:[{date:'2026-10-12',value:5,goalType:'strength',unit:'unknown'}]}),/assessment unit/);
});

test('different assessment goals and units can share a date while exact context duplicates are rejected',()=>{
  const state=freshState('2026-10-12');
  state.assessments=[
    {date:'2026-10-12',value:12,goalType:'strength',unit:'reps',notes:'Controlled squat repetitions'},
    {date:'2026-10-12',value:45,goalType:'core',unit:'seconds',notes:'Comfortable wall-plank hold'},
    {date:'2026-10-12',value:5,goalType:'test',unit:'reps',notes:'First benchmark'},
    {date:'2026-10-12',value:30,goalType:'test',unit:'seconds',notes:'Timed benchmark'},
    {date:'2026-10-12',value:7,notes:'Legacy assessment without goal context'}
  ];
  assert.deepEqual(validateState(state),state);
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))).assessments,state.assessments);
  assert.throws(()=>validateState({...state,assessments:[...state.assessments,{...state.assessments[0],value:14,notes:'Duplicate context'}]}),/same goal and unit on the same date/);
  assert.throws(()=>validateState({...state,assessments:[...state.assessments,{date:'2026-10-12',value:8}]}),/same goal and unit on the same date/);
  assert.equal(state.assessments.length,5);
});
