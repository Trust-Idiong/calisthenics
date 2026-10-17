// A separate pelvic-floor practice timer: short contractions always alternate
// with complete release. It never reuses long whole-body workout intervals.
import {PELVIC_DEFAULTS,validatePelvicSettings} from './pelvic-settings.js';
export {PELVIC_DEFAULTS,validatePelvicSettings};
export function pelvicDose(value){
  const p=validatePelvicSettings(value),level=Math.min(p.experience==='new'?3:4,Math.floor((p.week-1)/2));
  const hold=Math.min(p.comfortableHold,p.experience==='new'?3+level:5+level,8);
  const reps=Math.min(10,(p.experience==='new'?5:6)+level),relax=Math.max(6,hold),quick=p.quickReps?3:0;
  return {hold,relax,reps,quick,seconds:6+reps*(hold+relax)+quick*4};
}
export class PelvicTimer{
  constructor(dose,now=()=>performance.now()){this.now=now;this.reset(dose);}
  reset(dose){
    if(!dose||!Number.isInteger(dose.hold)||dose.hold<1||dose.hold>10||!Number.isInteger(dose.relax)||dose.relax<Math.max(6,dose.hold)||dose.relax>30||!Number.isInteger(dose.reps)||dose.reps<1||dose.reps>10||!Number.isInteger(dose.quick)||dose.quick<0||dose.quick>3)throw new Error('The pelvic floor practice dose is invalid.');
    this.dose={...dose};this.phases=[{type:'prepare',duration:6,rep:0}];
    for(let rep=1;rep<=dose.reps;rep++)this.phases.push({type:'hold',duration:dose.hold,rep},{type:'relax',duration:dose.relax,rep,kind:'long'});
    for(let rep=1;rep<=dose.quick;rep++)this.phases.push({type:'quick',duration:1,rep},{type:'relax',duration:3,rep,kind:'quick'});
    this.index=0;this.remaining=6;this.elapsed=0;this.status='ready';this.last=0;this.reps=0;this.quickReps=0;this.interrupted=false;
  }
  get phase(){return this.phases[Math.min(this.index,this.phases.length-1)];}
  start(){
    if(!['ready','paused'].includes(this.status))return false;
    if(this.status==='paused'&&['hold','quick'].includes(this.phase.type)){
      this.remaining=this.phase.duration;this.phases.splice(this.index,0,{type:'prepare',duration:6,rep:0});this.remaining=6;
    }else if(this.status==='paused')this.remaining=this.phase.duration;
    this.status='running';this.last=this.now();this.interrupted=false;return true;
  }
  pause(){if(this.status==='running'){this.status='paused';this.interrupted=true;}}
  stop(){this.status='stopped';this.interrupted=true;}
  tick(){
    if(this.status!=='running')return false;
    const current=this.now(),delta=Math.max(0,(current-this.last)/1000);this.last=current;
    // A suspended/background tab cannot silently complete a muscle contraction.
    if(delta>1.5){this.pause();return false;}
    let left=delta;
    while(left>0&&this.status==='running'){
      const used=Math.min(left,this.remaining);this.remaining-=used;this.elapsed+=used;left-=used;
      if(this.elapsed>=1800){this.stop();return false;}
      if(this.remaining<=0.000001){
        if(this.phase.type==='relax'){if(this.phase.kind==='long')this.reps++;else this.quickReps++;}
        this.index++;if(this.index===this.phases.length){this.status='complete';this.remaining=0;return true;}
        this.remaining=this.phase.duration;
      }
    }
    return false;
  }
}

const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const time=value=>`${Math.floor(Math.max(0,Math.ceil(value))/60).toString().padStart(2,'0')}:${(Math.max(0,Math.ceil(value))%60).toString().padStart(2,'0')}`;
const guidance={
  general:'Imagine gently stopping gas and lifting inward. Release completely after each squeeze. A pelvic health professional can help you identify the muscles.',
  men:'Gently lift around the back passage as if preventing gas. The base of the penis may draw inward and the testicles may lift. Release until the muscles feel fully at rest.',
  women:'Gently lift around the back passage and the urinary and vaginal openings. Think of an inward lift, then let the muscles return fully to rest.',
};

