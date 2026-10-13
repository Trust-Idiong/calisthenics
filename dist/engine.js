export const SESSIONS = {
  foundation: { id: 'foundation', title: 'Foundation', minutes: 10, level: 'Start here', warm: 120, cool: 120, work: 30, rest: 30, rounds: 2, exercises: ['chair', 'wall', 'march'], description: 'A gentle, low-impact introduction. A chair, a wall, and a little space are all you need.' },
  core: { id: 'core', title: 'Core & control', minutes: 12, level: 'When comfortable', warm: 120, cool: 120, work: 30, rest: 30, rounds: 2, exercises: ['bridge', 'bird', 'plank', 'march'], description: 'Build trunk and hip strength with controlled movement. Use the floor only if getting up and down is comfortable.' },
  strength: { id: 'strength', title: 'Full-body strength', minutes: 16, level: 'Build gradually', warm: 180, cool: 180, work: 40, rest: 20, rounds: 2, exercises: ['chair', 'wall', 'bridge', 'bird', 'plank'], description: 'A longer session with more working time. Progress here when the shorter sessions feel manageable.' }
};
export function sequenceFor(id) {
  const s = SESSIONS[id];
  if (!s) throw new Error('Unknown session');
  const steps = [{type:'warmup', exercise:'march', duration:s.warm, label:'Warm up', round:0}];
  for (let round=1;round<=s.rounds;round++) for (const exercise of s.exercises) {
    steps.push({type:'work',exercise,duration:s.work,round});
    steps.push({type:'rest',exercise,duration:s.rest,round,label:'Take a breather'});
  }
  steps.push({type:'cooldown',exercise:'cool',duration:s.cool,label:'Cool down',round:0});
  return steps;
}
export class WorkoutTimer {
  constructor(id='foundation', now=()=>performance.now()) { this.now=now; this.reset(id); }
  reset(id=this.id) { this.id=id; this.steps=sequenceFor(id); this.index=0; this.remaining=this.steps[0].duration; this.elapsed=0; this.status='ready'; this.skipped=0; this.last=0; }
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
  return {version:2,profile:{startDate:today,deadline:addMonths(today,7),startWeight:null,goalLoss:DEFAULT_GOAL_KG},weights:[],workouts:[],walks:[],sound:true};
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
  if(!x||![1,2].includes(x.version)||!x.profile)throw new Error('This is not a FORM / SEVEN backup.');
  const p=x.profile;
  if(!validDate(p.startDate)||!validDate(p.deadline)||daysBetween(p.startDate,p.deadline)<1)throw new Error('The goal dates are invalid.');
  if(p.startWeight!==null&&(!Number.isFinite(p.startWeight)||p.startWeight<30||p.startWeight>400))throw new Error('Starting weight must be between 30 and 400 kg.');
  if(!Number.isFinite(p.goalLoss)||p.goalLoss<=0||p.goalLoss>200||(p.startWeight!==null&&p.goalLoss>=p.startWeight))throw new Error('Check your goal weight.');
  if(!Array.isArray(x.weights)||!Array.isArray(x.workouts)||!Array.isArray(x.walks)||x.weights.length>10000||x.workouts.length>20000||x.walks.length>10000)throw new Error('The backup contains invalid records.');
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
  const workouts=x.workouts.map(w=>{if(!validDate(w.date)||!Object.hasOwn(SESSIONS,w.session)||!Number.isFinite(w.seconds)||w.seconds<0||w.seconds>3600||!Number.isInteger(w.skipped)||w.skipped<0)throw new Error('A workout entry is invalid.');return {date:w.date,session:w.session,seconds:w.seconds,skipped:w.skipped,id:cleanId(w.id)};});
  const walks=x.walks.map(w=>{
    if(!validDate(w.date)||!Number.isFinite(w.minutes)||w.minutes<1||w.minutes>300)throw new Error('A walk entry is invalid.');
    const entry={date:w.date,minutes:w.minutes,id:cleanId(w.id)};
    if(w.intensity!==undefined){
      if(!['easy','brisk'].includes(w.intensity))throw new Error('A walking intensity is invalid.');
      entry.intensity=w.intensity;
    }
    return entry;
  });
  // Upgrade the old default once. Keep custom goals and every existing progress entry.
  const revisedDefault=x.version===1&&p.goalLoss===30;
  return {version:2,profile:{startDate:p.startDate,deadline:revisedDefault?addMonths(p.startDate,7):p.deadline,startWeight:p.startWeight,goalLoss:revisedDefault?DEFAULT_GOAL_KG:p.goalLoss},weights,workouts,walks,sound:x.sound!==false};
}
