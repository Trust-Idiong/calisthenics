import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROUTINES,PROGRAMS,catalogSession,routineAvailability} from '../dist/catalog.js';
import {EXERCISES} from '../dist/exercises.js';
import {sessionAllowed} from '../dist/planner.js';
import {validateSessionDescriptor} from '../dist/engine.js';

const ids=['six-pack-start','six-pack-control','six-pack-progress'];
const profile=changes=>({startDate:'2026-10-16',durationWeeks:12,experience:'advanced',ageBand:'adult',equipment:['none'],lowImpact:true,...changes});
const total=session=>session.steps.reduce((sum,step)=>sum+step.duration,0);
const work=session=>session.steps.filter(step=>step.type==='work');
const workSeconds=session=>work(session).reduce((sum,step)=>sum+step.duration,0);

test('six-pack collection uses three explicit adult levels and retains all earlier catalog identities',()=>{
  assert.equal(ROUTINES.length,40);assert.equal(PROGRAMS.length,8);assert.equal(Object.keys(EXERCISES).length,37);
  const collection=ids.map(id=>ROUTINES.find(r=>r.id===id));
  assert.deepEqual(collection.map(r=>r.level),['beginner','intermediate','advanced']);assert.deepEqual(collection.map(r=>r.defaultMinutes),[15,20,25]);
  for(const r of collection){assert.equal(r.adultOnly,true);assert.equal(r.area,'abs');assert.deepEqual(r.secondaryAreas,['core']);assert.deepEqual(r.requiredAreas,['core']);assert.ok(r.goalTags.includes('abs'));assert.ok(r.movements.every(id=>EXERCISES[id].bodyAreas.includes('core')));assert.match(r.description,/cannot spot-reduce.*guarantee visible abs/);}
  for(const id of ['abs-control','abs-crunch','core-stable','core-floor','core-side','curves-floor-start','curves-standing-start','glutes-progressive'])assert.ok(ROUTINES.find(r=>r.id===id),id);
  for(const id of ['core-four','curves-eight'])assert.ok(PROGRAMS.find(p=>p.id===id),id);
});
test('abs programme is a flexible twelve-week template with separated practice days and three variants',()=>{
  const program=PROGRAMS.find(p=>p.id==='abs-definition');assert.equal(program.weeks,12);assert.equal(program.durationWeeks,12);assert.deepEqual(program.routineOptions,ids);assert.deepEqual(program.suggestedWeeks,[8,12,16]);assert.equal(program.adultOnly,true);assert.deepEqual(program.schedule.map(day=>day.day),[1,3,5]);assert.equal(program.routineId,ids[0]);assert.match(program.description,/rather than predicting when abs will become visible/);assert.match(program.assessment,/not a body-fat or visible-definition score/);
  for(const entry of program.schedule)assert.ok(ids.includes(entry.routineId));
});
test('each abs variant produces a complete timer-valid session at its matching experience level',()=>{
  for(const [index,id] of ids.entries()){
    const p=profile({experience:['beginner','intermediate','advanced'][index]});const session=catalogSession(p,id);
    assert.equal(total(session),[15,20,25][index]*60);assert.equal(session.steps[0].type,'warmup');assert.equal(session.steps.at(-1).type,'cooldown');assert.ok(work(session).length>0);assert.ok(work(session).every(step=>EXERCISES[step.exercise].bodyAreas.includes('core')));assert.equal(sessionAllowed(p,session.steps),true);assert.doesNotThrow(()=>validateSessionDescriptor(session));
    // A bilateral interval uses five seconds to change sides and the remaining
    // forty seconds for recovery; non-bilateral intervals retain all 45 seconds.
    assert.ok(session.steps.filter(step=>step.type==='rest').every(step=>step.duration>=40||step.label==='Relax and change sides'));
  }
});
test('abs sessions retain exact optional durations and lighter recovery every fourth week',()=>{
  for(const id of ids){const p=profile();for(const minutes of [5,15,30,60])assert.equal(total(catalogSession(p,id,{minutes})),minutes*60);const regular=catalogSession(p,id,{week:3}),lighter=catalogSession(p,id,{week:4});assert.ok(workSeconds(lighter)<workSeconds(regular));assert.match(lighter.adaptationReason,/fourth week is lighter/);assert.equal(total(lighter),total(regular));}
});
test('the collection enforces current ability and adult eligibility without inferring from gender',()=>{
  for(const gender of ['male','female','other','prefer-not-to-say'])for(const id of ids)assert.equal(routineAvailability(profile({gender}),id).available,true);
  for(const id of ids){const availability=routineAvailability(profile({ageBand:'teen'}),id);assert.equal(availability.available,false);assert.match(availability.reason,/for adults/);}
  for(const id of ids.slice(1)){assert.equal(routineAvailability(profile({experience:'beginner'}),id).available,false);assert.throws(()=>catalogSession(profile({experience:'beginner'}),id),/routine.*experience|routine\. Choose/);}
});
test('movement restrictions affect every phase and preserve genuine core focus',()=>{
  const p=profile({restrictions:['wrist']});
  for(const id of ids){const session=catalogSession(p,id);assert.ok(session.steps.every(step=>!['bird','mountainclimber','wall','calfstretch'].includes(step.exercise)));assert.ok(work(session).every(step=>EXERCISES[step.exercise].bodyAreas.includes('core')));assert.equal(sessionAllowed(p,session.steps),true);}
  for(const id of ids)assert.equal(routineAvailability(profile({restrictions:['no-floor'],equipment:['none']}),id).available,false);
  const standing=catalogSession(profile({experience:'beginner',restrictions:['no-floor'],equipment:['wall']}),'six-pack-start');assert.ok(work(standing).every(step=>step.exercise==='plank'));
});
test('advanced practice gives both sides equivalent controlled movement windows',()=>{
  const session=catalogSession(profile(),'six-pack-progress');const left=work(session).filter(step=>step.exercise==='sideplank'&&/left side/.test(step.label||'')),right=work(session).filter(step=>step.exercise==='sideplank'&&/right side/.test(step.label||''));assert.ok(left.length>0);assert.equal(left.length,right.length);assert.equal(left.reduce((n,s)=>n+s.duration,0),right.reduce((n,s)=>n+s.duration,0));
  assert.ok(work(session).filter(step=>step.exercise==='mountainclimber').every(step=>step.duration<=30));
});
test('effort feedback changes workload modestly without adding harder exercises or deleting recovery',()=>{
  for(const id of ids){const p=profile(),regular=catalogSession(p,id),easy=catalogSession(p,id,{feedback:'easy'}),hard=catalogSession(p,id,{feedback:'hard'});assert.equal(total(easy),total(regular));assert.equal(total(hard),total(regular));assert.ok(workSeconds(hard)<workSeconds(regular));assert.ok(workSeconds(easy)>=workSeconds(regular));const movements=session=>[...new Set(work(session).map(step=>step.exercise))].sort();assert.deepEqual(movements(easy),movements(regular));assert.deepEqual(movements(hard),movements(regular));assert.ok(easy.steps.filter(step=>step.type==='rest'&&step.label!=='Relax and change sides').every(step=>step.duration>=40));}
});
