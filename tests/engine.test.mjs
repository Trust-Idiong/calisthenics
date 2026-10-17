import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkoutTimer,SESSIONS,sequenceFor,validateSessionDescriptor,validateCustomRoutine,formatTime,freshState,validateState,addMonths,validDate,weeklySummary,activitySummary} from '../dist/engine.js';
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
  const s=freshState('2026-10-12');assert.equal(s.version,4);assert.equal(s.profile.goalType,'conditioning');assert.equal(s.profile.goalLoss,0);assert.equal(s.profile.deadline,'2026-12-07');assert.equal(s.profile.startWeight,null);assert.equal(s.profile.targetValue,180);assert.equal(s.profile.targetUnit,'minutes');assert.equal(s.profile.durationWeeks,8);assert.equal(s.profile.trackMeasurements,false);assert.equal(s.profile.safetyAccepted,false);assert.deepEqual(s.assessments,[]);assert.deepEqual(validateState(s),s);
});
test('old default and custom deadlines survive migration with all existing progress',()=>{
  const old={...legacyState(1),sound:false};old.profile.goalLoss=30;old.profile.startWeight=100;old.profile.deadline='2028-02-29';old.weights=[{date:'2026-10-12',weight:99.6}];old.walks=[{id:'walk-old',date:'2026-10-12',minutes:10}];old.workouts=[{id:'workout-old',date:'2026-10-12',session:'foundation',seconds:600,skipped:0}];
  const updated=validateState(old);assert.equal(updated.version,4);assert.equal(updated.profile.goalLoss,30);assert.equal(updated.profile.deadline,old.profile.deadline);assert.equal(updated.profile.startDate,old.profile.startDate);assert.equal(updated.profile.startWeight,100);assert.equal(updated.profile.goalType,'weight');assert.equal(updated.profile.targetValue,70);assert.equal(updated.profile.targetUnit,'kg');assert.equal(updated.profile.trackMeasurements,true);assert.equal(updated.profile.safetyAccepted,true);assert.deepEqual(updated.weights,old.weights);assert.deepEqual(updated.walks,old.walks);assert.deepEqual(updated.workouts,old.workouts);assert.equal(updated.sound,false);assert.equal(old.profile.goalLoss,30);
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
    const restored=validateState(state);assert.equal(restored.version,4);assert.deepEqual(restored.weights,state.weights);assert.deepEqual(restored.workouts,state.workouts);assert.deepEqual(restored.walks,state.walks);assert.equal(restored.profile.deadline,state.profile.deadline);assert.equal(restored.profile.goalLoss,state.profile.goalLoss);assert.deepEqual(validateState(restored),restored);
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

test('preferences, optional measurements, assessments and personalized workout metadata round trip',()=>{
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

const customRoutine=()=>({id:'custom-1',name:'A personal routine',warmup:120,cooldown:120,movements:[{exercise:'chair',work:30,rest:15,rounds:2},{exercise:'wall',work:20,rest:0,rounds:3}]});
test('v3 migration adds fitness defaults without replacing goals, dates or progress records',()=>{
  const original=freshState('2026-10-12');original.version=3;delete original.favorites;delete original.customRoutines;delete original.activeProgram;delete original.settings;
  original.profile.days=[2,4];original.profile.deadline='2027-01-03';original.profile.goalType='core';original.profile.targetUnit='seconds';original.profile.targetValue=60;
  original.assessments=[{date:'2026-10-12',value:20,goalType:'core',unit:'seconds',notes:'Starting benchmark'}];original.workouts=[{id:'legacy-personal',date:'2026-10-12',session:'personalized',seconds:600,skipped:0,title:'Core session',goalType:'core',effort:6,soreness:1}];
  const migrated=validateState(original);assert.equal(migrated.version,4);assert.deepEqual(migrated.profile,original.profile);assert.deepEqual(migrated.workouts,original.workouts);assert.deepEqual(migrated.assessments,original.assessments);assert.deepEqual(migrated.settings,{voice:false,reminders:{enabled:false,time:'18:00',days:[2,4],lastNotified:''},energy:{enabled:false,age:null,weight:null,intensity:'light'},pelvic:{guide:'general',experience:'new',comfortableHold:3,week:1,quickReps:false,adviceAccepted:false}});assert.deepEqual(migrated.favorites,[]);assert.deepEqual(migrated.customRoutines,[]);assert.equal(migrated.activeProgram,null);assert.equal(original.settings,undefined);assert.deepEqual(validateState(migrated),migrated);
});
test('favorites, custom routines, enrolled program and session provenance survive backups and timers',()=>{
  const state=freshState('2026-10-12');state.favorites=['full-body-beginner','custom-1'];state.customRoutines=[customRoutine()];state.activeProgram={id:'foundation-4-week',instanceId:'50eabfdd-22a3-4a0b-a6b3-0b3d19937232',routineId:'full-body-beginner',startDate:'2026-10-12',durationWeeks:4};
  state.settings.voice=true;state.settings.reminders={enabled:true,time:'07:30',days:[2,4],lastNotified:'2026-10-13T07:30'};state.workouts=[{id:'routine-completion',date:'2026-10-13',session:'personalized',title:'My routine',routineId:'custom-1',programId:state.activeProgram.instanceId,difficultyFeedback:'just-right',seconds:390,skipped:0,kcal:25,kcalSource:'manual'}];
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))),state);
  const descriptor={...personalized(),routineId:'custom-1',programId:state.activeProgram.instanceId,area:'full-body',style:'strength',description:'A routine you created.',adaptationReason:'Wall support respects your chosen preferences.'};
  const timer=new WorkoutTimer('personalized',()=>0,descriptor);assert.deepEqual(timer.descriptor,descriptor);timer.reset();assert.equal(timer.descriptor.routineId,'custom-1');
});
test('new identifiers, collections, routine bounds and settings reject malformed imported data',()=>{
  const state=freshState('2026-10-12'),routine=customRoutine();
  for(const favorites of [null,['same','same'],['<img>'],['x'.repeat(101)],Array.from({length:201},(_,i)=>'fav-'+i)])assert.throws(()=>validateState({...state,favorites}),/favorite/);
  assert.throws(()=>validateState({...state,customRoutines:[routine,{...routine,name:'Duplicate identifier'}]}),/duplicate custom routine/);
  assert.throws(()=>validateState({...state,customRoutines:null}),/custom routine collection/);
  assert.throws(()=>validateCustomRoutine({...routine,name:'<script>'}));
  assert.throws(()=>validateCustomRoutine({...routine,warmup:0}));assert.throws(()=>validateCustomRoutine({...routine,cooldown:601}));
  for(const change of [{exercise:'unknown'},{work:4},{work:181},{rest:-1},{rest:181},{rounds:0},{rounds:6},{work:30.5}])assert.throws(()=>validateCustomRoutine({...routine,movements:[{...routine.movements[0],...change}]}),/custom routine movement/);
  assert.throws(()=>validateCustomRoutine({...routine,movements:Array.from({length:30},()=>({exercise:'wall',work:180,rest:180,rounds:5}))}),/one hour/);
  assert.deepEqual(validateCustomRoutine({id:'default-times',name:'Simple',movements:[{exercise:'wall',work:30,rest:0,rounds:1}]}),{id:'default-times',name:'Simple',movements:[{exercise:'wall',work:30,rest:0,rounds:1}],warmup:120,cooldown:120});
  assert.throws(()=>validateState({...state,activeProgram:{id:'valid',instanceId:'<svg>',startDate:'2026-10-12',durationWeeks:4}}),/enrollment identifier/);
  assert.throws(()=>validateState({...state,activeProgram:{id:'valid',instanceId:'instance',startDate:'2026-02-30',durationWeeks:4}}),/active program/);
  assert.throws(()=>validateState({...state,settings:null}),/app settings/);assert.throws(()=>validateState({...state,settings:{voice:'yes'}}),/voice preference/);assert.throws(()=>validateState({...state,settings:{voice:null}}),/voice preference/);
  assert.throws(()=>validateState({...state,settings:{reminders:{time:'25:00',days:[1],enabled:true}}}),/reminder time/);
  assert.throws(()=>validateState({...state,settings:{reminders:{time:'18:00',days:[1,1],enabled:true}}}),/unique weekday/);
  assert.throws(()=>validateState({...state,workouts:[{id:'invalid-difficulty',date:'2026-10-12',session:'foundation',seconds:300,skipped:0,difficultyFeedback:'right'}]}),/difficulty rating/);
  assert.throws(()=>validateSessionDescriptor({...personalized(),routineId:'id\" onclick=\"alert(1)'}),/identifier/);
});
test('opt-in energy settings and estimated calorie provenance require age, weight and explicit source',()=>{
  const state=freshState('2026-10-12'),energy={enabled:true,age:35,weight:85.5,intensity:'moderate'};
  state.settings.energy=energy;state.workouts=[{id:'estimate-1',date:'2026-10-12',session:'foundation',seconds:300,skipped:0,kcal:28.43,kcalSource:'estimated',kcalWeight:85.5,kcalMET:3.8,kcalAge:35}];assert.deepEqual(validateState(state),state);
  for(const change of [{age:18},{age:60},{age:35.5},{weight:29},{weight:401},{weight:NaN},{intensity:'unknown'},{enabled:'yes'}])assert.throws(()=>validateState({...state,settings:{...state.settings,energy:{...energy,...change}}}),/Energy estimates/);
  assert.throws(()=>validateState({...state,profile:{...state.profile,ageBand:'teen'}}),/Energy estimates/);
  const workout=state.workouts[0];for(const change of [{kcal:10001},{kcal:NaN},{kcal:-1},{kcalSource:'unknown'},{kcalMET:0},{kcalMET:21},{kcalAge:60},{kcalWeight:29},{kcalWeight:undefined}])assert.throws(()=>validateState({...state,workouts:[{...workout,...change}]}));
  assert.throws(()=>validateState({...state,workouts:[{...workout,kcalSource:'manual'}]}),/Only estimated/);
});
test('activity summaries count actual elapsed minutes and unique completed dates without inventing calories',()=>{
  const state=freshState('2026-10-12');state.workouts=[
    {id:'old',date:'2026-10-09',session:'foundation',seconds:600,skipped:0},
    {id:'one',date:'2026-10-10',session:'foundation',seconds:600,skipped:0,kcal:30,kcalSource:'manual'},
    {id:'same-day',date:'2026-10-10',session:'core',seconds:300,skipped:0},
    {id:'two',date:'2026-10-11',session:'personalized',seconds:450,skipped:0},
    {id:'partial',date:'2026-10-12',session:'personalized',seconds:30,skipped:1},
    {id:'zero',date:'2026-10-12',session:'foundation',seconds:0,skipped:0}
  ];state.walks=[{id:'walk',date:'2026-10-12',minutes:20}];
  const result=activitySummary(state,{from:'2026-10-10',to:'2026-10-12',today:'2026-10-12'});
  assert.equal(result.totalWorkouts,5);assert.equal(result.completedWorkouts,3);assert.equal(result.partialWorkouts,2);assert.equal(result.completedDays,2);assert.equal(result.activeDays,3);assert.equal(result.workoutSeconds,1380);assert.equal(result.minutes,43);assert.equal(result.streak,2);assert.equal(result.longestStreak,2);assert.equal(result.kcal,30);assert.equal(result.hasCalories,true);assert.deepEqual(result.completedDates,['2026-10-10','2026-10-11']);
  assert.deepEqual(result.calendar[0],{date:'2026-10-10',workouts:2,completed:2,minutes:15,kcal:30,hasCalories:true});assert.equal(activitySummary(state,{today:'2026-10-13'}).streak,0);
  const noEnergy=activitySummary({...state,workouts:state.workouts.map(({kcal,kcalSource,...workout})=>workout)},{today:'2026-10-12'});assert.equal(noEnergy.hasCalories,false);assert.equal(noEnergy.kcal,0);assert.equal(noEnergy.longestStreak,3);
});
test('routine and program identifiers reject trailing line breaks and custom routines honor the 30-movement limit',()=>{
  const state=freshState('2026-10-12'),routine=customRoutine(),program={id:'foundation-4-week',instanceId:'instance-1',routineId:'custom-1',startDate:'2026-10-12',durationWeeks:4};
  for(const suffix of ['\n','\r','\r\n','\u2028','\u2029']){
    assert.throws(()=>validateState({...state,favorites:['favorite'+suffix]}),/favorite/);
    assert.throws(()=>validateState({...state,customRoutines:[{...routine,id:routine.id+suffix}]}),/custom routine identifier/);
    for(const field of ['id','instanceId','routineId'])assert.throws(()=>validateState({...state,activeProgram:{...program,[field]:program[field]+suffix}}),/identifier/);
    for(const field of ['routineId','programId']){
      assert.throws(()=>validateSessionDescriptor({...personalized(),[field]:'valid'+suffix}),/identifier/);
      assert.throws(()=>validateState({...state,workouts:[{id:'workout',date:'2026-10-12',session:'foundation',seconds:300,skipped:0,[field]:'valid'+suffix}]}),/identifier/);
    }
  }
  const movements=Array.from({length:30},()=>({exercise:'wall',work:5,rest:0,rounds:1}));assert.equal(validateCustomRoutine({...routine,movements}).movements.length,30);
  assert.throws(()=>validateCustomRoutine({...routine,movements:[...movements,movements[0]]}),/custom routine is invalid/);
  assert.equal(validDate('2026-10-12\n'),false);
});
test('optional waist and hip measurements round trip without requiring or replacing body weight',()=>{
  const state=freshState('2026-10-12');Object.assign(state.profile,{goalType:'curves',targetValue:null,targetUnit:'reps'});
  state.bodyMeasurements=[{date:'2026-10-12',waist:81.5,hips:105},{date:'2026-10-13',waist:81},{date:'2026-10-14',hips:106}];state.weights=[{date:'2026-10-12',weight:80,waist:82}];
  assert.equal(state.profile.startWeight,null);assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))),state);assert.equal(validateState(state).version,4);
  const withoutWeight={...state,weights:[]};assert.deepEqual(validateState(withoutWeight),withoutWeight);
  const optionalTarget={...state,profile:{...state.profile}};delete optionalTarget.profile.targetValue;delete optionalTarget.profile.targetUnit;
  assert.equal(validateState(optionalTarget).profile.targetValue,null);assert.equal(validateState(optionalTarget).profile.targetUnit,'reps');
  const teen={...state,profile:{...state.profile,goalType:'strength',ageBand:'teen',targetValue:null}};assert.deepEqual(validateState(teen).bodyMeasurements,state.bodyMeasurements);assert.deepEqual(validateState(teen).weights,state.weights);
  assert.throws(()=>validateState({...state,profile:{...state.profile,ageBand:'teen'}}),/teen profile/);
});
test('body measurements use realistic bounds and reject empty, malformed or duplicate records',()=>{
  const state=freshState('2026-10-12');state.bodyMeasurements=[{date:'2026-10-12',waist:80,hips:100}];
  for(const bodyMeasurements of [null,{},[null],[[]],[{date:'2026-10-12'}],[{date:'2026-02-30',waist:80}],[{date:'2026-10-12\n',hips:100}]])assert.throws(()=>validateState({...state,bodyMeasurements}));
  for(const waist of [29.9,250.1,null,NaN,Infinity,'80'])assert.throws(()=>validateState({...state,bodyMeasurements:[{date:'2026-10-12',waist,hips:100}]}),/waist measurement/);
  for(const hips of [39.9,300.1,null,NaN,Infinity,'100'])assert.throws(()=>validateState({...state,bodyMeasurements:[{date:'2026-10-12',waist:80,hips}]}),/hips measurement/);
  assert.deepEqual(validateState({...state,bodyMeasurements:[{date:'2026-10-12',waist:30,hips:40},{date:'2026-10-13',waist:250,hips:300}]}).bodyMeasurements,[{date:'2026-10-12',waist:30,hips:40},{date:'2026-10-13',waist:250,hips:300}]);
  assert.throws(()=>validateState({...state,bodyMeasurements:[...state.bodyMeasurements,{date:'2026-10-12',hips:101}]}),/more than one body measurement/);assert.deepEqual(state.bodyMeasurements,[{date:'2026-10-12',waist:80,hips:100}]);
});
test('all supported backup versions gain independent measurement storage without changing legacy measurements',()=>{
  for(const version of [1,2,3,4]){
    const state=version<3?legacyState(version):{...freshState('2026-10-12'),version};delete state.bodyMeasurements;state.weights=[{date:'2026-10-12',weight:90,waist:95}];
    const restored=validateState(state);assert.deepEqual(restored.bodyMeasurements,[]);assert.deepEqual(restored.weights,state.weights);assert.equal(restored.version,4);assert.equal(state.bodyMeasurements,undefined);
  }
  const state=freshState('2026-10-12');state.workouts=[{id:'curves-history',date:'2026-10-12',session:'personalized',seconds:600,skipped:0,goalType:'curves'}];state.assessments=[{date:'2026-10-12',value:12,goalType:'curves',unit:'reps'}];assert.deepEqual(validateState(state),state);
});
test('onboarding choices round trip independently of ability, gender, measurements and energy settings',()=>{
  const state=freshState('2026-10-13');Object.assign(state.profile,{gender:'female',motivation:'confidence',focusAreas:['glutes','core','legs'],birthYear:new Date().getFullYear()-30,location:'gym',cardioComfort:'mild',flexibility:'near',feelings:['confidence','achievement'],reward:'photos',onboardingComplete:true});
  state.workouts=[{id:'existing-onboarding-workout',date:'2026-10-13',session:'foundation',seconds:600,skipped:0}];state.bodyMeasurements=[{date:'2026-10-13',hips:100}];
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))),state);const swapped=validateState({...state,profile:{...state.profile,gender:'other',motivation:null,cardioComfort:null,flexibility:null}});
  assert.equal(swapped.profile.experience,state.profile.experience);assert.deepEqual(swapped.settings.energy,state.settings.energy);assert.deepEqual(swapped.workouts,state.workouts);assert.deepEqual(swapped.bodyMeasurements,state.bodyMeasurements);assert.equal(swapped.profile.motivation,null);
});
test('fresh onboarding defaults and migrated completion flags preserve established users and explicit restart requests',()=>{
  const fresh=freshState('2026-10-13');assert.equal(fresh.profile.onboardingComplete,false);assert.equal(fresh.profile.gender,'prefer-not-to-say');assert.equal(fresh.profile.motivation,'health');assert.deepEqual(fresh.profile.focusAreas,['full']);assert.equal(fresh.profile.birthYear,null);assert.equal(fresh.profile.location,'home');assert.equal(fresh.profile.cardioComfort,null);assert.equal(fresh.profile.flexibility,null);assert.deepEqual(fresh.profile.feelings,[]);assert.equal(fresh.profile.reward,'none');
  const newFields=['gender','motivation','focusAreas','birthYear','location','cardioComfort','flexibility','feelings','reward','onboardingComplete'];
  for(const version of [1,2,3,4]){
    const old=version<3?legacyState(version):{...freshState('2026-10-13'),version};for(const field of newFields)delete old.profile[field];old.workouts=[{id:'older-workout',date:'2026-10-13',session:'foundation',seconds:600,skipped:0}];
    const restored=validateState(old);assert.equal(restored.version,4);assert.equal(restored.profile.onboardingComplete,true);assert.equal(restored.profile.gender,'prefer-not-to-say');assert.deepEqual(restored.workouts,old.workouts);assert.deepEqual(restored.profile.focusAreas,['full']);assert.equal(old.profile.onboardingComplete,undefined);
    assert.equal(validateState({...old,profile:{...old.profile,onboardingComplete:false}}).profile.onboardingComplete,false);
  }
  const ready={...fresh,profile:{...fresh.profile,safetyAccepted:true}};delete ready.profile.onboardingComplete;assert.equal(validateState(ready).profile.onboardingComplete,true);
});
test('onboarding enum choices, unique lists, dynamic birth-year boundaries and completion types reject malformed data',()=>{
  const state=freshState('2026-10-13'),currentYear=new Date().getFullYear();
  for(const [field,value] of [['gender','<img>'],['gender',null],['motivation','unknown'],['location','office'],['location',null],['cardioComfort','yes'],['flexibility','extreme'],['reward','money'],['reward',null],['onboardingComplete','true'],['onboardingComplete',1],['onboardingComplete',null]])assert.throws(()=>validateState({...state,profile:{...state.profile,[field]:value}}),/invalid/);
  for(const focusAreas of [[],null,['glutes','glutes'],['<script>'],['full','abs','chest','arms','core','back','glutes','legs','unknown']])assert.throws(()=>validateState({...state,profile:{...state.profile,focusAreas}}),/focusAreas/);
  for(const feelings of [null,['energy','energy'],['unknown'],['confidence','body','achievement','energy','health','health']])assert.throws(()=>validateState({...state,profile:{...state.profile,feelings}}),/feelings/);
  for(const birthYear of [currentYear-101,currentYear-15,currentYear-30.5,String(currentYear-30),NaN,Infinity])assert.throws(()=>validateState({...state,profile:{...state.profile,birthYear}}),/birth year/);
  for(const birthYear of [null,currentYear-100,currentYear-16])assert.equal(validateState({...state,profile:{...state.profile,birthYear,ageBand:birthYear===currentYear-16?'teen':'adult'}}).profile.birthYear,birthYear);
  const allChoices=validateState({...state,profile:{...state.profile,focusAreas:['full','abs','chest','arms','core','back','glutes','legs'],feelings:['confidence','body','achievement','energy','health']}});assert.equal(allChoices.profile.focusAreas.length,8);assert.equal(allChoices.profile.feelings.length,5);
});
