import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {freshState,validateState,weeklySummary,dateKey} from '../dist/engine.js';
import {GOALS,validatePreferences,recommendedSession,goalProgress} from '../dist/planner.js';
import {EXERCISES} from '../dist/exercises.js';
import {initApp} from '../dist/ui.js';
import {initAuth} from '../dist/auth.js';
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');

test('v4 backups retain history and gain supported private practice preferences',()=>{
  const state=freshState();delete state.settings.pelvic;state.workouts=[{id:'old',date:dateKey(),session:'foundation',seconds:300,skipped:0}];
  const restored=validateState(state);assert.equal(restored.workouts[0].id,'old');assert.equal(restored.settings.pelvic.comfortableHold,3);
  restored.settings.pelvic={guide:'women',experience:'practiced',comfortableHold:6,week:5,quickReps:true,adviceAccepted:true};
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(restored))).settings.pelvic,restored.settings.pelvic);
  assert.throws(()=>validateState({...restored,settings:{...restored.settings,pelvic:{...restored.settings.pelvic,sexualScore:100}}}),/preferences/);
});

test('adult abs plans use eligible core movements across levels, genders and timeframes',()=>{
  for(const gender of ['male','female','other'])for(const experience of ['beginner','intermediate','advanced'])for(const durationWeeks of [2,12,52]){
    const profile=validatePreferences({...freshState('2026-10-13').profile,deadline:undefined,goalType:'abs',targetValue:null,targetUnit:'reps',gender,experience,durationWeeks,focusAreas:['arms']});
    const session=recommendedSession(profile);assert.equal(session.steps.reduce((n,s)=>n+s.duration,0),profile.sessionMinutes*60);
    assert.ok(session.steps.some(s=>s.type==='work'&&EXERCISES[s.exercise].bodyAreas.includes('core')));
    assert.match(session.description,/does not promise a six-pack/);
  }
  const state=freshState();state.profile.goalType='abs';delete state.profile.targetValue;delete state.profile.targetUnit;
  assert.equal(validateState(state).profile.targetValue,null);assert.equal(validateState(state).profile.targetUnit,'reps');assert.equal(Object.keys(GOALS).length,10);
  state.profile.targetUnit='reps';state.profile.targetValue=null;state.workouts=[{id:'practice',date:dateKey(),session:'personalized',seconds:600,skipped:0,goalType:'abs'}];
  assert.equal(goalProgress(state).current,null);
});

test('teen and conflicting age/year profiles cannot enable appearance targets',()=>{
  for(const goalType of ['abs','curves']){
    const state=freshState();Object.assign(state.profile,{goalType,targetUnit:'reps',targetValue:null,ageBand:'teen'});
    assert.throws(()=>validateState(state),/teen/);assert.throws(()=>validatePreferences(state.profile),/adults/);
    state.profile.ageBand='adult';state.profile.birthYear=new Date().getFullYear()-17;
    assert.throws(()=>validateState(state),/teen age group/);assert.throws(()=>validatePreferences(state.profile),/teen age group/);
  }
});

test('pelvic practice retains actual minutes without completing a strength or planned habit day',()=>{
  const state=freshState('2026-10-13');Object.assign(state.profile,{goalType:'consistency',targetUnit:'sessions',targetValue:8,days:[2]});
  state.workouts=[{id:'pelvic',date:'2026-10-13',session:'personalized',routineId:'pelvic-floor',title:'Pelvic floor practice',seconds:120,skipped:0}];
  const summary=weeklySummary(state,'2026-10-12','2026-10-18');assert.equal(summary.minutes,2);assert.equal(summary.complete.length,1);assert.equal(summary.strengthDays,0);assert.equal(goalProgress(state,'2026-10-13').current,0);
  state.workouts.push({id:'training',date:'2026-10-13',session:'foundation',seconds:600,skipped:0});assert.equal(weeklySummary(state,'2026-10-12','2026-10-18').strengthDays,1);assert.equal(goalProgress(state,'2026-10-13').current,1);
});

function fixture(state=freshState()){
  state.profile.onboardingComplete=true;state.profile.safetyAccepted=true;
  const win=new Window({url:'https://form.test/',settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true,disableIframePageLoading:true}});win.scrollTo=()=>{};win.confirm=()=>true;win.setInterval=()=>1;win.clearInterval=()=>{};win.document.write(html);win.localStorage.setItem('form-seven.v1',JSON.stringify(state));
  const auth=initAuth(win,{config:{apiBaseUrl:null,requireAccounts:false}}),app=initApp(win,{auth});
  return{win,app,q:s=>win.document.querySelector(s),close:async()=>{app.dispose();await win.happyDOM.close();}};
}
test('root exposes one pelvic screen, persists preferences and pauses on navigation',async()=>{
  const t=fixture();try{
    t.app.showView('pelvic');assert.deepEqual([...t.win.document.querySelectorAll('.view')].filter(v=>!v.hidden).map(v=>v.id),['view-pelvic']);
    t.q('#pelvic-guide').value='men';t.q('#pelvic-advice').checked=true;t.q('#pelvic-preferences').dispatchEvent(new t.win.Event('submit',{bubbles:true,cancelable:true}));
    assert.equal(t.app.getState().settings.pelvic.guide,'men');assert.equal(JSON.parse(t.win.localStorage.getItem('form-seven.v1')).settings.pelvic.adviceAccepted,true);
    t.q('[name=pelvic-screen][value=clear]').checked=true;t.q('#pelvic-comfort').checked=true;t.q('#pelvic-start').click();assert.equal(t.app.pelvic.timer.status,'running');
    t.app.showView('home');assert.equal(t.app.pelvic.timer.status,'paused');assert.equal(t.win.document.documentElement.dataset.pelvicStatus,'paused');assert.equal(t.app.getState().workouts.length,0);
  }finally{await t.close();}
});
test('teen profiles hide pelvic/abs entries and direct pelvic navigation blocks practice',async()=>{
  const state=freshState();state.profile.ageBand='teen';const t=fixture(state);try{
    assert.equal(t.q('#abs-discover').hidden,true);t.app.showView('pelvic');assert.equal(t.q('#pelvic-adult-content').hidden,true);assert.equal(t.q('#pelvic-adult-note').hidden,false);t.q('#pelvic-start').click();assert.notEqual(t.app.pelvic.timer.status,'running');
  }finally{await t.close();}
});
