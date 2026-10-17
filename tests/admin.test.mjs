import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {initAdmin} from '../dist/admin.js';

const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const member=(uid,name,email,extra={})=>({uid,displayName:name,email,createdAt:'2026-10-01T12:00:00Z',lastActive:'2026-10-13T12:00:00Z',completedWorkouts:3,totalMinutes:45,streak:2,goalType:'strength',planStart:'2026-10-01',planDeadline:'2026-12-01',...extra});
const safeFailure=(code,status)=>Object.assign(new Error('This operation is not available.'),{name:'CloudError',code,status});
async function settled(win){for(let i=0;i<12;i++)await Promise.resolve();await win.happyDOM.waitUntilComplete();}
function fixture({session={uid:'owner',isAdmin:true},allowed=true,pages=[{users:[],nextCursor:null}],detail,read,request}={}){
  const win=new Window({url:'https://example.test/',settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});win.document.write(html);
  const calls={permission:0,list:[],detail:[],routes:[],messages:[]},control={session,allowed};
  const auth={getSession:()=>control.session},cloud={isAdmin:async()=>{calls.permission++;if(control.allowed instanceof Error)throw control.allowed;return control.allowed;},listUsers:async options=>{calls.list.push(options);if(request)return request(options);return pages[options.cursor==='second-page'?1:0];}};
  if(detail!==undefined||read)cloud.readUserState=async uid=>{calls.detail.push(uid);if(read)return read(uid);return detail;};
  const showView=route=>{calls.routes.push(route);win.document.querySelectorAll('.view').forEach(view=>view.hidden=view.id!=='view-'+route);};
  const admin=initAdmin(win,{cloud,auth,showView,toast:message=>calls.messages.push(message)}),element=id=>win.document.getElementById(id);
  showView('settings');return {win,control,calls,admin,element,open:async()=>{await admin.render();element('open-admin').click();await settled(win);},close:async()=>{admin.dispose();await win.happyDOM.close();}};
}

test('Guests and ordinary members never request the directory or user progress',async()=>{
  for(const options of [{session:null,allowed:true},{session:{uid:'member',email:'owner@example.test'},allowed:false}]){
    const t=fixture(options);try{await t.admin.render();assert.equal(t.element('open-admin').hidden,true);t.element('open-admin').click();await settled(t.win);assert.equal(t.calls.list.length,0);assert.equal(t.calls.detail.length,0);assert.equal(t.calls.routes.includes('admin'),false);}finally{await t.close();}
  }
});

test('Verified owner access is visible without fetching accounts until the dashboard opens',async()=>{
  const t=fixture();try{await t.admin.render();assert.equal(t.element('open-admin').hidden,false);assert.equal(t.calls.list.length,0);await t.open();assert.equal(t.calls.list.length,1);assert.deepEqual(t.calls.list[0],{pageSize:25,cursor:null});assert.equal(t.element('admin-users').children.length,0);assert.match(t.element('admin-empty').textContent,/No account activity/);assert.equal(t.element('admin-list-pane').hidden,false);assert.equal(t.element('admin-detail-pane').hidden,true);}finally{await t.close();}
});

test('Directory search filters only loaded names and emails and user text cannot inject markup',async()=>{
  const t=fixture({pages:[{users:[member('u1','Ada','ada@example.test'),member('u2','<img src=x onerror=alert(1)>','second@example.test')],nextCursor:null,total:2}]});try{
    await t.open();assert.equal(t.element('admin-users').children.length,2);assert.equal(t.element('view-admin').querySelector('img'),null);
    t.element('admin-search').value='ADA@';t.element('admin-search').dispatchEvent(new t.win.Event('input',{bubbles:true}));assert.equal(t.element('admin-users').children.length,1);assert.equal(t.calls.list.length,1);assert.match(t.element('admin-result-count').textContent,/1 matches on this page/);
    t.element('admin-search').value='u2';t.element('admin-search').dispatchEvent(new t.win.Event('input',{bubbles:true}));assert.equal(t.element('admin-users').children.length,0);assert.match(t.element('admin-empty').textContent,/on this page/);
  }finally{await t.close();}
});

