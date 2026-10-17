import {GOALS} from './planner.js';
import {validDate,formatTime} from './engine.js';

const text=(value,max=160)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max):'';
const count=value=>Number.isFinite(value)&&value>=0?value:null;
const permissionFailure=error=>[401,403].includes(error?.status)||/permission|forbidden|unauthor|not-auth/i.test(error?.code||'');
const safeError=error=>error?.name==='CloudError'&&typeof error.message==='string'?text(error.message,300):'The dashboard could not load. Check your connection and try again.';

function accountSummary(value){
  if(!value||typeof value.uid!=='string'||!value.uid||value.uid.length>128)throw new Error('Invalid account response');
  return {uid:value.uid,email:text(value.email,254),displayName:text(value.displayName,120),createdAt:value.createdAt,lastActive:value.lastActive,
    completedWorkouts:count(value.completedWorkouts),totalMinutes:count(value.totalMinutes??value.minutes),streak:count(value.streak),goalType:text(value.goalType,40),planStart:value.planStart,planDeadline:value.planDeadline};
}
function displayDate(value){
  const input=typeof value==='object'&&Number.isFinite(value?.seconds)?value.seconds*1000:value;
  if(!['string','number'].includes(typeof input))return 'Not shared';
  const date=new Date(typeof input==='string'&&validDate(input)?input+'T12:00:00':input);return Number.isFinite(date.getTime())?date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'Not shared';
}
const goalLabel=value=>GOALS[value]?.label||'Not shared';

