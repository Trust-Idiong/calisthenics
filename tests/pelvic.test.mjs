import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {PELVIC_DEFAULTS,validatePelvicSettings,pelvicDose,PelvicTimer,initPelvic} from '../dist/pelvic.js';
import {freshState,validateState,dateKey} from '../dist/engine.js';

test('pelvic dose starts gently and every hold is followed by complete release',()=>{
  const d=pelvicDose();assert.deepEqual(d,{hold:3,relax:6,reps:5,quick:0,seconds:51});
  for(const experience of ['new','practiced'])for(let week=1;week<=12;week++)for(let comfortableHold=1;comfortableHold<=10;comfortableHold++){
    const dose=pelvicDose({...PELVIC_DEFAULTS,experience,week,comfortableHold,quickReps:true});
    assert.ok(dose.hold<=comfortableHold&&dose.hold<=8);assert.ok(dose.relax>=dose.hold&&dose.relax>=6);assert.ok(dose.reps>=5&&dose.reps<=10);assert.equal(dose.quick,3);
    const t=new PelvicTimer(dose);t.phases.forEach((p,i)=>{if(['hold','quick'].includes(p.type)){assert.equal(t.phases[i+1].type,'relax');assert.ok(t.phases[i+1].duration>=p.duration);}});
  }
});
test('pelvic preferences reject malformed inputs and retain only explicit supported fields',()=>{
  for(const changes of [{comfortableHold:0},{comfortableHold:11},{week:13},{week:1.5},{experience:'advanced'},{guide:'auto'},{quickReps:'true'},{adviceAccepted:'yes'}])assert.throws(()=>validatePelvicSettings({...PELVIC_DEFAULTS,...changes}));
  assert.throws(()=>validatePelvicSettings({...PELVIC_DEFAULTS,sexualScore:100}),/preferences/);
});
test('elapsed time and repetitions accrue only from active timer ticks',()=>{
  let clock=0;const d=pelvicDose(),t=new PelvicTimer(d,()=>clock);t.start();
  for(let i=0;i<510;i++){clock+=100;t.tick();}
  assert.equal(t.status,'complete');assert.equal(t.reps,5);assert.equal(t.quickReps,0);assert.ok(Math.abs(t.elapsed-51)<.00001);assert.equal(t.start(),false);
});
test('background discontinuities pause without counting time or finishing a set',()=>{
  let clock=0;const t=new PelvicTimer(pelvicDose(),()=>clock);t.start();clock=500;t.tick();assert.equal(t.elapsed,.5);clock=60500;t.tick();assert.equal(t.status,'paused');assert.equal(t.elapsed,.5);assert.equal(t.reps,0);
  clock+=120000;t.tick();assert.equal(t.elapsed,.5);t.start();clock+=250;t.tick();assert.equal(t.elapsed,.75);
});
test('resuming an interrupted hold first settles and restarts that hold',()=>{
  let clock=0;const t=new PelvicTimer(pelvicDose(),()=>clock);t.start();for(let i=0;i<70;i++){clock+=100;t.tick();}assert.equal(t.phase.type,'hold');assert.ok(t.remaining<3);t.pause();clock+=999999;t.start();assert.equal(t.phase.type,'prepare');assert.equal(t.remaining,6);assert.equal(t.reps,0);
  for(let i=0;i<60;i++){clock+=100;t.tick();}assert.equal(t.phase.type,'hold');assert.equal(t.remaining,3);t.stop();clock+=100;t.tick();assert.equal(t.status,'stopped');assert.equal(t.reps,0);
});