test('Next and previous page requests retain server cursor boundaries',async()=>{
  const t=fixture({pages:[{users:[member('u1','First','first@example.test')],nextCursor:'second-page',total:2},{users:[member('u2','Second','second@example.test')],nextCursor:null,total:2}]});try{
    await t.open();assert.equal(t.element('admin-previous').disabled,true);assert.equal(t.element('admin-next').disabled,false);
    t.element('admin-next').click();await settled(t.win);assert.equal(t.element('admin-page-label').textContent,'Page 2');assert.match(t.element('admin-users').textContent,/Second/);assert.equal(t.element('admin-next').disabled,true);
    t.element('admin-previous').click();await settled(t.win);assert.equal(t.element('admin-page-label').textContent,'Page 1');assert.match(t.element('admin-users').textContent,/First/);assert.deepEqual(t.calls.list.map(call=>call.cursor),[null,'second-page',null]);
  }finally{await t.close();}
});

test('Account detail shows shared actual activity and excludes private measurements and safety fields',async()=>{
  const user=member('u1','Member','member@example.test'),detail={user,summary:{completedWorkouts:4,totalMinutes:67,streak:3},profile:{goalType:'core',startDate:'2026-10-01',deadline:'2026-12-01',days:[1,3,5],sessionMinutes:20,startWeight:987.6,safetyAnswers:'PRIVATE SAFETY',gender:'PRIVATE GENDER'},workouts:[{date:'2026-10-13',title:'Controlled core',seconds:600,skipped:0}],walks:[{date:'2026-10-12',minutes:15,intensity:'brisk'}],assessments:[{date:'2026-10-13',value:10,unit:'reps',notes:'PRIVATE NOTES'},{date:'2026-10-12',value:987.6,unit:'kg'}],weights:[{date:'2026-10-13',weight:987.6}],bodyMeasurements:[{date:'2026-10-13',waist:222.2}]};
  const t=fixture({pages:[{users:[user],nextCursor:null}],detail});try{
    await t.open();t.element('admin-users').querySelector('[data-admin-user]').click();await settled(t.win);assert.deepEqual(t.calls.detail,['u1']);assert.equal(t.element('admin-list-pane').hidden,true);assert.equal(t.element('admin-detail-pane').hidden,false);assert.match(t.element('admin-detail-stats').textContent,/67/);assert.match(t.element('admin-person-plan').textContent,/Core control/);assert.match(t.element('admin-activity').textContent,/Controlled core|Brisk walk|10 reps/);assert.doesNotMatch(t.element('admin-detail-pane').textContent,/987\.6|222\.2|PRIVATE SAFETY|PRIVATE GENDER|PRIVATE NOTES/);
    t.element('admin-detail-back').click();assert.equal(t.element('admin-list-pane').hidden,false);assert.equal(t.element('admin-detail-pane').hidden,true);assert.equal(t.element('admin-activity').textContent,'');
  }finally{await t.close();}
});

test('Permission denial clears previously loaded private account records',async()=>{
  const t=fixture({pages:[{users:[member('u1','Private member','private@example.test')],nextCursor:null}]});try{
    await t.open();assert.match(t.element('admin-users').textContent,/Private member/);t.control.allowed=false;await t.admin.render();assert.equal(t.element('open-admin').hidden,true);assert.equal(t.element('admin-users').textContent,'');assert.equal(t.element('admin-detail-pane').hidden,true);assert.equal(t.calls.routes.at(-1),'settings');assert.equal(t.calls.list.length,1);
  }finally{await t.close();}
});

test('An in-flight directory response is discarded after the authenticated account changes',async()=>{
  let resolveRequest;const response=new Promise(resolve=>{resolveRequest=resolve;});const t=fixture({request:()=>response});try{
    await t.admin.render();t.element('open-admin').click();for(let i=0;i<8;i++)await Promise.resolve();assert.equal(t.calls.list.length,1);t.control.session={uid:'ordinary-user'};t.control.allowed=false;await t.admin.render();resolveRequest({users:[member('u1','OLD PRIVATE','old-private@example.test')],nextCursor:null});await settled(t.win);assert.equal(t.element('admin-users').textContent,'');assert.equal(t.element('open-admin').hidden,true);
  }finally{await t.close();}
});

test('Backend permission failures are not replaced with fake accounts or client-side owner grants',async()=>{
  const t=fixture({request:async()=>{throw safeFailure('cloud/forbidden',403);}});try{
    await t.open();assert.equal(t.element('open-admin').hidden,true);assert.equal(t.element('admin-users').children.length,0);assert.match(t.element('admin-status').textContent,/Owner permission/);assert.equal(t.calls.routes.at(-1),'settings');
  }finally{await t.close();}
});
