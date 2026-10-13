import {buildPlan,GOALS} from './planner.js';
import {dateKey,daysBetween} from './engine.js';
import {CHECKPOINT_KEY,validateCheckpoint} from './checkpoint.js';

const icons={
  home:'<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
  play:'<path d="m8 5 11 7-11 7z"/>',
  workouts:'<path d="M4 9v6m4-9v12m8-12v12m4-9v6M8 12h8"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h3m3 0h3"/>',
  reports:'<path d="M4 4v16h17M8 16v-5m5 5V7m5 9V4"/>',
};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

// Existing catalog IDs and delegated fitness handlers stay in place. Only their
// presentation changes: one catalog area is visible at a time.
function organizeDiscover(doc){
  const discover=doc.getElementById('view-discover');
  if(!discover)return {panels:[],navigator:null};
  const routineGrid=doc.getElementById('routine-grid'),programGrid=doc.getElementById('program-grid'),customGrid=doc.getElementById('custom-grid'),areas=doc.getElementById('area-filters');
  const definitions=[
    {id:'workouts',label:'Workouts',nodes:[areas?.previousElementSibling,areas,discover.querySelector('.catalog-toolbar'),routineGrid?.previousElementSibling,routineGrid]},
    {id:'programs',label:'Programs',nodes:[programGrid?.previousElementSibling,programGrid]},
    {id:'mine',label:'My workouts',nodes:[customGrid?.previousElementSibling,customGrid]},
    {id:'personal',label:'For you',nodes:[discover.querySelector('.fitness-hero'),doc.getElementById('curves-discover'),discover.querySelector('.level-cards')]},
  ];
  const panels=[];
  for(const definition of definitions){
    const nodes=definition.nodes.filter((node,index,list)=>node&&node.parentElement===discover&&list.indexOf(node)===index);
    if(!nodes.length)continue;
    const section=doc.createElement('section');section.id='discover-panel-'+definition.id;section.className='discover-panel';section.dataset.discoverPanel=definition.id;section.setAttribute('aria-label',definition.label);
    discover.insertBefore(section,nodes[0]);for(const node of nodes)section.append(node);
    panels.push({...definition,element:section});
  }
  const navigator=doc.createElement('div');navigator.className='discover-navigation';navigator.setAttribute('role','group');navigator.setAttribute('aria-label','Workout catalog sections');
  navigator.innerHTML=panels.map(panel=>`<button type="button" data-discover-panel="${panel.id}" aria-controls="${panel.element.id}" aria-pressed="false">${panel.label}</button>`).join('');
  const heading=discover.querySelector('.discover-heading');if(heading)heading.after(navigator);else discover.prepend(navigator);
  return {panels,navigator};
}

