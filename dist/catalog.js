import {EXERCISES} from './exercises.js';
import {exerciseAllowed, sessionAllowed, validatePreferences} from './planner.js';

export const BODY_AREAS = Object.freeze([
  {id:'full',name:'Full body'}, {id:'abs',name:'Abs'}, {id:'chest',name:'Chest'}, {id:'arms',name:'Arms'},
  {id:'core',name:'Core'}, {id:'back',name:'Back'}, {id:'glutes',name:'Glutes'}, {id:'legs',name:'Legs'}
]);
export const STYLES = Object.freeze([
  {id:'strength',name:'Strength'}, {id:'cardio',name:'Cardio'}, {id:'hiit',name:'Interval training'},
  {id:'calisthenics',name:'Calisthenics'}, {id:'weight',name:'Weight-management activity'},
  {id:'warmup',name:'Warm-up'}, {id:'stretch',name:'Stretching'}, {id:'recovery',name:'Recovery'}
]);
const routine = (id,name,area,style,level,defaultMinutes,movements,description,extra={}) => ({id,name,title:name,area,style,level,defaultMinutes,minutes:defaultMinutes,movements,description,...extra});

// Original app-authored circuits. Source organizations do not endorse these plans.
export const ROUTINES = Object.freeze([
  routine('full-start','Full-body foundations','full','strength','beginner',12,['chair','wall','kneepushup','bird','bridge','march'],'Controlled introductory strength with chair, wall or comfortable floor options.'),
  routine('full-gentle-no-equipment','Gentle bodyweight foundations','full','calisthenics','beginner',12,['kneepushup','bridge','bird','march'],'Introductory knee-supported pressing and controlled hip/core movement. Use knee pressing only when comfortable; stop before form slips.'),
  routine('full-no-equipment','Bodyweight foundations','full','calisthenics','intermediate',18,['squat','kneepushup','forearmplank','reverselunge','bridge'],'Unassisted lower-body, pressing and core practice without gym equipment.'),
  routine('full-advanced','Experienced full-body circuit','full','calisthenics','advanced',25,['pushup','squat','reverselunge','sideplank','forearmplank'],'A balanced circuit for people already comfortable with floor pressing and lunges.'),
  routine('abs-control','Abs: steady control','abs','strength','beginner',10,['deadbug','bird','bridge','plank'],'Practice abdominal control with comfortable, deliberate movement; no spot-reduction claims.'),
  routine('abs-crunch','Abs: controlled crunch circuit','abs','strength','intermediate',12,['crunch','deadbug','forearmplank'],'Small controlled curls alternate with abdominal stabilization.'),
  routine('chest-start','Chest: wall-press practice','chest','strength','beginner',10,['wall','tricepswall'],'Start with supported wall pressing and an optional close-grip variation.'),
  routine('chest-knee-start','Chest: gentle floor pressing','chest','strength','beginner',10,['kneepushup'],'Introductory knee-supported pressing without equipment, when knees, wrists, shoulders and floor access are comfortable.'),
  routine('chest-floor','Chest: floor-press foundations','chest','strength','intermediate',12,['kneepushup'],'Practice knee-supported pressing with generous recovery.'),
  routine('chest-advanced','Chest: experienced floor pressing','chest','strength','advanced',16,['pushup','diamondpushup'],'Controlled standard and triangle pressing with breaks before technique slips.'),
  routine('arms-start','Arms: gentle pressing','arms','strength','beginner',10,['tricepswall','wall'],'Wall-supported triceps and pressing practice. A wall is required.'),
  routine('arms-knee-start','Arms: gentle bodyweight pressing','arms','strength','beginner',10,['kneepushup'],'A no-equipment introductory press for the arms and triceps. Pause or stop whenever the support positions feel uncomfortable.'),
  routine('arms-floor','Arms: triceps and press circuit','arms','strength','advanced',15,['diamondpushup','pushup'],'Bodyweight triceps emphasis for experienced floor exercisers.'),
  routine('core-stable','Core: stability foundations','core','strength','beginner',12,['bird','deadbug','plank','bridge'],'Coordinate breathing and trunk control with comfortable stability practice.'),
  routine('core-floor','Core: floor stability','core','calisthenics','intermediate',15,['forearmplank','deadbug','bird'],'Forearm-supported holds and controlled alternating core movements.'),
  routine('core-side','Core: sides and stability','core','calisthenics','advanced',15,['sideplank','forearmplank','mountainclimber'],'Practice both sides and steady trunk position; holds may be broken into shorter efforts.'),
  routine('back-control','Back: coordinated control','back','strength','beginner',10,['bird'],'Controlled bird-dog practice for posterior trunk coordination; no treatment claims.'),
  routine('back-mobility','Back and shoulder ease','back','stretch','beginner',8,['shoulderroll','pronecobra'],'Gentle shoulder movement and optional supported floor extension, within comfort.'),
  routine('glutes-start','Glutes: gentle foundations','glutes','strength','beginner',10,['bridge','chair','bird'],'Comfortable hip and glute control through supported strength movements.'),
  routine('glutes-control','Glutes: hips and lunges','glutes','strength','intermediate',15,['bridge','reverselunge','squat'],'Bridge, lunge and squat patterns for controlled hip strength.'),
  routine('legs-start','Legs: supported foundations','legs','strength','beginner',12,['chair','calfraise','march'],'Stable chair movements and gentle standing activity.'),
  routine('legs-no-equipment','Legs: bodyweight control','legs','strength','intermediate',16,['squat','reverselunge','march'],'Comfortable squats and reverse lunges without gym equipment.'),
  routine('cardio-gentle','Gentle cardio rhythm','full','cardio','beginner',10,['march','cool','seatedmarch'],'Easy standing or seated activity; build a manageable rhythm.'),
  routine('cardio-low','Low-impact cardio circuit','full','cardio','intermediate',15,['stepjack','march','squat'],'Step-outs and controlled lower-body movement with no jumping.'),
  routine('hiit-low','Low-impact intervals','full','hiit','intermediate',16,['stepjack','squat','kneepushup','march'],'Working windows alternate with recovery. Effort stays controlled; maximal intensity is not required.'),
  routine('hiit-advanced','Experienced jumping intervals','full','hiit','advanced',18,['burpee','jumpingjack','mountainclimber','pushup'],'Short, controlled advanced conditioning intervals with ample recovery.',{impact:'higher',required:['burpee','jumpingjack']}),
  routine('weight-movement','Movement for weight-management goals','full','weight','beginner',15,['march','chair','wall','bridge'],'Build a movement habit alongside optional measurements; no calorie or weight-loss guarantee.'),
  routine('warmup-standing','Standing warm-up','full','warmup','beginner',6,['march','shoulderroll','sidebend'],'Ease into activity with gentle steps, shoulder circles and small trunk movements.'),
  routine('stretch-standing','Standing mobility break','full','stretch','beginner',6,['calfstretch','sidebend','shoulderroll'],'Gentle supported calf and standing mobility. No forced stretching.'),
  routine('stretch-floor','Legs and hips: floor mobility','legs','stretch','beginner',8,['hamstringstretch','glutestretch','quadstretch'],'Short comfortable stretches with time on both sides.'),
  routine('recovery-seated','Seated recovery break','full','recovery','beginner',6,['seatedmarch','anklepump','cheststretch'],'Comfortable seated movement using a stable chair.'),
  routine('recovery-gentle','Gentle movement and recovery','full','recovery','beginner',8,['cool','shoulderroll','sidebend'],'Keep activity easy and leave time to let breathing settle.'),
  routine('pushup-practice','Push-up practice','chest','calisthenics','beginner',10,['pushup','kneepushup','wall'],'Use the pressing variation that matches your selected ability and equipment. Repetitions are self-assessed, never inferred from the timer.',{singleVariation:true})
]);

