// Calendar serialization follows RFC 5545. Floating local times keep the chosen
// hour when the user travels; exported alarms are managed by the device calendar.
export const DEFAULT_REMINDERS=Object.freeze({enabled:false,time:'18:00',days:Object.freeze([1,3,5]),lastNotified:''});
const timeIsValid=value=>typeof value==='string'&&value.length===5&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const dateIsValid=value=>typeof value==='string'&&value.length===10&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const dateString=date=>`${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function validateReminderPreferences(value,defaultDays=DEFAULT_REMINDERS.days){
  if(value===undefined)value={};
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('The reminder settings are invalid.');
  const enabled=value.enabled===undefined?false:value.enabled,time=value.time===undefined?'18:00':value.time,days=value.days===undefined?defaultDays:value.days,lastNotified=value.lastNotified===undefined?'':value.lastNotified;
  if(typeof enabled!=='boolean'||!timeIsValid(time)||!Array.isArray(days)||days.length<1||days.length>7||days.some(day=>!Number.isInteger(day)||day<0||day>6)||new Set(days).size!==days.length)throw new Error('Choose a valid reminder time and at least one unique weekday.');
  if(typeof lastNotified!=='string'||(lastNotified!==''&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(lastNotified)||!dateIsValid(lastNotified.slice(0,10))||!timeIsValid(lastNotified.slice(11)))))throw new Error('The last reminder identifier is invalid.');
  return {enabled,time,days:[...days],lastNotified};
}
function localNow(value=new Date(),time){
  if(typeof value==='string'&&dateIsValid(value)){
    if(time!==undefined&&!timeIsValid(time))throw new Error('The current local time is invalid.');
    value=new Date(`${value}T${time??'00:00'}:00`);
  }
  if(!(value instanceof Date)||!Number.isFinite(value.getTime()))throw new Error('The current date is invalid.');
  return new Date(value.getTime());
}
function occurrence(date,time){
  const key=dateString(date),at=new Date(`${key}T${time}:00`);
  return {date:key,time,at,key:`${key}T${time}`};
}
export function nextReminder(preferences,now=new Date(),time){
  const reminder=validateReminderPreferences(preferences);
  if(!reminder.enabled)return null;
  const current=localNow(now,time),day=new Date(current.getTime());day.setHours(12,0,0,0);
  for(let offset=0;offset<=7;offset++){
    if(reminder.days.includes(day.getDay())){
      const next=occurrence(day,reminder.time);
      if(next.at>=current&&next.key!==reminder.lastNotified)return next;
    }
    day.setDate(day.getDate()+1);
  }
  return null;
}
// A foreground check only. This module schedules no background timers or push.
export function reminderDue(preferences,now=new Date(),time){
  const reminder=validateReminderPreferences(preferences);
  if(!reminder.enabled)return false;
  const current=localNow(now,time),candidate=occurrence(current,reminder.time);
  return reminder.days.includes(current.getDay())&&candidate.key!==reminder.lastNotified&&current>=candidate.at&&current-candidate.at<5*60000;
}
const escapeText=value=>String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function foldLine(value){
  const lines=[];let line='',bytes=0;const encoder=new TextEncoder();
  for(const character of value){
    const size=encoder.encode(character).length;
    if(bytes+size>75){lines.push(line);line=' ';bytes=1;}
    line+=character;bytes+=size;
  }
  lines.push(line);return lines.join('\r\n');
}
export function calendarICS(profile,preferences,programId='personal-plan',now=new Date()){
  const reminder=validateReminderPreferences(preferences);
  if(!profile||!dateIsValid(profile.startDate)||!dateIsValid(profile.deadline)||profile.startDate>profile.deadline)throw new Error('The calendar plan dates are invalid.');
  const minutes=profile.sessionMinutes??20;
  if(!Number.isInteger(minutes)||minutes<1||minutes>60)throw new Error('The calendar session length is invalid.');
  programId=programId??'personal-plan';
  if(typeof programId!=='string'||programId.length<1||programId.length>100||/[^-a-zA-Z0-9_.]/.test(programId))throw new Error('The calendar program identifier is invalid.');
  const first=new Date(profile.startDate+'T12:00:00');
  while(!reminder.days.includes(first.getDay()))first.setDate(first.getDate()+1);
  const firstKey=dateString(first);
  if(firstKey>profile.deadline)throw new Error('No reminder days fall within these plan dates.');
  const stamp=localNow(now).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const time=reminder.time.replace(':','')+'00',weekdays=['SU','MO','TU','WE','TH','FR','SA'];
  if(profile.name!==undefined&&(typeof profile.name!=='string'||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(profile.name)))throw new Error('The calendar profile name is invalid.');
  const name=typeof profile.name==='string'?[...profile.name].slice(0,80).join('').trim():'';
  const summary=name?`${name}'s FORM workout`:'FORM workout';
  const lines=[
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FORM//Training reminders//EN','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',`UID:form-${programId}-${profile.startDate}-${reminder.time.replace(':','')}@form.local`,`DTSTAMP:${stamp}`,
    `DTSTART:${firstKey.replaceAll('-','')}T${time}`,`DURATION:PT${minutes}M`,
    `RRULE:FREQ=WEEKLY;BYDAY=${[...reminder.days].sort((a,b)=>a-b).map(day=>weekdays[day]).join(',')};UNTIL=${profile.deadline.replaceAll('-','')}T235959`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(`A ${minutes}-minute FORM session. Open the app for your chosen routine. Your calendar app manages this reminder.`)}`,
    'CLASS:PRIVATE','BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:PT0S','DESCRIPTION:Time for your FORM workout','END:VALARM',
    'END:VEVENT','END:VCALENDAR'
  ];
  return lines.map(foldLine).join('\r\n')+'\r\n';
}