function fixture(saved){
  const win=new Window({url:'https://example.test/dist/',settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});let state=saved||freshState(),clock=0,ticker=()=>{},toasts=[],failures=0,writeBeforeThrow=false,attempts=[];
  win.document.write('<main id="main"><section class="view" id="view-settings"><article class="profile-summary"></article></section><section class="view" id="view-discover" hidden><div id="discover-panel-personal"></div></section></main>');
  Object.defineProperty(win.performance,'now',{value:()=>clock,configurable:true});Object.defineProperty(win.document,'hidden',{value:false,writable:true,configurable:true});win.setInterval=fn=>{ticker=fn;return 1;};win.clearInterval=()=>{};
  const showView=name=>win.document.querySelectorAll('.view').forEach(view=>view.hidden=view.id!=='view-'+name);
  const app=initPelvic(win,{getState:()=>state,commit:fn=>{const next=validateState(fn(state));attempts.push(next.workouts.map(w=>w.id));if(failures>0){failures--;if(writeBeforeThrow)state=next;throw new Error('Storage is unavailable.');}state=next;},showView,toast:message=>toasts.push(message)}),q=selector=>win.document.querySelector(selector),click=selector=>{assert.ok(q(selector),selector);q(selector).click();},change=(selector,value)=>{const target=q(selector);if(target.type==='checkbox')target.checked=value;else target.value=String(value);target.dispatchEvent(new win.Event('change',{bubbles:true}));},submit=()=>q('#pelvic-preferences').dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));
  const start=()=>{click('[data-pelvic-open]');change('#pelvic-advice',true);submit();click('input[value=clear]');change('#pelvic-comfort',true);click('#pelvic-start');};
  return {win,app,q,click,change,submit,start,tick:(seconds=1)=>{for(let i=0;i<seconds*10;i++){clock+=100;ticker();}},advance:seconds=>{clock+=seconds*1000;ticker();},getState:()=>state,setState:value=>{state=value;app.render();},failNextCommits:(count=1,{afterWrite=false}={})=>{failures=count;writeBeforeThrow=afterWrite;},attempts,toasts,close:async()=>{app.dispose();await win.happyDOM.close();}};
}
test('adult practice requires advice, present-day symptom screening and comfortable release',async()=>{
  const t=fixture();try{t.click('[data-pelvic-open]');t.click('#pelvic-start');assert.equal(t.app.timer.status,'ready');assert.match(t.q('#pelvic-player-error').textContent,/health professional/);
    t.change('#pelvic-advice',true);t.submit();t.click('#pelvic-start');assert.match(t.q('#pelvic-player-error').textContent,/readiness/);t.click('input[value=assessment]');assert.equal(t.q('#pelvic-player').hidden,true);assert.equal(t.q('#pelvic-relaxation').hidden,false);t.click('#pelvic-return');assert.equal(t.q('#pelvic-player').hidden,true);assert.equal(t.getState().workouts.length,0);
    t.click('input[value=clear]');t.change('#pelvic-comfort',true);t.click('#pelvic-start');assert.equal(t.app.timer.status,'running');assert.equal(t.getState().settings.pelvic.adviceAccepted,true);
  }finally{await t.close();}
});
test('both technique guides are available without inferred gender or ability',async()=>{
  const s=freshState();s.profile.gender='prefer-not-to-say';const t=fixture(s);try{t.click('[data-pelvic-open]');assert.equal(t.q('#pelvic-guide').value,'general');t.change('#pelvic-guide','men');t.submit();assert.match(t.q('#pelvic-technique').textContent,/testicles/);assert.equal(t.app.timer.dose.hold,3);t.change('#pelvic-guide','women');t.submit();assert.match(t.q('#pelvic-technique').textContent,/vaginal/);assert.equal(t.app.timer.dose.hold,3);assert.equal(t.getState().profile.gender,'prefer-not-to-say');}finally{await t.close();}
});
test('a completed set logs actual time once without calories, sexual scores or body targets',async()=>{
  const t=fixture();try{t.start();t.tick(51);assert.equal(t.app.timer.status,'complete');const records=t.getState().workouts;assert.equal(records.length,1);assert.equal(records[0].routineId,'pelvic-floor');assert.equal(records[0].title,'Pelvic floor practice');assert.equal(records[0].seconds,51);assert.equal(records[0].skipped,0);assert.equal(records[0].date,dateKey(new Date()));assert.equal(records[0].kcal,undefined);assert.equal(records[0].sexualScore,undefined);assert.equal(t.getState().profile.targetValue,180);t.tick(90);t.click('#pelvic-start');assert.equal(t.getState().workouts.length,1);assert.equal(t.q('#pelvic-start').disabled,true);assert.match(t.q('#pelvic-progress-copy').textContent,/1 completed set/);assert.match(t.q('#pelvic-today-copy').textContent,/Rest until tomorrow/);
  }finally{await t.close();}
});
test('stop and symptom stop never save unfinished sets',async()=>{
  const t=fixture();try{t.start();t.tick(10);t.click('#pelvic-stop');assert.equal(t.app.timer.status,'stopped');assert.equal(t.getState().workouts.length,0);t.click('#pelvic-start');t.tick(10);t.click('#pelvic-pain-stop');assert.equal(t.app.timer.status,'stopped');assert.equal(t.getState().workouts.length,0);assert.equal(t.q('#pelvic-relaxation').hidden,false);assert.equal(t.q('#pelvic-player').hidden,true);assert.match(t.toasts.at(-1),/Release completely/);}finally{await t.close();}
});
test('navigation, hidden documents and reloading pause or discard elapsed activity safely',async()=>{
  const t=fixture();try{t.start();t.tick(7);const elapsed=t.app.timer.elapsed;t.app.onNavigate('progress');assert.equal(t.app.timer.status,'paused');t.advance(300);assert.equal(t.app.timer.elapsed,elapsed);t.click('#pelvic-start');t.win.document.hidden=true;t.win.document.dispatchEvent(new t.win.Event('visibilitychange'));assert.equal(t.app.timer.status,'paused');t.advance(300);assert.equal(t.getState().workouts.length,0);const saved=t.getState();const reload=fixture(saved);try{assert.equal(reload.app.timer.status,'ready');assert.equal(reload.app.timer.elapsed,0);assert.equal(reload.getState().workouts.length,0);assert.equal(reload.q('input[name=pelvic-screen]:checked'),null);}finally{await reload.close();}}finally{await t.close();}
});
test('teen profiles cannot start this adult practice and retain old completed records',async()=>{
  const s=freshState();s.profile.ageBand='teen';s.workouts=[{id:'past-pelvic',date:dateKey(),session:'personalized',seconds:51,skipped:0,title:'Pelvic floor practice',routineId:'pelvic-floor',goalType:'core'}];const t=fixture(s);try{assert.ok([...t.win.document.querySelectorAll('[data-pelvic-open]')].every(link=>link.hidden));assert.equal(t.q('#pelvic-adult-content').hidden,true);assert.equal(t.q('#pelvic-start').disabled,true);t.click('#pelvic-start');assert.equal(t.app.timer.status,'stopped');assert.equal(t.getState().workouts.length,1);}finally{await t.close();}
});
test('changing to a teen profile stops an adult set without recording it',async()=>{const t=fixture();try{t.start();t.tick(10);const s=t.getState();s.profile.ageBand='teen';t.setState(s);assert.equal(t.app.timer.status,'stopped');assert.equal(t.getState().workouts.length,0);assert.equal(t.q('#pelvic-adult-content').hidden,true);}finally{await t.close();}});