const program = (id,name,routineId,level,description,extra={}) => ({id,name,weeks:4,durationWeeks:4,routineId,level,daysPerWeek:3,description,schedule:[{day:1,routineId},{day:3,routineId},{day:5,routineId}],recoveryDays:[2,4],...extra});
export const PROGRAMS = Object.freeze([
  program('foundation-four','Four-week foundations','full-start','beginner','Build a manageable strength rhythm over four weeks. The fourth week is lighter.'),
  program('bodyweight-four','Four-week bodyweight routine','full-no-equipment','intermediate','Practice balanced bodyweight strength on three separated days each week.'),
  program('pushup-challenge','Four-week push-up practice','pushup-practice','beginner','Practice a suitable push-up variation with recovery days. Log comfortable repetitions yourself; there is no promised repetition increase.',{challenge:true,assessment:'Comfortable repetitions using the same variation and method.'}),
  program('core-four','Four-week core consistency','core-stable','beginner','Repeat controlled core practice and record comfortable assessments if useful.'),
  program('cardio-four','Four-week activity rhythm','cardio-gentle','beginner','Develop a repeatable gentle activity habit with optional walking between sessions.'),
  program('strength-four','Four-week experienced strength','full-advanced','advanced','Practice experienced bodyweight patterns without maximal-effort tests or guaranteed outcomes.')
]);

