import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {initHome} from '../dist/home.js';
import {freshState,dateKey,WorkoutTimer} from '../dist/engine.js';
import {CHECKPOINT_KEY,checkpointFor} from '../dist/checkpoint.js';

const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../dist/home.css',import.meta.url),'utf8');
function fixture(saved,timer,options={}){
  const win=new Window({url:'https://example.test/calisthenics/',settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
  win.document.write(html);for(const [key,value] of Object.entries(options.records||{}))win.localStorage.setItem(key,JSON.stringify(value));const state=saved||freshState(),calls={selected:0,preferences:0,routes:[],messages:[]};
  const showView=name=>{calls.routes.push(name);win.document.querySelectorAll('.view').forEach(view=>view.hidden=view.id!=='view-'+name);};
  // The application router already delegates these attributes; Home preserves
  // that contract instead of creating competing navigation listeners.
  win.document.addEventListener('click',event=>{const target=event.target.closest('[data-go],[data-view]');if(target)showView(target.dataset.go||target.dataset.view);});
  const home=initHome(win,{getState:()=>state,timer,checkpointKey:options.checkpointKey,showView,selectPersonalized:()=>calls.selected++,openGoal:()=>calls.preferences++,toast:message=>calls.messages.push(message)});
  showView('home');
  return {win,state,home,calls,showView,element:id=>win.document.getElementById(id),close:async()=>{home.dispose();await win.happyDOM.close();}};
}
function accepted(){const state=freshState();state.profile.safetyAccepted=true;return state;}
const visibleViews=doc=>[...doc.querySelectorAll('.view')].filter(view=>!view.hidden).map(view=>view.id);

test('Home is one compact screen with routes to every main destination',async()=>{
  const t=fixture(accepted());try{
    assert.deepEqual(visibleViews(t.win.document),['view-home']);
    assert.equal(t.win.document.querySelector('.sidebar nav [data-view="home"]').textContent,'Home');
    assert.equal(t.win.document.querySelectorAll('.sidebar nav .nav-item').length,5);
    assert.equal(t.win.document.querySelector('.brand').getAttribute('href'),'#home');
    for(const route of ['discover','plan','progress']){
      t.element('view-home').querySelector('[data-go="'+route+'"]').click();
      assert.deepEqual(visibleViews(t.win.document),['view-'+route]);
      t.showView('home');
    }
    t.element('home-open-session').click();
    assert.equal(t.calls.selected,1);
    assert.deepEqual(visibleViews(t.win.document),['view-workout']);
    assert.match(css,/\[hidden\]\{display:none!important\}/);
  }finally{await t.close();}
});

test('Catalog sections remain accessible while only one catalog panel is shown',async()=>{
  const t=fixture(accepted());try{
    const panels=()=>[...t.win.document.querySelectorAll('.discover-panel')].filter(panel=>!panel.hidden);
    assert.deepEqual(panels().map(panel=>panel.dataset.discoverPanel),['workouts']);
    const originalBuilder=t.element('open-builder');let builderClicks=0;originalBuilder.addEventListener('click',()=>builderClicks++);
    for(const [panel,feature] of [['programs','program-grid'],['mine','create-custom'],['personal','choose-curves-goal'],['workouts','routine-search']]){
      const button=t.win.document.querySelector('button[data-discover-panel="'+panel+'"]');button.click();
      assert.equal(panels().length,1);
      assert.equal(panels()[0].dataset.discoverPanel,panel);
      assert.ok(panels()[0].contains(t.element(feature)));
      assert.equal(button.getAttribute('aria-pressed'),'true');
      assert.equal(t.win.document.querySelectorAll('.discover-navigation [aria-pressed="true"]').length,1);
    }
    assert.equal(t.element('open-builder'),originalBuilder);originalBuilder.click();assert.equal(builderClicks,1);
    t.win.document.querySelector('button[data-discover-panel="personal"]').click();
    t.element('explore-curves').click();
    assert.deepEqual(panels().map(panel=>panel.dataset.discoverPanel),['workouts']);
    t.showView('discover');t.element('view-discover').querySelector('[data-view="library"]').click();
    assert.deepEqual(visibleViews(t.win.document),['view-library']);
  }finally{await t.close();}
});

test('Weekly completion counts actual completed dates without counting partial or future sessions',async()=>{
  const state=accepted(),today=dateKey(),tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  state.workouts=[{date:today,skipped:0,seconds:600},{date:today,skipped:0,seconds:720},{date:today,skipped:1,seconds:100},{date:today,skipped:0,seconds:0},{date:dateKey(tomorrow),skipped:0,seconds:600}];
  const t=fixture(state);try{
    assert.equal(t.element('home-week-caption').textContent,'1 completed day');
    assert.equal(t.element('home-week').querySelectorAll('.complete').length,1);
    assert.match(t.element('home-week').querySelector('[aria-current="date"]').title,/completed workout/);
    t.state.workouts=[];t.home.render();assert.equal(t.element('home-week-caption').textContent,'0 completed days');
  }finally{await t.close();}
});

test('Home opens setup for a new profile and treats the display name as text',async()=>{
  const state=freshState();state.profile.name='<img src=x onerror=alert(1)>';
  const t=fixture(state);try{
    assert.equal(t.element('home-greeting').textContent,'Hi, <img src=x onerror=alert(1)>.');
    assert.equal(t.element('view-home').querySelector('img'),null);
    assert.equal(t.element('home-session-action').textContent,'Set up my plan');
    t.element('home-open-session').click();assert.equal(t.calls.preferences,1);assert.equal(t.calls.selected,0);
    t.element('home-edit-plan').click();assert.equal(t.calls.preferences,2);
  }finally{await t.close();}
});

test('Continuing a paused or saved session preserves its identity and does not replace it',async()=>{
  const timer={status:'paused',id:'personalized',descriptor:{routineId:'my-workout'},elapsed:42};
  const t=fixture(accepted(),timer);try{
    assert.equal(t.element('home-resume').hidden,false);
    t.element('home-open-session').click();assert.equal(t.calls.selected,0);assert.equal(timer.descriptor.routineId,'my-workout');
    assert.deepEqual(visibleViews(t.win.document),['view-workout']);
    timer.status='ready';t.element('workout-recovery').hidden=false;t.home.render();
    t.element('home-open-session').click();assert.equal(t.calls.selected,0);
    assert.match(t.element('home-resume-copy').textContent,/interrupted session/);
  }finally{await t.close();}
});

test('An incompatible personal plan opens preferences instead of claiming a ready workout',async()=>{
  const state=accepted();state.profile.goalType='curves';state.profile.targetValue=null;state.profile.targetUnit='reps';state.profile.equipment=['none'];state.profile.restrictions=['no-floor'];
  const t=fixture(state);try{
    assert.equal(t.element('home-session-title').textContent,'Review your plan.');
    t.element('home-open-session').click();assert.equal(t.calls.preferences,1);assert.equal(t.calls.selected,0);
    t.home.dispose();t.element('home-edit-plan').click();assert.equal(t.calls.preferences,1);
  }finally{await t.close();}
});

test('An account Home reads only its scoped checkpoint while guest Home keeps the guest key',async()=>{
  let now=0;const source=new WorkoutTimer('foundation',()=>now);source.start();now=5000;source.pause();const checkpoint=checkpointFor(source),accountKey='form.user.account-a.workout.v1';
  const t=fixture(accepted(),undefined,{checkpointKey:accountKey,records:{[CHECKPOINT_KEY]:checkpoint}});try{
    assert.equal(t.element('home-resume').hidden,true);
    t.element('home-open-session').click();assert.equal(t.calls.selected,1);
    t.win.localStorage.setItem(accountKey,JSON.stringify(checkpoint));t.home.render();
    assert.equal(t.element('home-resume').hidden,false);
    assert.match(t.element('home-resume-copy').textContent,/interrupted session/);
    t.element('home-open-session').click();assert.equal(t.calls.selected,1);
  }finally{await t.close();}
  const guest=fixture(accepted(),undefined,{records:{[CHECKPOINT_KEY]:checkpoint}});try{
    assert.equal(guest.element('home-resume').hidden,false);
    guest.element('home-open-session').click();assert.equal(guest.calls.selected,0);
  }finally{await guest.close();}
});
