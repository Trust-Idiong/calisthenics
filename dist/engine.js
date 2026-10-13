import {EXERCISES} from './exercises.js';

export const SESSIONS = {
  foundation: { id: 'foundation', title: 'Foundation', minutes: 10, level: 'Start here', warm: 120, cool: 120, work: 30, rest: 30, rounds: 2, exercises: ['chair', 'wall', 'march'], description: 'A gentle, low-impact introduction. A chair, a wall, and a little space are all you need.' },
  core: { id: 'core', title: 'Core & control', minutes: 12, level: 'When comfortable', warm: 120, cool: 120, work: 30, rest: 30, rounds: 2, exercises: ['bridge', 'bird', 'plank', 'march'], description: 'Build trunk and hip strength with controlled movement. Use the floor only if getting up and down is comfortable.' },
  strength: { id: 'strength', title: 'Full-body strength', minutes: 16, level: 'Build gradually', warm: 180, cool: 180, work: 40, rest: 20, rounds: 2, exercises: ['chair', 'wall', 'bridge', 'bird', 'plank'], description: 'A longer session with more working time. Progress here when the shorter sessions feel manageable.' }
};
const GOAL_TYPES=['conditioning','strength','core','cardio','weight','mobility','consistency','test'];
const textValue=(value,max,label,{markup=true}={})=>{
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)||(!markup&&/[<>]/.test(value)))throw new Error(`The ${label} is invalid.`);
  return value;
};
export function validateSessionDescriptor(value){
  if(!value||value.id!=='personalized'||!Array.isArray(value.steps)||value.steps.length<3||value.steps.length>500)throw new Error('The personalized session is invalid.');
  const title=textValue(value.title,120,'session title',{markup:false});
  if(!title.trim()||!Number.isFinite(value.minutes)||value.minutes<=0||value.minutes>60)throw new Error('The personalized session is invalid.');
  let total=0;
  const steps=value.steps.map(step=>{
    if(!step||!['warmup','work','rest','cooldown'].includes(step.type)||!Object.hasOwn(EXERCISES,step.exercise)||!Number.isInteger(step.duration)||step.duration<1||step.duration>3600)throw new Error('A personalized interval is invalid.');
    const round=step.round===undefined?0:step.round;
    if(!Number.isInteger(round)||round<0||round>1000)throw new Error('A personalized round is invalid.');
    const safe={type:step.type,exercise:step.exercise,duration:step.duration,round};
    if(step.label!==undefined)safe.label=textValue(step.label,120,'interval label',{markup:false});
    total+=step.duration;
    return safe;
  });
  if(steps[0].type!=='warmup'||steps.at(-1).type!=='cooldown'||!steps.some(step=>step.type==='work')||total>3600||Math.abs(total-value.minutes*60)>0.000001)throw new Error('The personalized session duration is invalid.');
  return {id:'personalized',title,minutes:value.minutes,steps};
}
export function sequenceFor(id,custom) {
  if(id==='personalized')return validateSessionDescriptor(custom).steps;
  if(!Object.hasOwn(SESSIONS,id))throw new Error('Unknown session');
  const s = SESSIONS[id];
  const steps = [{type:'warmup', exercise:'march', duration:s.warm, label:'Warm up', round:0}];
  for (let round=1;round<=s.rounds;round++) for (const exercise of s.exercises) {
    steps.push({type:'work',exercise,duration:s.work,round});
    steps.push({type:'rest',exercise,duration:s.rest,round,label:'Take a breather'});
  }
  steps.push({type:'cooldown',exercise:'cool',duration:s.cool,label:'Cool down',round:0});
  return steps;
}
export class WorkoutTimer {
  constructor(id='foundation', now=()=>performance.now(), descriptor) {
    if(typeof now!=='function'){descriptor=now;now=()=>performance.now();}
    this.now=now; this.reset(id,descriptor);
  }
  reset(id=this.id, descriptor) {
    const custom=id==='personalized'?validateSessionDescriptor(descriptor??(this.id===id?this.descriptor:undefined)):null;
    const steps=sequenceFor(id,custom);
    this.id=id; this.descriptor=custom; this.steps=steps; this.index=0; this.remaining=this.steps[0].duration; this.elapsed=0; this.status='ready'; this.skipped=0; this.last=0;
  }
  start() { if(this.status==='complete') return false; this.status='running'; this.last=this.now(); return true; }
  pause() { if(this.status==='running') { this.tick(); if(this.status==='running') this.status='paused'; } }
  tick() {
    if(this.status!=='running')return [];
    const now=this.now(); let delta=Math.max(0,(now-this.last)/1000); this.last=now; const events=[];
    while(delta>0 && this.status==='running') {
      const used=Math.min(delta,this.remaining); this.remaining-=used; this.elapsed+=used; delta-=used;
      if(this.remaining<=0.000001) { this.index++; if(this.index>=this.steps.length) { this.status='complete'; this.remaining=0; events.push('complete'); } else { this.remaining=this.steps[this.index].duration; events.push('interval'); } }
    }
    return events;
  }
  next() { if(this.status==='complete')return; if(this.status==='running')this.tick(); if(this.status==='complete')return; this.skipped++; this.index++; if(this.index>=this.steps.length){this.status='complete';this.remaining=0;}else{this.remaining=this.steps[this.index].duration;} this.last=this.now(); }
  get step() {return this.steps[Math.min(this.index,this.steps.length-1)];}
  get sessionTitle() {return this.descriptor?.title??SESSIONS[this.id].title;}
  get total() {return this.steps.reduce((sum,s)=>sum+s.duration,0);}
  get position() {return this.status==='complete'?this.total:this.steps.slice(0,this.index).reduce((sum,s)=>sum+s.duration,0)+this.step.duration-this.remaining;}
}
export function dateKey(d=new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function addMonths(key,months){const d=new Date(key+'T12:00:00');const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+months);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));return dateKey(d);}
export function daysBetween(a,b){return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);}
export function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
export function formatTime(n){n=Math.max(0,Math.ceil(n));return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;}
export const DEFAULT_GOAL_KG = 10;
export function freshState(today=dateKey()){
  const deadline=new Date(today+'T12:00:00');deadline.setDate(deadline.getDate()+56);
  return {version:3,profile:{startDate:today,deadline:dateKey(deadline),startWeight:null,goalLoss:0,goalType:'conditioning',name:'',experience:'beginner',days:[1,3,5],sessionMinutes:20,durationWeeks:8,targetValue:180,baselineValue:0,targetUnit:'minutes',ageBand:'adult',lowImpact:true,restrictions:[],coaching:'supportive',equipment:['chair','wall'],trackMeasurements:false,safetyAccepted:false},weights:[],workouts:[],walks:[],assessments:[],sound:true};
}
export function weeklySummary(state,start,end){
  const works=state.workouts.filter(w=>w.date>=start&&w.date<=end);
  const walks=state.walks.filter(w=>w.date>=start&&w.date<=end);
  const complete=works.filter(w=>w.skipped===0);
  const walkMinutes=walks.reduce((n,w)=>n+w.minutes,0);
  const briskMinutes=walks.filter(w=>w.intensity==='brisk').reduce((n,w)=>n+w.minutes,0);
  return {works,complete,walkMinutes,briskMinutes,strengthDays:new Set(complete.map(w=>w.date)).size,minutes:Math.round(works.reduce((n,w)=>n+w.seconds/60,0)+walkMinutes)};
}
export function validateState(x){
  if(!x||![1,2,3].includes(x.version)||!x.profile||typeof x.profile!=='object'||Array.isArray(x.profile))throw new Error('This is not a calisthenics app backup.');
  const p=x.profile;
  const legacy=x.version<3;
  if(!validDate(p.startDate)||!validDate(p.deadline)||daysBetween(p.startDate,p.deadline)<1)throw new Error('The goal dates are invalid.');
  if(p.startWeight!==null&&(!Number.isFinite(p.startWeight)||p.startWeight<30||p.startWeight>400))throw new Error('Starting weight must be between 30 and 400 kg.');
  if(!Number.isFinite(p.goalLoss)||p.goalLoss<(legacy?Number.MIN_VALUE:0)||p.goalLoss>200||(p.startWeight!==null&&p.goalLoss>=p.startWeight))throw new Error('Check your goal weight.');
  if(!Array.isArray(x.weights)||!Array.isArray(x.workouts)||!Array.isArray(x.walks)||x.weights.length>10000||x.workouts.length>20000||x.walks.length>10000||(x.assessments!==undefined&&(!Array.isArray(x.assessments)||x.assessments.length>10000)))throw new Error('The backup contains invalid records.');
  const defaults=freshState(p.startDate).profile;
  const goalType=legacy?'weight':(p.goalType??defaults.goalType);
  if(!GOAL_TYPES.includes(goalType))throw new Error('The training goal is invalid.');
  const profile={...defaults,startDate:p.startDate,deadline:p.deadline,startWeight:p.startWeight,goalLoss:p.goalLoss,goalType};
  profile.name=textValue(p.name??defaults.name,80,'profile name');
  for(const [field,allowed] of Object.entries({experience:['beginner','intermediate','advanced'],ageBand:['teen','adult','older'],coaching:['supportive','quiet']})){
    const value=p[field]??defaults[field];if(!allowed.includes(value))throw new Error(`The ${field} preference is invalid.`);profile[field]=value;
  }
  const days=p.days??defaults.days;
  if(!Array.isArray(days)||days.length<1||days.length>7||days.some(day=>!Number.isInteger(day)||day<0||day>6)||new Set(days).size!==days.length)throw new Error('The training days are invalid.');
  profile.days=[...days];
  profile.sessionMinutes=p.sessionMinutes??defaults.sessionMinutes;
  if(!Number.isInteger(profile.sessionMinutes)||profile.sessionMinutes<10||profile.sessionMinutes>60)throw new Error('The session length is invalid.');
  profile.durationWeeks=p.durationWeeks??(legacy?Math.max(1,Math.ceil(daysBetween(p.startDate,p.deadline)/7)):defaults.durationWeeks);
  if(!Number.isInteger(profile.durationWeeks)||profile.durationWeeks<1||profile.durationWeeks>5200)throw new Error('The plan duration is invalid.');
  profile.targetValue=legacy?(p.startWeight===null?null:p.startWeight-p.goalLoss):(p.targetValue===undefined?defaults.targetValue:p.targetValue);
  if(profile.targetValue!==null&&(!Number.isFinite(profile.targetValue)||profile.targetValue<0||profile.targetValue>10000))throw new Error('The target value is invalid.');
  profile.baselineValue=p.baselineValue??defaults.baselineValue;
  if(!Number.isFinite(profile.baselineValue)||profile.baselineValue<0||profile.baselineValue>10000)throw new Error('The baseline value is invalid.');
  profile.targetUnit=textValue(legacy?'kg':(p.targetUnit??defaults.targetUnit),40,'target unit',{markup:false});
  for(const field of ['lowImpact','trackMeasurements','safetyAccepted']){
    if(p[field]!==undefined&&typeof p[field]!=='boolean')throw new Error(`The ${field} preference is invalid.`);
    profile[field]=p[field]??(field==='trackMeasurements'?(legacy||goalType==='weight'):field==='safetyAccepted'?legacy:defaults[field]);
  }
  const restrictions=p.restrictions??defaults.restrictions;
  if(!Array.isArray(restrictions)||restrictions.some(value=>!['no-floor','knee','wrist','shoulder','back'].includes(value))||new Set(restrictions).size!==restrictions.length)throw new Error('The movement preferences are invalid.');
  profile.restrictions=[...restrictions];
  let equipment=p.equipment??defaults.equipment;
  if(typeof equipment==='string')equipment=equipment==='none'?['none']:equipment==='chair-wall'?['chair','wall']:equipment.split(',').map(value=>value.trim());
  if(!Array.isArray(equipment)||equipment.length<1||equipment.some(value=>!['none','chair','wall'].includes(value))||new Set(equipment).size!==equipment.length||(equipment.includes('none')&&equipment.length>1))throw new Error('The equipment preference is invalid.');
  profile.equipment=[...equipment];
  if(p.heightCm!==undefined){if(p.heightCm!==null&&(!Number.isFinite(p.heightCm)||p.heightCm<100||p.heightCm>250))throw new Error('The height is invalid.');profile.heightCm=p.heightCm;}
  const weightDates=new Set();
  const weights=x.weights.map(w=>{
    if(!w||!validDate(w.date)||!Number.isFinite(w.weight)||w.weight<30||w.weight>400)throw new Error('A weight entry is invalid.');
    if(weightDates.has(w.date))throw new Error('The backup contains more than one weigh-in for the same date.');
    weightDates.add(w.date);
    const entry={date:w.date,weight:w.weight};
    if(w.waist!==undefined&&w.waist!==null){
      if(!Number.isFinite(w.waist)||w.waist<30||w.waist>250)throw new Error('A waist measurement is invalid.');
      entry.waist=w.waist;
    }
    return entry;
  });
  const safeId=id=>typeof id==='string'&&id.length>=1&&id.length<=100&&!/[^a-zA-Z0-9_.-]/.test(id);
  const suppliedIds=new Set(),reservedIds=new Set();
  for(const record of [...x.workouts,...x.walks]){
    if(!record||typeof record!=='object'||Array.isArray(record))throw new Error('An activity entry is invalid.');
    if(record.id!==null&&record.id!==undefined&&typeof record.id!=='object'){
      if(suppliedIds.has(record.id))throw new Error('The backup contains duplicate activity identifiers.');
      suppliedIds.add(record.id);
      if(safeId(record.id))reservedIds.add(record.id);
    }
  }
  let nextImportedId=1;
  const cleanId=id=>{
    if(safeId(id))return id;
    // Older backups can omit identifiers. Reserve supplied IDs before repairing
    // missing or malformed ones so every history control targets one record.
    let replacement;
    do{replacement='imported-'+nextImportedId++;}while(reservedIds.has(replacement));
    reservedIds.add(replacement);
    return replacement;
  };
  const workouts=x.workouts.map(w=>{
    if(!validDate(w.date)||(!Object.hasOwn(SESSIONS,w.session)&&w.session!=='personalized')||!Number.isFinite(w.seconds)||w.seconds<0||w.seconds>3600||!Number.isInteger(w.skipped)||w.skipped<0)throw new Error('A workout entry is invalid.');
    const entry={date:w.date,session:w.session,seconds:w.seconds,skipped:w.skipped,id:cleanId(w.id)};
    if(w.title!==undefined)entry.title=textValue(w.title,120,'workout title');
    if(w.goalType!==undefined){if(!GOAL_TYPES.includes(w.goalType))throw new Error('A workout goal is invalid.');entry.goalType=w.goalType;}
    for(const [field,max] of [['effort',10],['soreness',5]]){
      if(w[field]!==undefined){if(!Number.isInteger(w[field])||w[field]<1||w[field]>max)throw new Error(`A workout ${field} rating is invalid.`);entry[field]=w[field];}
    }
    return entry;
  });
  const walks=x.walks.map(w=>{
    if(!validDate(w.date)||!Number.isFinite(w.minutes)||w.minutes<1||w.minutes>300)throw new Error('A walk entry is invalid.');
    const entry={date:w.date,minutes:w.minutes,id:cleanId(w.id)};
    if(w.intensity!==undefined){
      if(!['easy','brisk'].includes(w.intensity))throw new Error('A walking intensity is invalid.');
      entry.intensity=w.intensity;
    }
    return entry;
  });
  const assessmentContexts=new Set();
  const assessments=(x.assessments??[]).map(value=>{
    if(!value||!validDate(value.date)||!Number.isFinite(value.value)||value.value<0||value.value>10000)throw new Error('An assessment entry is invalid.');
    const entry={date:value.date,value:value.value};
    if(value.goalType!==undefined){if(!GOAL_TYPES.includes(value.goalType))throw new Error('An assessment goal is invalid.');entry.goalType=value.goalType;}
    if(value.unit!==undefined){if(!['reps','seconds','minutes','kg','sessions'].includes(value.unit))throw new Error('An assessment unit is invalid.');entry.unit=value.unit;}
    const context=JSON.stringify([entry.date,entry.goalType??'',entry.unit??'']);
    if(assessmentContexts.has(context))throw new Error('The backup contains more than one assessment for the same goal and unit on the same date.');
    assessmentContexts.add(context);
    if(value.notes!==undefined)entry.notes=textValue(value.notes,500,'assessment notes');
    if(value.time!==undefined){if(!Number.isFinite(value.time)||value.time<0||value.time>10000)throw new Error('An assessment time is invalid.');entry.time=value.time;}
    return entry;
  });
  return {version:3,profile,weights,workouts,walks,assessments,sound:x.sound!==false};
}