const ranks = {beginner:0,intermediate:1,advanced:2};
const gentle = ['march','cool','shoulderroll','seatedmarch','anklepump','sidebend','wall','plank','bridge','deadbug'];
const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
const noMarkup = (value,label,max=100) => {
  if(typeof value!=='string'||!value.trim()||value.length>max||/[<>\u0000-\u001f\u007f]/.test(value))throw new Error(`Use a plain-text ${label} of 1–${max} characters.`);
  return value.trim();
};
const getRoutine = id => {const found=ROUTINES.find(item=>item.id===id);if(!found)throw new Error('Choose a known workout routine.');return found;};
function checkRoutine(p,r) {
  if(p.ageBand==='teen'&&r.style==='weight')throw new Error('Weight-management routines are for adults. Choose a fitness, strength or movement routine for teens.');
  if(r.area==='back'&&p.restrictions.includes('back'))throw new Error('Back-focused routines do not match your back-sensitive movement preference. Choose another available area.');
  if(ranks[p.experience]<ranks[r.level])throw new Error(`${r.name} is an ${r.level} routine. Choose a routine matching your current experience; change your level only when it reflects your ability.`);
  if(p.ageBand!=='adult'&&r.level!=='beginner')throw new Error('This routine uses harder variations than the gentle teen or older-adult plan. Choose a foundation, mobility or recovery routine.');
  if(r.impact==='higher'&&(p.lowImpact||p.ageBand!=='adult'))throw new Error('This routine includes jumping and needs an experienced adult choosing higher-impact movement. Choose a low-impact routine instead.');
  let selected=r.movements.filter(id=>exerciseAllowed(p,id)&&(r.area==='full'||EXERCISES[id].bodyAreas?.includes(r.area)));
  if(r.singleVariation)selected=selected.slice(0,1);
  if(!selected.length)throw new Error(`No ${r.area==='full'?'routine':BODY_AREAS.find(area=>area.id===r.area)?.name.toLowerCase()} movements in ${r.name} match your equipment and movement preferences. Choose another routine or review your preferences.`);
  if(r.required?.some(id=>!selected.includes(id)))throw new Error(`${r.name} requires movements excluded by your preferences. Choose another routine.`);
  if(r.area==='full'&&['strength','calisthenics'].includes(r.style)){
    const areas=new Set(selected.flatMap(id=>EXERCISES[id].bodyAreas??[]));
    if(!(['legs','glutes'].some(area=>areas.has(area))&&['arms','chest'].some(area=>areas.has(area))))throw new Error('A balanced full-body circuit does not match these movement choices. Try an available body-area routine instead.');
  }
  return selected;
}
export function routineAvailability(profile,routineId) {
  try{const p=validatePreferences(profile),r=getRoutine(routineId),movements=checkRoutine(p,r);return {available:true,reason:'Matches your current training choices.',movements,eligibleMovements:movements,omittedMovements:r.movements.filter(id=>!movements.includes(id))};}
  catch(error){return {available:false,reason:error.message,movements:[],eligibleMovements:[],omittedMovements:[]};}
}
function preparation(p,type) {
  const ids=type==='cooldown'?['cool','shoulderroll','sidebend',...gentle]:gentle;
  const exercise=ids.find(id=>exerciseAllowed(p,id));
  if(!exercise)throw new Error('No comfortable preparation or cool-down movement matches your preferences. Review your movement choices before starting.');
  return exercise;
}
function interval(steps,exercise,work,rest,round) {
  if(EXERCISES[exercise].bilateral){
    const transition=Math.min(5,rest);
    steps.push({type:'work',exercise,duration:Math.floor(work/2),round,label:`${EXERCISES[exercise].name} · left side`});
    if(transition)steps.push({type:'rest',exercise,duration:transition,round,label:'Relax and change sides'});
    steps.push({type:'work',exercise,duration:Math.ceil(work/2),round,label:`${EXERCISES[exercise].name} · right side`});
    if(rest-transition)steps.push({type:'rest',exercise,duration:rest-transition,round,label:'Rest and breathe normally'});
  }else{
    steps.push({type:'work',exercise,duration:work,round});
    if(rest)steps.push({type:'rest',exercise,duration:rest,round,label:'Rest and breathe normally'});
  }
}
function verify(p,descriptor) {
  if(!sessionAllowed(p,descriptor.steps))throw new Error('This session includes a movement excluded by your preferences. Review the routine before starting.');
  const total=descriptor.steps.reduce((sum,step)=>sum+step.duration,0);
  if(total>3600||Math.abs(total-descriptor.minutes*60)>0.000001||descriptor.steps.length>500||!descriptor.steps.some(step=>step.type==='work'))throw new Error('This session duration is invalid.');
  return descriptor;
}

