import test from 'node:test';
import assert from 'node:assert/strict';
import {BODY_AREAS,STYLES,ROUTINES,PROGRAMS,catalogSession,buildCustomSession,routineAvailability} from '../dist/catalog.js';
import {EXERCISES,movementArt} from '../dist/exercises.js';
import {sessionAllowed} from '../dist/planner.js';
import {validateSessionDescriptor} from '../dist/engine.js';
import {readFile} from 'node:fs/promises';

const profile=changes=>({startDate:'2026-10-13',durationWeeks:8,experience:'advanced',ageBand:'adult',equipment:['chair','wall'],lowImpact:false,...changes});
const total=session=>session.steps.reduce((sum,step)=>sum+step.duration,0);
const workTime=session=>session.steps.filter(step=>step.type==='work').reduce((sum,step)=>sum+step.duration,0);

test('catalog covers all advertised body areas and styles with authored routines and flexible program templates',()=>{
  assert.deepEqual(BODY_AREAS.map(area=>area.id),['full','abs','chest','arms','core','back','glutes','legs']);
  assert.deepEqual(STYLES.map(style=>style.id),['strength','cardio','hiit','calisthenics','weight','warmup','stretch','recovery']);
  assert.ok(ROUTINES.length>=18);
  assert.equal(new Set(ROUTINES.map(routine=>routine.id)).size,ROUTINES.length);
  for(const area of BODY_AREAS)assert.ok(ROUTINES.some(routine=>routine.area===area.id),area.id);
  for(const style of STYLES)assert.ok(ROUTINES.some(routine=>routine.style===style.id),style.id);
  for(const routine of ROUTINES){assert.ok(routine.movements.length>0);for(const id of routine.movements)assert.ok(Object.hasOwn(EXERCISES,id));}
  assert.ok(PROGRAMS.length>=4);
  assert.ok(PROGRAMS.some(program=>program.id==='pushup-challenge'&&program.challenge));
  for(const program of PROGRAMS){
    assert.equal(program.weeks,program.durationWeeks);
    assert.ok([4,8].includes(program.weeks));
    assert.ok(ROUTINES.some(routine=>routine.id===program.routineId));
    assert.equal(program.schedule.length,3);
    assert.ok(program.schedule.every((day,index)=>!index||day.day-program.schedule[index-1].day>=2));
    assert.ok(!/guarantee|official pass|professional coach/i.test(program.name));
  }
});

test('every catalog routine produces exact duration and a timer-valid descriptor',()=>{
  for(const routine of ROUTINES)for(const minutes of [5,10,routine.defaultMinutes,60]){
    const session=catalogSession(profile(),routine.id,{minutes});
    assert.equal(session.id,'personalized');
    assert.equal(session.routineId,routine.id);
    assert.equal(session.area,routine.area);
    assert.equal(session.style,routine.style);
    assert.equal(total(session),minutes*60);
    assert.equal(session.steps[0].type,'warmup');
    assert.equal(session.steps.at(-1).type,'cooldown');
    assert.doesNotThrow(()=>validateSessionDescriptor(session));
    assert.equal(sessionAllowed(profile(),session.steps),true);
    if(routine.area!=='full')assert.ok(session.steps.filter(step=>step.type==='work').every(step=>[routine.area,...(routine.secondaryAreas??[])].some(area=>EXERCISES[step.exercise].bodyAreas.includes(area))));
  }
});

test('beginner no-equipment users have full-body, chest, arms and push-up practice paths',()=>{
  const p=profile({experience:'beginner',equipment:['none'],lowImpact:true});
  for(const id of ['full-gentle-no-equipment','chest-knee-start','arms-knee-start','pushup-practice']){
    assert.equal(routineAvailability(p,id).available,true,id);
    const session=catalogSession(p,id);
    assert.ok(session.steps.filter(step=>step.type==='work').some(step=>step.exercise==='kneepushup'));
    assert.ok(session.steps.every(step=>!(EXERCISES[step.exercise].equipment??[]).length));
  }
  const restricted={...p,restrictions:['wrist']};
  assert.equal(routineAvailability(restricted,'arms-knee-start').available,false);
  assert.throws(()=>catalogSession(restricted,'arms-knee-start'),/No arms movements/);
});

test('fixed advanced routines never silently downgrade experience, impact or body-area focus',()=>{
  const beginner=profile({experience:'beginner'});
  assert.equal(routineAvailability(beginner,'full-advanced').available,false);
  assert.throws(()=>catalogSession(beginner,'full-advanced'),/advanced routine/);
  for(const ageBand of ['teen','older'])assert.throws(()=>catalogSession(profile({ageBand}),'chest-advanced'),/gentle teen or older-adult/);
  assert.throws(()=>catalogSession(profile({ageBand:'teen'}),'weight-movement'),/for adults/);
  assert.throws(()=>catalogSession(profile({lowImpact:true}),'hiit-advanced'),/includes jumping/);
  assert.throws(()=>catalogSession(profile({restrictions:['no-floor'],equipment:['none']}),'arms-floor'),/No arms movements/);
  assert.throws(()=>catalogSession(profile({restrictions:['back']}),'back-control'),/back-sensitive/);
});