export function initPelvic(win,api){
  const doc=win.document,main=doc.getElementById('main');if(!main)throw new Error('Pelvic floor practice needs the application container.');
  const abort=new win.AbortController(),on=(el,type,handler)=>el.addEventListener(type,handler,{signal:abort.signal}),el=id=>doc.getElementById(id);
  let preferences=validatePelvicSettings(api.getState().settings?.pelvic),timer=new PelvicTimer(pelvicDose(preferences),()=>win.performance.now()),recorded=false,relaxOnly=false,saveError='',pendingEntry=null;
  const view=doc.createElement('section');view.id='view-pelvic';view.className='view pelvic-view';view.hidden=true;
  view.innerHTML=`<header class="pelvic-heading"><button type="button" class="text-btn" id="pelvic-back">&larr; Profile</button><span class="eyebrow">CONTROL + COMPLETE RELEASE</span><h1>Pelvic floor practice.</h1><p>Gentle Kegel exercises for men and women, with equal attention to relaxation.</p></header>
    <p id="pelvic-adult-note" class="pelvic-notice" hidden>This guided practice is available for adult profiles. Your other movement and strength sessions remain available.</p>
    <aside id="pelvic-save-recovery" class="pelvic-notice" role="alert" hidden><strong>Your completed set still needs saving.</strong><p>This set is held only in this open app. Keep the app open and retry saving before refreshing or closing it.</p><button id="pelvic-retry-save" type="button" class="outline-btn">Retry save completed set</button></aside>
    <div id="pelvic-adult-content"><article class="card pelvic-intro"><h2>Practice for control.</h2><p>Pelvic floor training may support sexual function. FORM tracks practice, rather than sexual performance; results vary. Ask a health professional whether strengthening is suitable for you. <a href="https://www.niddk.nih.gov/health-information/urologic-diseases/kegel-exercises" target="_blank" rel="noopener noreferrer">NIDDK guidance</a></p><p>Keep breathing. Avoid clenching the belly, buttocks or thighs, pushing down or straining. Do not practise by repeatedly stopping urine flow.</p></article>
    <form id="pelvic-preferences" class="card pelvic-preferences"><h2>Your practice guide</h2><div class="pelvic-fields"><label>Technique guide<select id="pelvic-guide"><option value="general">General</option><option value="men">Men</option><option value="women">Women</option></select></label><label>Previous practice<select id="pelvic-experience"><option value="new">New to pelvic floor practice</option><option value="practiced">Practised with comfortable release</option></select></label><label>Comfortable hold, in seconds<input id="pelvic-hold" type="number" min="1" max="10" step="1" value="3" required></label><label>Chosen stage<select id="pelvic-week">${Array.from({length:6},(_,i)=>`<option value="${i*2+1}">Weeks ${i*2+1}&ndash;${i*2+2}</option>`).join('')}</select></label></div><label class="checkbox-label"><input id="pelvic-quick" type="checkbox"><span>Include three brief squeeze-and-release repetitions</span></label><p class="form-note">Start with five short holds and long releases. Later stages stay optional: advance only when the current practice is easy, pain-free and fully relaxed between repetitions. Return to a shorter hold whenever needed.</p><label class="checkbox-label"><input id="pelvic-advice" type="checkbox"><span>I have checked with a health professional that pelvic floor strengthening is suitable for me.</span></label><button type="submit" class="outline-btn">Save practice preferences</button><p id="pelvic-preference-error" class="form-error" role="alert"></p></form>
    <article id="pelvic-readiness" class="card pelvic-readiness"><h2>Before every set</h2><p>Today, do you have pelvic pain or tightness, painful urination, trouble emptying your bladder, pain with sex, pregnancy, or recent pelvic surgery?</p><fieldset class="pelvic-screen"><legend>Choose the answer that fits today</legend><label><input type="radio" name="pelvic-screen" value="clear"> None of these applies</label><label><input type="radio" name="pelvic-screen" value="assessment"> Yes, or I am unsure</label></fieldset><label class="checkbox-label"><input id="pelvic-comfort" type="checkbox"><span>I can gently lift and fully release without pain, strain or holding my breath.</span></label><p id="pelvic-screen-note" class="pelvic-notice" hidden>Use relaxation rather than strengthening for now, and ask a pelvic health professional for an assessment. Tight muscles may need relaxation before strengthening. <a href="https://www.stgeorges.nhs.uk/wp-content/uploads/2025/05/PHP_PFR.pdf" target="_blank" rel="noopener noreferrer">NHS relaxation guidance</a></p><button id="pelvic-relax-open" type="button" class="text-btn">Read the relaxation guide</button></article>
    <article id="pelvic-player" class="card pelvic-player" aria-labelledby="pelvic-player-title"><span class="eyebrow" id="pelvic-dose-summary"></span><h2 id="pelvic-player-title">One comfortable set.</h2><p id="pelvic-technique"></p><div id="pelvic-ring" class="pelvic-ring" data-phase="ready"><div><span id="pelvic-phase">Ready</span><strong id="pelvic-remaining">00:06</strong><small id="pelvic-repetition">Prepare and breathe</small></div></div><p id="pelvic-cue" class="pelvic-cue" role="status" aria-live="polite">Sit or lie comfortably. Let your belly, thighs and buttocks soften.</p><div class="pelvic-actions"><button id="pelvic-start" type="button" class="primary-btn">Start practice</button><button id="pelvic-pause" type="button" class="outline-btn" hidden>Pause &amp; release</button><button id="pelvic-stop" type="button" class="outline-btn" hidden>Stop without logging</button></div><button id="pelvic-pain-stop" type="button" class="safety-stop" hidden>Stop: pain, tightness or discomfort</button><p id="pelvic-player-error" class="form-error" role="alert"></p><p class="form-note">One guided set a day. Every squeeze is followed by complete release. Leaving this screen pauses practice; time away is never counted.</p></article>
    <article id="pelvic-relaxation" class="card pelvic-relaxation" hidden><span class="eyebrow">RELEASE WITHOUT PUSHING</span><h2>A gentle relaxation break.</h2><p>Sit supported or lie comfortably with a pillow under your knees. Let your abdomen soften. Breathe slowly into your lower ribs and belly, then breathe out comfortably. Let the pelvic floor soften without bearing down.</p><p>There is no squeezing, breath-holding or straining in this guide. Stop if it is uncomfortable and seek assessment for continuing pain or urinary symptoms. <a href="https://www.stgeorges.nhs.uk/wp-content/uploads/2025/05/PHP_PFR.pdf" target="_blank" rel="noopener noreferrer">Read the NHS guide</a></p><button id="pelvic-return" type="button" class="text-btn">Back to practice</button></article>
    <article class="card pelvic-progress"><h2>Your practice record</h2><p id="pelvic-progress-copy"></p><p id="pelvic-today-copy"></p><p class="form-note">A completed set records actual practice time in Reports. It does not measure muscle strength or predict sexual stamina. <a href="https://www.lscft.nhs.uk/our-services/service-finder-z/continence-service/pelvic-floor-physiotherapy/pelvic-floor-muscle-exercise-information-sheet-men" target="_blank" rel="noopener noreferrer">NHS technique guide for men</a></p></article></div>`;
  main.append(view);
  const links=[];
  for(const parent of [doc.querySelector('#view-settings .profile-summary'),doc.getElementById('discover-panel-personal')]){
    if(!parent)continue;const card=doc.createElement('button');card.type='button';card.className='pelvic-entry';card.dataset.pelvicOpen='true';card.innerHTML='<span class="pelvic-entry-icon" aria-hidden="true">&#9676;</span><span><strong>Pelvic floor</strong><small>Kegel practice &amp; complete release</small></span><span aria-hidden="true">&rarr;</span>';if(parent.id==='discover-panel-personal')parent.append(card);else parent.after(card);links.push(card);on(card,'click',()=>{if(!adult())return;api.showView('pelvic');render();el('pelvic-player-title').setAttribute('tabindex','-1');el('pelvic-player-title').focus();});
  }
  function adult(){return api.getState().profile.ageBand!=='teen';}
  function todaySets(){return api.getState().workouts.filter(w=>w.routineId==='pelvic-floor'&&w.skipped===0&&w.seconds>0&&w.date===dateKey(new win.Date()));}
  function readiness(){return doc.querySelector('input[name="pelvic-screen"]:checked')?.value;}
  function running(){return ['running','paused'].includes(timer.status);}
  function pendingSave(){return pendingEntry!==null&&!recorded;}
  function renderPreferences(){
    el('pelvic-guide').value=preferences.guide;el('pelvic-experience').value=preferences.experience;el('pelvic-hold').value=String(preferences.comfortableHold);el('pelvic-week').value=String(Math.floor((preferences.week-1)/2)*2+1);el('pelvic-quick').checked=preferences.quickReps;el('pelvic-advice').checked=preferences.adviceAccepted;
  }
  function draw(){
    const active=timer.status==='running',paused=timer.status==='paused',complete=timer.status==='complete',phase=timer.phase;
    el('pelvic-ring').dataset.phase=active?phase.type:timer.status;
    el('pelvic-phase').textContent=paused?'Release & rest':complete?'Set complete':active?({prepare:'Settle & breathe',hold:'Gentle lift',quick:'Brief lift',relax:'Fully release'}[phase.type]):timer.status==='stopped'?'Stopped':'Ready';
    el('pelvic-remaining').textContent=complete?time(timer.elapsed):time(timer.remaining);
    el('pelvic-repetition').textContent=complete?`${timer.reps} slow repetitions${timer.quickReps?` + ${timer.quickReps} brief repetitions`:''}`:active&&['hold','relax'].includes(phase.type)&&phase.kind!=='quick'?`Repetition ${phase.rep} of ${timer.dose.reps}`:active&&['quick','relax'].includes(phase.type)&&phase.kind!=='long'?`Brief repetition ${phase.rep} of ${timer.dose.quick}`:'Prepare and breathe';
    el('pelvic-cue').textContent=saveError?'Set complete, but saving failed. Keep the app open and retry saving.':paused?'Release completely. When you resume, settle again before gently lifting.':complete?(recorded?'Let everything relax. Your completed practice is saved.':'Let everything relax. Saving your completed practice...'):active&&['hold','quick'].includes(phase.type)?'A gentle inward lift. Keep breathing; stop if the squeeze fades or hurts.':active?'Let the pelvic floor release fully. Keep your abdomen, legs and buttocks relaxed.':timer.status==='stopped'?'Release fully. This unfinished set was not recorded.':'Sit or lie comfortably. Let your belly, thighs and buttocks soften.';
    if(saveError)el('pelvic-player-error').textContent=saveError;
    el('pelvic-save-recovery').hidden=!pendingSave();
    el('pelvic-start').textContent=paused?'Resume gently':complete?'Completed today':'Start practice';el('pelvic-start').disabled=active||complete||todaySets().length>0||!adult();
    el('pelvic-pause').hidden=!active;el('pelvic-stop').hidden=!running();el('pelvic-pain-stop').hidden=!running();
    el('pelvic-preferences').querySelectorAll('input,select,button').forEach(input=>input.disabled=running()||pendingSave());
    el('pelvic-readiness').querySelectorAll('input').forEach(input=>input.disabled=running()||pendingSave());
    doc.documentElement.dataset.pelvicRunning=String(active);
    doc.documentElement.dataset.pelvicStatus=timer.status;
    doc.documentElement.dataset.pelvicPendingSave=String(pendingSave());
  }
  function render(){
    const isAdult=adult();links.forEach(link=>link.hidden=!isAdult);el('pelvic-adult-note').hidden=isAdult;el('pelvic-adult-content').hidden=!isAdult;if(!isAdult)timer.stop();
    if(!running()&&!pendingSave()){const saved=api.getState().settings?.pelvic;if(saved)preferences=validatePelvicSettings(saved);renderPreferences();}
    const dose=running()||timer.status==='complete'||pendingSave()?timer.dose:pelvicDose(preferences);el('pelvic-dose-summary').textContent=`${dose.reps} gentle holds \u00b7 ${dose.hold}s lift / ${dose.relax}s release${dose.quick?' \u00b7 3 brief lifts':''}`;el('pelvic-technique').textContent=guidance[preferences.guide];
    const sets=api.getState().workouts.filter(w=>w.routineId==='pelvic-floor'&&w.skipped===0&&w.seconds>0),days=new Set(sets.map(w=>w.date));el('pelvic-progress-copy').textContent=`${sets.length} completed ${sets.length===1?'set':'sets'} across ${days.size} practice ${days.size===1?'day':'days'}.`;el('pelvic-today-copy').textContent=todaySets().length?'Your guided set for today is complete. Rest until tomorrow.':'No completed set today.';draw();
  }
  function stopForSymptoms(){timer.stop();relaxOnly=true;doc.querySelector('input[name="pelvic-screen"][value="assessment"]').checked=true;el('pelvic-comfort').checked=false;el('pelvic-relaxation').hidden=false;el('pelvic-player').hidden=true;el('pelvic-screen-note').hidden=false;draw();api.toast('Practice stopped. Release completely and seek advice if pain or urinary symptoms persist.');}
  function record(){
    if(recorded)return;
    if(!pendingEntry){
      if(!adult()||timer.status!=='complete'||readiness()!=='clear'||relaxOnly)return;
      pendingEntry={id:win.crypto?.randomUUID?.()||'pelvic-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),date:dateKey(new win.Date()),session:'personalized',title:'Pelvic floor practice',goalType:'core',routineId:'pelvic-floor',seconds:Math.round(timer.elapsed*100)/100,skipped:0};
    }
    try{const entry=pendingEntry;api.commit(state=>state.workouts.some(workout=>workout.id===entry.id)?state:{...state,workouts:[...state.workouts,entry]});recorded=true;pendingEntry=null;saveError='';el('pelvic-player-error').textContent='';api.toast('Pelvic floor practice saved.');}catch(error){saveError=error.message||'Practice could not be saved.';}
    render();
  }
  on(el('pelvic-retry-save'),'click',record);
  on(el('pelvic-preferences'),'submit',event=>{
    event.preventDefault();if(running()||pendingSave())return;
    try{const next=validatePelvicSettings({guide:el('pelvic-guide').value,experience:el('pelvic-experience').value,comfortableHold:Number(el('pelvic-hold').value),week:Number(el('pelvic-week').value),quickReps:el('pelvic-quick').checked,adviceAccepted:el('pelvic-advice').checked});api.commit(state=>({...state,settings:{...state.settings,pelvic:next}}));preferences=next;timer.reset(pelvicDose(next));recorded=false;el('pelvic-preference-error').textContent='';render();api.toast('Pelvic floor preferences saved.');}catch(error){el('pelvic-preference-error').textContent=error.message;}
  });
  on(el('pelvic-start'),'click',()=>{
    el('pelvic-player-error').textContent='';
    if(!adult()||todaySets().length||pendingSave())return;
    if(!preferences.adviceAccepted){el('pelvic-player-error').textContent='Check with a health professional, then save the guidance acknowledgement before starting.';return;}
    if(readiness()!=='clear'||!el('pelvic-comfort').checked){el('pelvic-player-error').textContent='Confirm readiness for today and a pain-free lift with complete release. If unsure, use the relaxation guide and seek assessment.';return;}
    if(timer.status!=='paused'){timer.reset(pelvicDose(preferences));recorded=false;saveError='';}
    relaxOnly=false;timer.start();draw();
  });
  on(el('pelvic-pause'),'click',()=>{timer.pause();draw();});
  on(el('pelvic-stop'),'click',()=>{timer.stop();draw();});on(el('pelvic-pain-stop'),'click',stopForSymptoms);
  on(el('pelvic-readiness'),'change',()=>{const blocked=readiness()==='assessment';el('pelvic-screen-note').hidden=!blocked;if(blocked){timer.stop();relaxOnly=true;el('pelvic-player').hidden=true;el('pelvic-relaxation').hidden=false;}else{relaxOnly=false;el('pelvic-player').hidden=false;el('pelvic-relaxation').hidden=true;}draw();});
  on(el('pelvic-relax-open'),'click',()=>{timer.pause();relaxOnly=true;el('pelvic-player').hidden=true;el('pelvic-relaxation').hidden=false;draw();});
  on(el('pelvic-return'),'click',()=>{if(readiness()==='assessment'){api.toast('Choose assessment before strengthening. You can keep using the relaxation guide.');return;}relaxOnly=false;el('pelvic-player').hidden=false;el('pelvic-relaxation').hidden=true;draw();});
  on(el('pelvic-back'),'click',()=>{timer.pause();draw();api.showView('settings');});
  on(doc,'visibilitychange',()=>{if(doc.hidden){timer.pause();draw();}});on(win,'pagehide',()=>{timer.pause();draw();});
  const interval=win.setInterval(()=>{if(timer.status!=='running')return;if(view.hidden||doc.hidden||!adult()){timer.pause();draw();return;}const complete=timer.tick();draw();if(complete)record();},250);
  render();
  const pause=()=>{timer.pause();draw();};
  return {render,timer,pause,onNavigate:name=>{if(name!=='pelvic')pause();},dispose:()=>{timer.stop();abort.abort();win.clearInterval(interval);doc.documentElement.dataset.pelvicRunning='false';doc.documentElement.dataset.pelvicStatus='ready';doc.documentElement.dataset.pelvicPendingSave='false';}};
}