export function catalogSession(profile,routineId,opts={}) {
  const p=validatePreferences(profile),r=getRoutine(routineId),selected=checkRoutine(p,r);
  const minutes=opts.minutes??r.defaultMinutes,week=opts.week??1;
  if(!Number.isInteger(minutes)||minutes<5||minutes>60)throw new Error('Choose a routine duration from 5 to 60 minutes.');
  if(!Number.isInteger(week)||week<1||week>5200)throw new Error('Choose a valid program week.');
  const feedback=opts.feedback??'just-right';
  if(!['easy','just-right','hard'].includes(feedback))throw new Error('Choose easy, just-right or hard for workout feedback.');
  const recovery=['warmup','stretch','recovery'].includes(r.style);
  const workCap=p.ageBand==='adult'?50:30;
  let work=recovery?20:{beginner:25,intermediate:35,advanced:40}[p.experience];
  let rest=recovery?20:60-work;
  if(p.ageBand==='older')rest=Math.max(rest,40);
  if(p.ageBand==='teen')rest=Math.max(rest,35);
  let adaptationReason=opts.feedback===undefined?'Working windows and recovery match your current ability and movement choices.':'Your last session felt manageable; the work and recovery balance stays steady.';
  if(feedback==='hard'){work=Math.max(15,work-10);rest+=15;adaptationReason='Your last session felt hard: shorter working windows and longer recovery, with the same eligible movements.';}
  if(feedback==='easy'&&!recovery){work=Math.min(workCap,work+5);rest=Math.max(p.ageBand==='adult'?20:p.ageBand==='older'?40:35,rest-5);adaptationReason='Your last session felt easy: a small increase in working time within your current level; no harder exercise variation was added.';}
  if(week%4===0&&!recovery){work=Math.max(15,work-10);rest+=10;adaptationReason+=' This fourth week is lighter.';}
  work=Math.min(work,workCap);
  const total=minutes*60,warm=Math.round(clamp(total*.2,60,360)),cool=Math.round(clamp(total*.15,60,300));
  let budget=total-warm-cool,index=0;
  const steps=[{type:'warmup',exercise:preparation(p,'warmup'),duration:warm,round:0,label:'Warm up gently; pause as needed'}];
  while(budget>=Math.min(work,20)+rest){
    const exercise=selected[index%selected.length];
    const effort=Math.min(work,exercise==='burpee'?20:exercise==='mountainclimber'?30:work);
    if(budget<effort+rest)break;
    interval(steps,exercise,effort,rest,Math.floor(index/selected.length)+1);
    budget-=effort+rest;index++;
  }
  steps.push({type:'cooldown',exercise:preparation(p,'cooldown'),duration:cool+budget,round:0,label:'Ease down and let breathing settle'});
  const omitted=r.movements.filter(id=>!selected.includes(id));
  const description=r.description+(omitted.length?` Omitted unavailable variations: ${omitted.map(id=>EXERCISES[id].name).join(', ')}.`:'')+' Activity windows allow breaks and do not require continuous holds. Results are not guaranteed.';
  return verify(p,{id:'personalized',title:r.name,minutes,steps,routineId:r.id,area:r.area,style:r.style,description,adaptationReason,recovery,level:r.level});
}