test('restrictions apply to preparation, work, rest and cool-down without swapping in another body area',()=>{
  const p=profile({restrictions:['knee','wrist'],equipment:['none']});
  const available=routineAvailability(p,'core-floor');
  assert.equal(available.available,true);
  const session=catalogSession(p,'core-floor');
  for(const step of session.steps)assert.ok(!['chair','march','cool','bird','wall','pushup','kneepushup','calfstretch','mountainclimber'].includes(step.exercise));
  assert.ok(session.steps.filter(step=>step.type==='work').every(step=>EXERCISES[step.exercise].bodyAreas.includes('core')));
  assert.throws(()=>catalogSession({...p,restrictions:['knee','wrist','shoulder','back','no-floor']},'core-floor'),/No core movements/);
});

test('feedback changes activity and recovery balance within the same eligible variations',()=>{
  const p=profile({experience:'beginner'});
  const steady=catalogSession(p,'full-start',{feedback:'just-right'});
  const easier=catalogSession(p,'full-start',{feedback:'hard'});
  const more=catalogSession(p,'full-start',{feedback:'easy'});
  assert.ok(workTime(easier)<workTime(steady));
  assert.ok(workTime(more)>=workTime(steady));
  assert.equal(total(easier),total(steady));
  const ids=session=>new Set(session.steps.filter(step=>step.type==='work').map(step=>step.exercise));
  assert.deepEqual(ids(easier),ids(steady));
  assert.deepEqual(ids(more),ids(steady));
  assert.match(easier.adaptationReason,/shorter working windows and longer recovery/);
  assert.match(more.adaptationReason,/no harder exercise variation/);
  assert.ok(catalogSession(profile({ageBand:'older'}),'cardio-gentle',{feedback:'easy'}).steps.filter(step=>step.type==='work').every(step=>step.duration<=30));
});

test('fourth-week practice eases workload and bilateral routines always include both sides',()=>{
  const first=catalogSession(profile(),'core-side',{week:1,minutes:10});
  const fourth=catalogSession(profile(),'core-side',{week:4,minutes:10});
  assert.ok(workTime(fourth)<workTime(first));
  assert.match(fourth.adaptationReason,/fourth week is lighter/);
  for(const session of [first,catalogSession(profile(),'stretch-floor',{minutes:5})]){
    const left=session.steps.filter(step=>step.type==='work'&&/left side/.test(step.label??''));
    const right=session.steps.filter(step=>step.type==='work'&&/right side/.test(step.label??''));
    assert.ok(left.length>0);
    assert.equal(left.length,right.length);
  }
});

test('custom routines preserve mix, reorder, zero-rest choices and exact fractional-minute duration',()=>{
  const spec={id:'custom-123',name:'My mixed routine',warmup:90,cooldown:80,movements:[{exercise:'squat',work:30,rest:0,rounds:2},{exercise:'pushup',work:20,rest:15,rounds:1},{exercise:'deadbug',work:25,rest:10,rounds:2}]};
  const session=buildCustomSession(profile(),spec);
  assert.equal(total(session),335);
  assert.equal(session.minutes,335/60);
  assert.equal(session.routineId,spec.id);
  assert.deepEqual(session.steps.filter(step=>step.type==='work').map(step=>step.exercise),['squat','squat','pushup','deadbug','deadbug']);
  assert.doesNotThrow(()=>validateSessionDescriptor(session));
  const reordered=buildCustomSession(profile(),{...spec,movements:[spec.movements[2],spec.movements[0],spec.movements[1]]});
  assert.equal(total(reordered),total(session));
  assert.equal(reordered.steps.find(step=>step.type==='work').exercise,'deadbug');
});

test('custom routines reject markup, invalid intervals, excluded choices and excessive total duration',()=>{
  const base={name:'My routine',movements:[{exercise:'squat',work:30,rest:20,rounds:1}]};
  for(const name of ['<script>','', 'x'.repeat(101),'Bad\nName'])assert.throws(()=>buildCustomSession(profile(),{...base,name}),/plain-text routine name/);
  for(const row of [{exercise:'unknown',work:30,rest:20,rounds:1},{exercise:'squat',work:4,rest:20,rounds:1},{exercise:'squat',work:181,rest:20,rounds:1},{exercise:'squat',work:30,rest:-1,rounds:1},{exercise:'squat',work:30,rest:181,rounds:1},{exercise:'squat',work:30,rest:20,rounds:6}])assert.throws(()=>buildCustomSession(profile(),{...base,movements:[row]}));
  assert.throws(()=>buildCustomSession(profile({restrictions:['knee']}),base),/does not match/);
  assert.throws(()=>buildCustomSession(profile(),{...base,warmupExercise:'unknown'}),/excluded by your preferences/);
  assert.throws(()=>buildCustomSession(profile(),{...base,id:'<script>'}),/identifier is invalid/);
  assert.throws(()=>buildCustomSession(profile(),{...base,movements:Array.from({length:3},()=>({exercise:'squat',work:180,rest:180,rounds:5}))}),/exceeds 60 minutes/);
});