test('a ready trainer starts with remotely loaded preferences rather than its initial dose',async()=>{
  const t=fixture();try{const s=t.getState();s.settings.pelvic={...PELVIC_DEFAULTS,experience:'practiced',comfortableHold:7,week:5,quickReps:true,adviceAccepted:true};t.setState(s);t.click('[data-pelvic-open]');t.click('input[value=clear]');t.change('#pelvic-comfort',true);assert.equal(t.app.timer.status,'ready');t.click('#pelvic-start');assert.deepEqual(t.app.timer.dose,pelvicDose(s.settings.pelvic));assert.match(t.q('#pelvic-dose-summary').textContent,/8 gentle holds.*7s lift \/ 7s release.*3 brief lifts/);t.tick(130);assert.equal(t.getState().workouts.length,1);assert.equal(t.getState().workouts[0].seconds,130);}finally{await t.close();}
});
test('root render preserves paused timer, its dose and the reload-protection status',async()=>{
  const t=fixture();try{t.start();t.tick(7);t.app.pause();const dose={...t.app.timer.dose},elapsed=t.app.timer.elapsed,s=t.getState();s.settings.pelvic={...PELVIC_DEFAULTS,experience:'practiced',comfortableHold:8,week:9,adviceAccepted:true};t.setState(s);assert.equal(t.app.timer.status,'paused');assert.deepEqual(t.app.timer.dose,dose);assert.equal(t.app.timer.elapsed,elapsed);assert.equal(t.win.document.documentElement.dataset.pelvicRunning,'false');assert.equal(t.win.document.documentElement.dataset.pelvicStatus,'paused');t.click('#pelvic-start');assert.deepEqual(t.app.timer.dose,dose);assert.equal(t.win.document.documentElement.dataset.pelvicStatus,'running');t.app.dispose();assert.equal(t.win.document.documentElement.dataset.pelvicStatus,'ready');assert.equal(t.win.document.documentElement.dataset.pelvicPendingSave,'false');}finally{await t.close();}
});
test('failed completed-set saves stay visibly recoverable and retry the same entry exactly once',async()=>{
  const t=fixture();try{t.start();t.failNextCommits(2);t.tick(51);assert.equal(t.app.timer.status,'complete');assert.equal(t.getState().workouts.length,0);assert.equal(t.q('#pelvic-save-recovery').hidden,false);assert.match(t.q('#pelvic-cue').textContent,/saving failed.*retry/);assert.doesNotMatch(t.q('#pelvic-cue').textContent,/is saved|export/i);assert.match(t.q('#pelvic-save-recovery').textContent,/held only in this open app/);assert.equal(t.win.document.documentElement.dataset.pelvicPendingSave,'true');const id=t.attempts.at(-1)[0];assert.ok(id);t.app.render();t.app.pause();assert.match(t.q('#pelvic-cue').textContent,/saving failed/);t.submit();assert.equal(t.app.timer.status,'complete');assert.equal(t.q('#pelvic-advice').disabled,true);t.click('#pelvic-retry-save');assert.equal(t.getState().workouts.length,0);assert.equal(t.attempts.at(-1)[0],id);assert.match(t.q('#pelvic-cue').textContent,/saving failed/);t.click('#pelvic-retry-save');assert.equal(t.getState().workouts.length,1);assert.equal(t.getState().workouts[0].id,id);assert.equal(t.getState().workouts[0].seconds,51);assert.equal(t.q('#pelvic-save-recovery').hidden,true);assert.equal(t.win.document.documentElement.dataset.pelvicPendingSave,'false');assert.match(t.q('#pelvic-cue').textContent,/is saved/);t.click('#pelvic-retry-save');assert.equal(t.getState().workouts.length,1);}finally{await t.close();}
});
test('retry does not duplicate a completed entry if a late save error followed a successful write',async()=>{
  const t=fixture();try{t.start();t.failNextCommits(1,{afterWrite:true});t.tick(51);assert.equal(t.getState().workouts.length,1);assert.equal(t.win.document.documentElement.dataset.pelvicPendingSave,'true');const id=t.getState().workouts[0].id;t.click('#pelvic-retry-save');assert.equal(t.getState().workouts.length,1);assert.equal(t.getState().workouts[0].id,id);assert.equal(t.win.document.documentElement.dataset.pelvicPendingSave,'false');}finally{await t.close();}
});