// Visibility is a convenience; owner requests are separately authorized by the
// Django backend. No email address or locally edited profile grants permission.
export function initAdmin(win,{cloud,auth,showView,toast}){
  const doc=win.document,main=doc.getElementById('main'),settings=doc.getElementById('view-settings');
  if(!main||!settings)throw new Error('The owner dashboard needs the application and Profile view.');
  const abort=new win.AbortController(),on=(node,event,handler)=>node.addEventListener(event,handler,{signal:abort.signal});
  const section=doc.createElement('section');section.id='view-admin';section.className='view admin-view';section.hidden=true;
  section.innerHTML=`<header class="admin-heading"><div><p class="admin-eyebrow">PRIVATE / OWNER ACCESS</p><h1>Account activity</h1><p>Shared training records, one account at a time.</p></div><button type="button" id="admin-return-profile" class="outline-btn">Back to Profile</button></header>
    <p class="admin-context">Activity and assessments are self-reported. Logged minutes include preparation and recovery; these records are not sensor measurements or proof of fitness results.</p>
    <p id="admin-status" class="admin-status" role="status">Owner access is required.</p>
    <section id="admin-list-pane" hidden aria-label="Account summaries"><div class="admin-toolbar"><label>Search this page<input id="admin-search" type="search" placeholder="Name or email" autocomplete="off"></label><button type="button" id="admin-refresh" class="outline-btn">Refresh</button></div><p id="admin-result-count" class="admin-result-count"></p><div class="admin-table-wrap"><table class="admin-user-table"><caption class="sr-only">Shared account activity summaries</caption><thead><tr><th scope="col">Account</th><th scope="col">Last active</th><th scope="col">Completed workouts</th><th scope="col">Logged minutes</th><th scope="col"><span class="sr-only">View account</span></th></tr></thead><tbody id="admin-users"></tbody></table></div><p id="admin-empty" class="admin-empty" hidden></p><div class="admin-pagination"><button type="button" id="admin-previous" class="outline-btn" disabled>Previous</button><span id="admin-page-label">Page 1</span><button type="button" id="admin-next" class="outline-btn" disabled>Next</button></div><p class="admin-small">Search filters the loaded page only. Open an account to see its shared goal, schedule and activity.</p></section>
    <section id="admin-detail-pane" hidden aria-label="Account progress"><button type="button" id="admin-detail-back" class="text-btn">← Account summaries</button><header class="admin-person-heading"><h2 id="admin-person-name"></h2><p id="admin-person-email"></p></header><div id="admin-detail-stats" class="admin-detail-stats"></div><dl id="admin-person-plan" class="admin-person-plan"></dl><p id="admin-detail-status" class="admin-small" role="status"></p><div id="admin-activity" class="admin-activity"></div><p class="admin-small">Body measurements, weight entries and safety answers are not displayed in this dashboard.</p></section>`;
  main.insertBefore(section,main.querySelector('.page-footer'));
  const access=doc.createElement('button');access.id='open-admin';access.type='button';access.className='outline-btn admin-access';access.hidden=true;access.textContent='Owner dashboard';
  settings.querySelector('.profile-summary')?.after(access);if(!access.isConnected)settings.append(access);
  const node=id=>doc.getElementById(id),sessionUID=()=>auth?.getSession?.()?.uid||null;
  let authorizedUID=null,users=[],pageIndex=0,cursors=[null],nextCursor=null,total=null,pageLoaded=false,loading=false,loadPromise=null,disposed=false,epoch=0,detailUser=null;

  function clearPrivateData(){
    users=[];pageIndex=0;cursors=[null];nextCursor=null;total=null;pageLoaded=false;detailUser=null;
    node('admin-users').replaceChildren();node('admin-detail-stats').replaceChildren();node('admin-person-plan').replaceChildren();node('admin-activity').replaceChildren();node('admin-person-name').textContent='';node('admin-person-email').textContent='';node('admin-result-count').textContent='';node('admin-detail-status').textContent='';node('admin-list-pane').hidden=true;node('admin-detail-pane').hidden=true;
  }
  function revoke(message){
    epoch++;authorizedUID=null;access.hidden=true;clearPrivateData();node('admin-status').textContent=message;
    if(!section.hidden)showView('settings');
  }
  async function verify(){
    if(disposed)return false;
    const uid=sessionUID();
    if(!uid){revoke('Sign in with an owner account to access the dashboard.');return false;}
    if(authorizedUID&&authorizedUID!==uid)revoke('Checking owner access…');
    if(typeof cloud?.isAdmin!=='function'){revoke('The owner dashboard is not connected yet.');return false;}
    try{
      const allowed=await cloud.isAdmin();
      if(disposed||sessionUID()!==uid)return false;
      if(allowed!==true){revoke('This account does not have owner access.');return false;}
      authorizedUID=uid;access.hidden=false;return true;
    }catch(error){if(!disposed&&sessionUID()===uid)revoke(safeError(error));return false;}
  }
  function controls(){
    node('admin-previous').disabled=loading||pageIndex===0;node('admin-next').disabled=loading||nextCursor===null;node('admin-refresh').disabled=loading;node('admin-search').disabled=loading;
    node('admin-list-pane').setAttribute('aria-busy',String(loading));node('admin-page-label').textContent='Page '+(pageIndex+1);
  }
  function drawList(){
    const query=node('admin-search').value.trim().toLowerCase(),matches=users.filter(user=>(user.displayName+' '+user.email).toLowerCase().includes(query)),body=node('admin-users');body.replaceChildren();
    for(const user of matches){
      const row=doc.createElement('tr'),account=doc.createElement('td'),name=doc.createElement('strong'),email=doc.createElement('span');
      name.textContent=user.displayName||'Unnamed account';email.textContent=user.email||'No email shared';account.append(name,email);row.append(account);
      for(const value of [displayDate(user.lastActive),user.completedWorkouts??'—',user.totalMinutes===null?'—':Math.round(user.totalMinutes)]){const cell=doc.createElement('td');cell.textContent=String(value);row.append(cell);}
      const action=doc.createElement('td'),button=doc.createElement('button');button.type='button';button.className='admin-open-user';button.dataset.adminUser=user.uid;button.textContent='View progress';button.setAttribute('aria-label','View progress for '+(user.displayName||user.email||'this account'));action.append(button);row.append(action);body.append(row);
    }
    node('admin-result-count').textContent=query?matches.length+' matches on this page':users.length+' account '+(users.length===1?'summary':'summaries')+' on this page'+(total===null?'':' / '+total+' total');
    node('admin-empty').hidden=matches.length>0;node('admin-empty').textContent=query?'No names or emails match on this page.':'No account activity has been shared yet.';
    controls();
  }
  function loadPage(index){
    if(loading)return loadPromise;
    loading=true;controls();node('admin-status').textContent='Loading account summaries…';
    loadPromise=(async()=>{
      if(!await verify())return false;
      const requestUID=authorizedUID,stamp=++epoch;
      try{
        if(typeof cloud.listUsers!=='function')throw new Error('Unavailable directory');
        const response=await cloud.listUsers({pageSize:25,cursor:cursors[index]??null});
        if(disposed||stamp!==epoch||sessionUID()!==requestUID)return false;
        if(!response||!Array.isArray(response.users)||response.users.length>25)throw new Error('Invalid directory response');
        const next=response.users.map(accountSummary);if(new Set(next.map(user=>user.uid)).size!==next.length)throw new Error('Duplicate directory account');
        users=next;pageIndex=index;nextCursor=response.nextCursor===undefined||response.nextCursor===null||response.nextCursor===''?null:response.nextCursor;total=Number.isInteger(response.total)&&response.total>=0?response.total:null;
        cursors=cursors.slice(0,index+1);if(nextCursor!==null)cursors[index+1]=nextCursor;
        pageLoaded=true;detailUser=null;node('admin-list-pane').hidden=false;node('admin-detail-pane').hidden=true;node('admin-status').textContent='Shared activity summaries loaded.';drawList();return true;
      }catch(error){
        if(disposed||stamp!==epoch||sessionUID()!==requestUID)return false;
        if(permissionFailure(error)){revoke('Owner permission could not be verified. Sign in again with an authorized account.');return false;}
        clearPrivateData();node('admin-list-pane').hidden=false;node('admin-status').textContent=safeError(error);node('admin-empty').hidden=false;node('admin-empty').textContent='No account data is available. Refresh to try again.';return false;
      }
    })().finally(()=>{loading=false;loadPromise=null;if(!disposed)controls();});
    return loadPromise;
  }
  function appendPlan(label,value){const item=doc.createElement('div'),term=doc.createElement('dt'),description=doc.createElement('dd');term.textContent=label;description.textContent=value;item.append(term,description);node('admin-person-plan').append(item);}
  function drawDetail(user,data={}){
    node('admin-person-name').textContent=user.displayName||'Unnamed account';node('admin-person-email').textContent=user.email||'No email shared';
    const summary=data.summary||{},stats=[['Completed workouts',count(summary.completedWorkouts)??user.completedWorkouts],['Logged minutes',count(summary.totalMinutes??summary.minutes)??user.totalMinutes],['Current day streak',count(summary.streak)??user.streak]];
    node('admin-detail-stats').replaceChildren();for(const [label,value] of stats){const box=doc.createElement('div'),number=doc.createElement('strong'),caption=doc.createElement('span');number.textContent=value===null?'—':String(Math.round(value));caption.textContent=label;box.append(number,caption);node('admin-detail-stats').append(box);}
    const profile=data.profile||{};node('admin-person-plan').replaceChildren();appendPlan('Primary goal',goalLabel(profile.goalType||user.goalType));appendPlan('Plan start',displayDate(profile.startDate||user.planStart));appendPlan('Target date',displayDate(profile.deadline||user.planDeadline));appendPlan('Account created',displayDate(user.createdAt));appendPlan('Last active',displayDate(user.lastActive));
    if(Array.isArray(profile.days)&&profile.days.length&&profile.days.every(day=>Number.isInteger(day)&&day>=0&&day<=6))appendPlan('Selected days',[...new Set(profile.days)].map(day=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]).join(', '));
    if(Number.isFinite(profile.sessionMinutes)&&profile.sessionMinutes>=1&&profile.sessionMinutes<=60)appendPlan('Session length',profile.sessionMinutes+' minutes');
    if(['beginner','intermediate','advanced'].includes(profile.experience))appendPlan('Selected experience',profile.experience);
    if(profile.goalType!=='weight'&&['reps','seconds','minutes','sessions'].includes(profile.targetUnit)){
      if(count(profile.baselineValue)!==null)appendPlan('Starting assessment',profile.baselineValue+' '+profile.targetUnit);
      if(count(profile.targetValue)!==null)appendPlan('Chosen target',profile.targetValue+' '+profile.targetUnit);
    }
    const activity=[];
    for(const workout of Array.isArray(data.workouts)?data.workouts:[])if(validDate(workout?.date))activity.push({date:workout.date,title:text(workout.title,120)||'Workout',value:Number.isFinite(workout.seconds)&&workout.seconds>=0?formatTime(workout.seconds):'Duration not shared',note:Number.isInteger(workout.skipped)&&workout.skipped>0?'Partial session':'Logged workout'});
    for(const walk of Array.isArray(data.walks)?data.walks:[])if(validDate(walk?.date))activity.push({date:walk.date,title:walk.intensity==='brisk'?'Brisk walk':'Walk',value:Number.isFinite(walk.minutes)&&walk.minutes>=0?walk.minutes+' min':'Duration not shared',note:'Self-reported activity'});
    for(const assessment of Array.isArray(data.assessments)?data.assessments:[])if(validDate(assessment?.date)&&['reps','seconds','minutes','sessions'].includes(assessment.unit)&&Number.isFinite(assessment.value)&&assessment.value>=0)activity.push({date:assessment.date,title:'Comfortable assessment',value:assessment.value+' '+assessment.unit,note:'Manual observation'});
    node('admin-activity').replaceChildren();if(activity.length){const heading=doc.createElement('h3');heading.textContent='Recent shared activity';node('admin-activity').append(heading);for(const entry of activity.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30)){const row=doc.createElement('div'),copy=doc.createElement('div'),title=doc.createElement('strong'),date=doc.createElement('small'),value=doc.createElement('span');row.className='admin-activity-row';title.textContent=entry.title;date.textContent=displayDate(entry.date)+' / '+entry.note;value.textContent=entry.value;copy.append(title,date);row.append(copy,value);node('admin-activity').append(row);}}
  }
  async function openDetail(uid){
    if(loading||!await verify())return;
    const user=users.find(account=>account.uid===uid);if(!user)return;
    const requestUID=authorizedUID,stamp=++epoch;detailUser=user;node('admin-list-pane').hidden=true;node('admin-detail-pane').hidden=false;drawDetail(user);node('admin-detail-status').textContent='Loading shared progress…';
    if(typeof cloud.readUserState!=='function'){node('admin-detail-status').textContent='Shared summary only; detailed activity is not available.';return;}
    try{
      const data=await cloud.readUserState(uid);
      if(disposed||stamp!==epoch||sessionUID()!==requestUID)return;
      if(!data||typeof data!=='object'||(data.user?.uid!==undefined&&data.user.uid!==uid))throw new Error('Invalid progress response');
      const selected=data.user?accountSummary({...user,...data.user,uid}):user;drawDetail(selected,data);node('admin-detail-status').textContent='Shared records loaded. These are user-entered observations.';
    }catch(error){
      if(disposed||stamp!==epoch||sessionUID()!==requestUID)return;
      if(permissionFailure(error)){revoke('Owner permission could not be verified. Sign in again with an authorized account.');return;}
      node('admin-detail-status').textContent=safeError(error)+' The previously loaded summary remains available.';
    }
  }
  async function render(){
    if(!await verify())return false;
    if(!section.hidden&&!pageLoaded&&!loading)await loadPage(0);
    return true;
  }
  on(access,'click',async()=>{if(!await verify()){toast(node('admin-status').textContent);return;}showView('admin');node('admin-list-pane').hidden=false;node('admin-detail-pane').hidden=true;await loadPage(0);});
  on(node('admin-return-profile'),'click',()=>showView('settings'));
  on(node('admin-refresh'),'click',()=>loadPage(0));on(node('admin-search'),'input',drawList);
  on(node('admin-next'),'click',()=>{if(nextCursor!==null)void loadPage(pageIndex+1);});on(node('admin-previous'),'click',()=>{if(pageIndex>0)void loadPage(pageIndex-1);});
  on(node('admin-detail-back'),'click',()=>{epoch++;detailUser=null;node('admin-detail-pane').hidden=true;node('admin-list-pane').hidden=false;node('admin-detail-stats').replaceChildren();node('admin-person-plan').replaceChildren();node('admin-activity').replaceChildren();node('admin-person-name').textContent='';node('admin-person-email').textContent='';drawList();});
  on(node('admin-users'),'click',event=>{const button=event.target?.closest?.('[data-admin-user]');if(button)void openDetail(button.dataset.adminUser);});
  void render();
  return {render,dispose:()=>{disposed=true;epoch++;abort.abort();authorizedUID=null;access.hidden=true;clearPrivateData();}};
}