test('original illustrations cover every movement with native pose animation and reduced-motion handling',async()=>{
  const css=await readFile(new URL('../dist/movement.css',import.meta.url),'utf8');
  assert.match(css,/prefers-reduced-motion/);
  assert.equal(Object.keys(EXERCISES).length,37);
  for(const exercise of Object.values(EXERCISES)){
    const art=movementArt(exercise.art);
    assert.match(art,/<svg/);
    assert.ok(art.includes(`data-movement="${exercise.id}"`),exercise.id);
    assert.ok(!/<style/.test(art));
    assert.match(art,/movement-pose/);
    assert.ok(!/<image|href=|url\(/.test(art));
    if(exercise.video)assert.match(exercise.video,/^[\w-]{11}$/);
  }
  assert.match(movementArt('burpee'),/pose-4-3/);
  assert.match(movementArt('pushup'),/pose-2-1/);
});

test('Curves templates offer floor and supported standing variants with a flexible eight-week default',()=>{
  const template=PROGRAMS.find(program=>program.id==='curves-eight');
  assert.equal(template.weeks,8);
  assert.equal(template.durationWeeks,8);
  assert.deepEqual(template.suggestedWeeks,[6,8,12]);
  assert.deepEqual(template.routineOptions,['curves-floor-start','curves-standing-start','glutes-progressive']);
  assert.match(template.assessment,/strength proxy, not a silhouette score/);
  const p=profile({experience:'beginner',equipment:['none'],goalType:'curves'});
  const floor=catalogSession(p,'curves-floor-start');
  assert.equal(total(floor),1200);
  assert.match(floor.description,/Record actual reps and sets yourself/);
  assert.match(floor.description,/cannot spot-reduce belly fat.*Genetics and body composition/);
  assert.ok(floor.steps.filter(step=>step.type==='work').some(step=>EXERCISES[step.exercise].bodyAreas.includes('glutes')));
  assert.ok(floor.steps.filter(step=>step.type==='work').some(step=>EXERCISES[step.exercise].bodyAreas.includes('core')));
  const standingProfile={...p,equipment:['chair'],restrictions:['no-floor']};
  const standing=catalogSession(standingProfile,'curves-standing-start');
  assert.ok(standing.steps.every(step=>!EXERCISES[step.exercise].floor));
  assert.equal(routineAvailability(standingProfile,'curves-floor-start').available,false);
  assert.equal(routineAvailability(standingProfile,'curves-standing-start').available,true);
  for(const id of ['curves-floor-start','curves-standing-start','glutes-progressive','core-confidence'])assert.ok(ROUTINES.find(routine=>routine.id===id).keywords.includes('curves'));
});

test('aesthetic Curves routines are blocked for teens while general glute and core strength remains available',()=>{
  const teen=profile({ageBand:'teen',experience:'beginner',goalType:'strength'});
  for(const id of ['curves-floor-start','curves-standing-start']){
    assert.equal(routineAvailability(teen,id).available,false);
    assert.throws(()=>catalogSession(teen,id),/body-shape routines are for adults/);
  }
  assert.equal(routineAvailability(teen,'glutes-start').available,true);
  assert.equal(routineAvailability(teen,'core-confidence').available,true);
});

test('new glute movements enforce joint preferences and bilateral windows without added equipment',()=>{
  const p=profile({goalType:'curves',equipment:['none'],experience:'beginner'});
  const session=catalogSession(p,'curves-floor-start');
  for(const id of ['clamshell','sidehipraise','donkeykick']){
    const steps=session.steps.filter(step=>step.type==='work'&&step.exercise===id);
    assert.ok(steps.some(step=>/left side/.test(step.label??'')));
    assert.ok(steps.some(step=>/right side/.test(step.label??'')));
  }
  const restricted=catalogSession({...p,restrictions:['wrist','knee']},'curves-floor-start');
  assert.ok(restricted.steps.every(step=>!['donkeykick','clamshell','standinghipabduction','standinghipextension'].includes(step.exercise)));
  assert.throws(()=>catalogSession({...p,restrictions:['no-floor']},'curves-floor-start'),/No glutes movements/);
  assert.throws(()=>catalogSession({...p,equipment:['chair'],restrictions:['knee','wrist','no-floor']},'curves-standing-start'),/No glutes movements/);
});