export function initHome(win,api){
  const doc=win.document,main=doc.getElementById('main'),discover=doc.getElementById('view-discover');
  if(!main)throw new Error('Home needs the main application container.');
  const abort=new win.AbortController(),on=(element,event,handler)=>element.addEventListener(event,handler,{signal:abort.signal});
  const home=doc.createElement('section');home.id='view-home';home.className='view home-view';home.hidden=true;
  home.innerHTML=`<header class="home-heading"><div><p class="home-eyebrow">ONE DAY STRONGER</p><h1 id="home-greeting">Your next step.</h1><p id="home-date" class="home-date"></p></div><button id="home-edit-plan" type="button" class="home-profile-link" aria-label="Edit training preferences">My profile <span aria-hidden="true">↗</span></button></header>
    <section class="home-week-card" aria-labelledby="home-week-title"><div class="home-week-heading"><h2 id="home-week-title">This week</h2><span id="home-week-caption"></span></div><div id="home-week" class="home-week"></div></section>
    <article class="home-session-card"><div class="home-session-header"><span id="home-session-kicker">YOUR NEXT SESSION</span><span id="home-session-minutes"></span></div><h2 id="home-session-title">Your personal workout</h2><p id="home-session-note"></p><button id="home-open-session" type="button" class="home-primary">${icon('play')}<span id="home-session-action">Open my workout</span><span aria-hidden="true">→</span></button></article>
    <aside id="home-resume" class="home-resume" hidden><div><strong>Continue your session</strong><p id="home-resume-copy">Your unfinished workout is saved.</p></div><button type="button" data-go="workout">Open <span aria-hidden="true">→</span></button></aside>
    <nav class="home-entries" aria-label="Training destinations"><button type="button" data-go="discover">${icon('workouts')}<strong>Workouts</strong><small>Explore routines</small></button><button type="button" data-go="plan">${icon('calendar')}<strong>My plan</strong><small>See your schedule</small></button><button type="button" data-go="progress">${icon('reports')}<strong>Reports</strong><small>Your actual progress</small></button></nav>`;
  main.insertBefore(home,discover||main.firstChild);
  const nav=doc.querySelector('.sidebar nav [data-view="discover"]');if(nav){nav.dataset.view='home';nav.innerHTML=icon('home')+'<span>Home</span>';nav.setAttribute('aria-label','Home');}
  const brand=doc.querySelector('.sidebar .brand');if(brand)brand.setAttribute('href','#home');
  const catalog=organizeDiscover(doc);let catalogPanel='workouts',planError='';
  const checkpointKey=api.checkpointKey||CHECKPOINT_KEY,element=id=>doc.getElementById(id);
  function hasSavedCheckpoint(){
    try{const raw=win.localStorage.getItem(checkpointKey);if(!raw)return false;validateCheckpoint(JSON.parse(raw));return true;}catch{return false;}
  }
  const isUnfinished=()=>['running','paused'].includes(api.timer?.status)||element('workout-recovery')?.hidden===false||hasSavedCheckpoint();
  function selectCatalog(id){
    if(!catalog.panels.some(panel=>panel.id===id))return;
    catalogPanel=id;for(const panel of catalog.panels)panel.element.hidden=panel.id!==id;
    catalog.navigator.querySelectorAll('button').forEach(button=>{const selected=button.dataset.discoverPanel===id;button.setAttribute('aria-pressed',String(selected));button.classList.toggle('selected',selected);});
  }
  function render(){
    const state=api.getState(),profile=state.profile,today=new win.Date(),todayKey=dateKey(today);
    element('home-greeting').textContent=profile.name?'Hi, '+profile.name+'.':'Your next step.';
    element('home-date').textContent=today.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
    const monday=new win.Date(today.getFullYear(),today.getMonth(),today.getDate()-((today.getDay()+6)%7));
    const complete=new Set(state.workouts.filter(workout=>workout.skipped===0&&workout.seconds>0&&workout.date>=dateKey(monday)&&workout.date<=todayKey).map(workout=>workout.date));
    element('home-week-caption').textContent=complete.size+' completed '+(complete.size===1?'day':'days');
    element('home-week').innerHTML=Array.from({length:7},(_,index)=>{const day=new win.Date(monday);day.setDate(day.getDate()+index);const key=dateKey(day),done=complete.has(key),planned=profile.days.includes(day.getDay()),current=key===todayKey;return `<div class="home-week-day ${done?'complete':''} ${planned?'planned':''} ${current?'today':''}" title="${key}: ${done?'completed workout':planned?'planned training day':'rest day'}" ${current?'aria-current="date"':''}><span>${['M','T','W','T','F','S','S'][index]}</span><strong>${done?'✓':day.getDate()}</strong></div>`;}).join('');
    planError='';let plan,session;
    try{plan=api.getPlan?.()||buildPlan(profile,todayKey);session=plan.sessions.find(entry=>entry.date>=todayKey)||plan.sessions.at(-1);}catch(error){planError=error.message;}
    const unfinished=isUnfinished();element('home-resume').hidden=!unfinished;
    element('home-resume-copy').textContent=element('workout-recovery')?.hidden===false||(!['running','paused'].includes(api.timer?.status)&&hasSavedCheckpoint())?'An interrupted session is ready to restore.':'Your paused workout is ready when you are.';
    if(!profile.safetyAccepted){
      element('home-session-kicker').textContent='YOUR STARTING POINT';element('home-session-title').textContent='A plan that fits you.';element('home-session-note').textContent='Choose your goal, available time and comfortable movements.';element('home-session-minutes').textContent='';element('home-session-action').textContent='Set up my plan';
    }else if(planError||!session){
      element('home-session-kicker').textContent='YOUR TRAINING CHOICES';element('home-session-title').textContent='Review your plan.';element('home-session-note').textContent=planError||'Choose a schedule to prepare your next session.';element('home-session-minutes').textContent='';element('home-session-action').textContent='Adjust my plan';
    }else{
      const todaySession=session.date===todayKey,expired=session.date<todayKey;
      element('home-session-kicker').textContent=todaySession?(session.recovery?'TODAY / RECOVERY':'TODAY’S WORKOUT'):expired?'KEEP YOUR ROUTINE':'NEXT PLANNED WORKOUT';
      element('home-session-title').textContent=GOALS[profile.goalType]?.label||session.title;
      element('home-session-minutes').textContent=session.minutes+' min';
      element('home-session-note').textContent=expired?'Your plan has ended. Review it or repeat a comfortable session.':todaySession?(session.recovery?'An easier session with room to recover.':'Your selected movements, with preparation and recovery.'):daysBetween(todayKey,session.date)>0?'Recovery today. Next session: '+new win.Date(session.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})+'.':'Your next session is ready.';
      element('home-session-action').textContent=unfinished?'Continue my session':expired?'Open a repeat session':'Open my workout';
    }
    selectCatalog(catalogPanel);
  }
  on(element('home-edit-plan'),'click',()=>api.openGoal());
  on(element('home-open-session'),'click',()=>{
    if(!api.getState().profile.safetyAccepted||planError){api.openGoal();return;}
    if(isUnfinished()){api.showView('workout');return;}
    try{api.selectPersonalized();api.showView('workout');}catch(error){api.toast(error.message);}
  });
  on(doc,'click',event=>{
    const category=event.target?.closest?.('button[data-discover-panel]');if(category)selectCatalog(category.dataset.discoverPanel);
    if(event.target?.closest?.('#explore-curves'))selectCatalog('workouts');
  });
  render();
  return {render,dispose:()=>abort.abort()};
}