export function buildCustomSession(profile,spec) {
  const p=validatePreferences(profile);
  if(!spec||typeof spec!=='object'||Array.isArray(spec))throw new Error('Your custom routine is invalid.');
  const title=noMarkup(spec.name,'routine name');
  if(!Array.isArray(spec.movements)||!spec.movements.length||spec.movements.length>30)throw new Error('Choose 1 to 30 movement rows for your custom routine.');
  const warmup=spec.warmup??120,cooldown=spec.cooldown??120;
  for(const duration of [warmup,cooldown])if(!Number.isInteger(duration)||duration<1||duration>600)throw new Error('Preparation and cool-down must each be 1 to 600 seconds.');
  const warmupExercise=spec.warmupExercise??preparation(p,'warmup'),cooldownExercise=spec.cooldownExercise??preparation(p,'cooldown');
  const steps=[{type:'warmup',exercise:warmupExercise,duration:warmup,round:0,label:'Warm up comfortably'}];
  for(const row of spec.movements){
    if(!row||!Object.hasOwn(EXERCISES,row.exercise))throw new Error('Choose a known movement for every custom row.');
    if(!exerciseAllowed(p,row.exercise))throw new Error(`${EXERCISES[row.exercise].name} does not match your experience, equipment or movement preferences.`);
    if(!Number.isInteger(row.work)||row.work<5||row.work>180||!Number.isInteger(row.rest)||row.rest<0||row.rest>180||!Number.isInteger(row.rounds)||row.rounds<1||row.rounds>5)throw new Error('Use work 5–180 seconds, rest 0–180 seconds, and 1–5 rounds per movement.');
    for(let round=1;round<=row.rounds;round++)interval(steps,row.exercise,row.work,row.rest,round);
  }
  steps.push({type:'cooldown',exercise:cooldownExercise,duration:cooldown,round:0,label:'Cool down comfortably'});
  const total=steps.reduce((sum,step)=>sum+step.duration,0);
  if(total>3600)throw new Error('Your custom routine exceeds 60 minutes. Shorten intervals or reduce rounds.');
  if(spec.id!==undefined&&(typeof spec.id!=='string'||!/^[a-zA-Z0-9_.-]{1,100}$/.test(spec.id)))throw new Error('The custom routine identifier is invalid.');
  const routineId=spec.id;
  return verify(p,{id:'personalized',title,minutes:total/60,steps,...(routineId?{routineId}:{}),area:'full',style:'calisthenics',description:'Your movements, order and interval choices. Take extra breaks whenever needed; no maximal effort is required.',adaptationReason:'Custom intervals are preserved exactly. Your equipment and movement preferences apply to every step.'});
}
