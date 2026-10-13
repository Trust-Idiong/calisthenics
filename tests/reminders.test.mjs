import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReminderPreferences,nextReminder,reminderDue,calendarICS} from '../dist/reminders.js';
process.env.TZ='America/Edmonton';
const preferences=()=>({enabled:true,time:'18:00',days:[1,3,5],lastNotified:''});
test('local next reminders follow selected weekdays and skip elapsed or already-notified occurrences',()=>{
  const reminder=preferences();let next=nextReminder(reminder,'2026-10-12','17:30');assert.equal(next.date,'2026-10-12');assert.equal(next.time,'18:00');assert.equal(next.key,'2026-10-12T18:00');assert.equal(next.at.getHours(),18);
  next=nextReminder(reminder,'2026-10-12','18:01');assert.equal(next.date,'2026-10-14');
  next=nextReminder({...reminder,lastNotified:'2026-10-12T18:00'},'2026-10-12','18:00');assert.equal(next.date,'2026-10-14');
  assert.equal(nextReminder({...reminder,enabled:false},'2026-10-12','17:30'),null);
  next=nextReminder({...reminder,days:[1]},'2026-10-12','18:01');assert.equal(next.date,'2026-10-19');
});
test('foreground reminders are due only once during their five-minute delivery window',()=>{
  const reminder=preferences();assert.equal(reminderDue(reminder,'2026-10-12','17:59'),false);assert.equal(reminderDue(reminder,'2026-10-12','18:00'),true);assert.equal(reminderDue(reminder,'2026-10-12','18:04'),true);assert.equal(reminderDue(reminder,'2026-10-12','18:05'),false);assert.equal(reminderDue(reminder,'2026-10-13','18:00'),false);assert.equal(reminderDue({...reminder,lastNotified:'2026-10-12T18:00'},'2026-10-12','18:02'),false);assert.equal(reminderDue({...reminder,enabled:false},'2026-10-12','18:00'),false);
});
test('weekday schedules retain their local hour across Edmonton daylight-saving changes',()=>{
  const reminder={...preferences(),days:[0]};
  const before=nextReminder(reminder,new Date('2026-10-25T17:00:00')),after=nextReminder(reminder,new Date('2026-10-26T17:00:00'));
  assert.equal(before.at.getHours(),18);assert.equal(after.at.getHours(),18);assert.equal(before.at.toISOString(),'2026-10-26T00:00:00.000Z');assert.equal(after.at.toISOString(),'2026-11-02T01:00:00.000Z');
  const gap={...reminder,time:'02:30'};assert.equal(nextReminder(gap,new Date('2026-03-08T01:59:00')).date,'2026-03-08');
  const repeated={...reminder,time:'01:30',lastNotified:'2026-11-01T01:30'};assert.equal(reminderDue(repeated,new Date('2026-11-01T01:31:00-07:00')),false);
});
test('invalid reminder settings and current times cannot create an alert schedule',()=>{
  for(const patch of [{enabled:'yes'},{enabled:null},{time:'24:00'},{time:null},{days:[]},{days:[1,1]},{days:[7]},{days:[1.5]},{lastNotified:'2026-02-30T18:00'},{lastNotified:'<script>'}])assert.throws(()=>validateReminderPreferences({...preferences(),...patch}));
  assert.throws(()=>nextReminder(preferences(),new Date('invalid')));assert.throws(()=>nextReminder(preferences(),'2026-10-12','bad'));
  assert.deepEqual(validateReminderPreferences(undefined,[2,4]),{enabled:false,time:'18:00',days:[2,4],lastNotified:''});
  assert.throws(()=>validateReminderPreferences({...preferences(),time:'18:00\n'}),/reminder time/);
  assert.throws(()=>validateReminderPreferences({...preferences(),lastNotified:'2026-10-12T18:00\n'}),/last reminder/);
});
test('calendar exports contain a bounded floating local recurrence and an at-time display alarm',()=>{
  const profile={startDate:'2026-10-13',deadline:'2026-12-08',sessionMinutes:25,name:'Alex'};
  const ics=calendarICS(profile,preferences(),'enrollment-123',new Date('2026-10-13T12:00:00Z')),unfolded=ics.replace(/\r\n[ \t]/g,'');
  assert.match(unfolded,/DTSTART:20261014T180000\r\n/);assert.match(unfolded,/DURATION:PT25M\r\n/);assert.match(unfolded,/RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261208T235959\r\n/);assert.match(unfolded,/DTSTAMP:20261013T120000Z\r\n/);assert.match(unfolded,/UID:form-enrollment-123-2026-10-13-1800@form.local/);assert.match(unfolded,/BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:PT0S/);assert.doesNotMatch(unfolded,/TZID|DTSTART:.*Z\r\n|UNTIL=.*Z/);assert.ok(ics.endsWith('END:VCALENDAR\r\n'));assert.doesNotMatch(ics.replaceAll('\r\n',''),/[\r\n]/);
});
test('calendar text is escaped and folded by UTF-8 bytes without permitting new properties',()=>{
  const name='Élodie; 名, '+('🏃'.repeat(25))+'\nATTENDEE:bad@example.com\\path';
  const ics=calendarICS({startDate:'2026-10-12',deadline:'2026-10-30',sessionMinutes:20,name},preferences(),undefined,new Date('2026-10-12T12:00:00Z'));
  for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line,'utf8')<=75);
  assert.doesNotMatch(ics,/\r\nATTENDEE:/);const unfolded=ics.replace(/\r\n[ \t]/g,'');assert.match(unfolded,/SUMMARY:Élodie\\; 名\\,/);assert.match(unfolded,/\\nATTENDEE:/);assert.doesNotMatch(unfolded,/\uFFFD/);
  assert.throws(()=>calendarICS({startDate:'2026-10-12',deadline:'2026-10-12'}, {...preferences(),days:[2]}),/No reminder days/);
  assert.throws(()=>calendarICS({startDate:'2026-02-30',deadline:'2026-10-30'},preferences()),/calendar plan dates/);
  assert.throws(()=>calendarICS({startDate:'2026-10-12',deadline:'2026-10-30'},preferences(),'bad\r\nBEGIN:VEVENT'),/program identifier/);
  for(const suffix of ['\n','\r','\r\n','\u2028','\u2029'])assert.throws(()=>calendarICS({startDate:'2026-10-12',deadline:'2026-10-30'},preferences(),'valid-id'+suffix),/program identifier/);
  assert.throws(()=>calendarICS({startDate:'2026-10-12\n',deadline:'2026-10-30'},preferences()),/calendar plan dates/);
  assert.throws(()=>calendarICS({startDate:'2026-10-12',deadline:'2026-10-30',name:'Invalid\u0000name'},preferences()),/calendar profile name/);
});
