import json
import math
import re
from datetime import date
from pathlib import Path
from django.core.exceptions import ValidationError

GOALS = {'conditioning', 'strength', 'core', 'cardio', 'weight', 'mobility', 'consistency', 'test', 'curves', 'abs'}
ID_RE = re.compile(r'^[A-Za-z0-9_.-]{1,100}$')
EXERCISES = set(json.loads((Path(__file__).parent / 'exercise_ids.json').read_text()))

def invalid(message):
    raise ValidationError(message)

def number(value, low, high, label, integer=False, nullable=False):
    if nullable and value is None:
        return
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < low or value > high or (integer and int(value) != value):
        invalid(f'{label} is outside its supported range.')

def text(value, limit, label):
    if not isinstance(value, str) or len(value) > limit or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', value):
        invalid(f'{label} is invalid.')

def identifier(value, label='Identifier'):
    if not isinstance(value, str) or not ID_RE.fullmatch(value):
        invalid(f'{label} is invalid.')

def day(value):
    try:
        if not isinstance(value, str) or date.fromisoformat(value).isoformat() != value:
            invalid('A calendar date is invalid.')
    except (TypeError, ValueError):
        invalid('A calendar date is invalid.')

def record(value, fields, label):
    if not isinstance(value, dict) or set(value) - fields:
        invalid(f'{label} contains unsupported fields.')

def choices(value, allowed, minimum=0, label='Choices'):
    if not isinstance(value, list) or len(value) < minimum or len(value) > len(allowed) or any(type(x) not in (str, int) or x not in allowed for x in value) or len(set(value)) != len(value):
        invalid(f'{label} are invalid.')

def optional_numbers(value, fields):
    for field, bounds in fields.items():
        if field in value:
            number(value[field], *bounds, field)

def validate_state(state):
    record(state, {'version', 'profile', 'weights', 'bodyMeasurements', 'workouts', 'walks', 'assessments', 'favorites', 'customRoutines', 'activeProgram', 'settings', 'sound'}, 'State')
    if not {'version','profile','weights','workouts','walks'} <= set(state): invalid('Required state collections are missing.')
    if state.get('version') != 4 or type(state.get('version')) is not int:
        invalid('Cloud progress requires current state format 4. Restore older backups in the app first.')
    p = state.get('profile')
    record(p, {'startDate','deadline','startWeight','goalLoss','goalType','name','experience','days','sessionMinutes','durationWeeks','targetValue','baselineValue','targetUnit','ageBand','lowImpact','restrictions','coaching','equipment','trackMeasurements','safetyAccepted','heightCm','gender','motivation','focusAreas','birthYear','location','cardioComfort','flexibility','feelings','reward','onboardingComplete'}, 'Profile')
    day(p.get('startDate')); day(p.get('deadline'))
    if p['deadline'] <= p['startDate']:
        invalid('The goal deadline must follow its start date.')
    enums = {'goalType': GOALS, 'experience': {'beginner','intermediate','advanced'}, 'ageBand': {'teen','adult','older'},
        'coaching': {'supportive','quiet'}, 'gender': {'male','female','other','prefer-not-to-say'},
        'location': {'gym','home','outdoors'}, 'reward': {'clothes','meal','gift','trip','photos','none'},
        'motivation': {'tone','confidence','energy','health','stress',None}, 'cardioComfort': {'out-of-breath','mild','easy',None},
        'flexibility': {'far','near','touch',None}, 'targetUnit': {'reps','seconds','minutes','kg','sessions'}}
    for field, values in enums.items():
        if field in p and (not isinstance(p[field], (str, type(None))) or p[field] not in values):
            invalid(f'The {field} preference is invalid.')
    if p.get('goalType') not in GOALS:
        invalid('Choose a supported goal.')
    for field in ['lowImpact','trackMeasurements','safetyAccepted','onboardingComplete']:
        if field in p and type(p[field]) is not bool:
            invalid(f'The {field} preference is invalid.')
    text(p.get('name',''),80,'Profile name')
    number(p.get('startWeight'),30,400,'Starting weight',nullable=True)
    number(p.get('goalLoss'),0,200,'Weight goal')
    if p.get('startWeight') is not None and p['goalLoss'] >= p['startWeight']:
        invalid('The weight goal is invalid.')
    number(p.get('targetValue'),0,10000,'Target',nullable=True)
    number(p.get('baselineValue',0),0,10000,'Baseline')
    number(p.get('sessionMinutes'),10,60,'Session duration',integer=True)
    if 'durationWeeks' in p: number(p['durationWeeks'],1,5200,'Plan duration',integer=True)
    if 'heightCm' in p: number(p['heightCm'],100,250,'Height',nullable=True)
    if p.get('birthYear') is not None: number(p['birthYear'],date.today().year-100,date.today().year-16,'Birth year',integer=True)
    teen = p.get('ageBand') == 'teen' or (p.get('birthYear') is not None and date.today().year-p['birthYear'] < 18)
    if teen and p['goalType'] in {'weight','curves','abs'}: invalid('Adult body goals are not available for a teen profile.')
    choices(p.get('days'),set(range(7)),1,'Training days')
    for field, allowed, minimum in [('equipment',{'none','chair','wall'},1),('restrictions',{'no-floor','knee','wrist','shoulder','back'},0),('focusAreas',{'full','abs','chest','arms','core','back','glutes','legs'},1),('feelings',{'confidence','body','achievement','energy','health'},0)]:
        if field in p: choices(p[field],allowed,minimum,field)
    if 'none' in p.get('equipment',[]) and len(p['equipment']) > 1: invalid('No-equipment cannot be combined with support equipment.')
    limits = {'weights':10000,'bodyMeasurements':10000,'workouts':20000,'walks':10000,'assessments':10000,'favorites':200,'customRoutines':100}
    for field, limit in limits.items():
        value = state.get(field,[])
        if not isinstance(value,list) or len(value)>limit: invalid(f'The {field} collection is too large or invalid.')
    seen_dates = set()
    for value in state.get('weights',[]):
        record(value,{'date','weight','waist'},'Weight entry');day(value.get('date'))
        number(value.get('weight'),30,400,'Weight');optional_numbers(value,{'waist':(30,250)})
        if value['date'] in seen_dates: invalid('Duplicate weigh-in date.')
        seen_dates.add(value['date'])
    seen_dates = set()
    for value in state.get('bodyMeasurements',[]):
        record(value,{'date','waist','hips'},'Measurement');day(value.get('date'))
        if not {'waist','hips'} & set(value): invalid('A waist or hip entry is required.')
        optional_numbers(value,{'waist':(30,250),'hips':(40,300)})
        if value['date'] in seen_dates: invalid('Duplicate body-measurement date.')
        seen_dates.add(value['date'])
    seen_ids = set()
    for value in state.get('workouts',[]):
        record(value,{'id','date','session','seconds','skipped','title','goalType','routineId','programId','difficultyFeedback','kcal','kcalSource','kcalWeight','kcalMET','kcalAge','effort','soreness'},'Workout')
        day(value.get('date'));identifier(value.get('id'));number(value.get('seconds'),0,3600,'Workout time');number(value.get('skipped'),0,100000,'Skipped intervals',integer=True)
        if value.get('session') not in {'foundation','core','strength','personalized'}: invalid('Unknown session.')
        if value['id'] in seen_ids: invalid('Duplicate activity identifier.')
        seen_ids.add(value['id'])
        if 'title' in value: text(value['title'],120,'Workout title')
        if 'goalType' in value and value['goalType'] not in GOALS: invalid('Unknown workout goal.')
        for field in ['routineId','programId']:
            if field in value: identifier(value[field])
        if 'difficultyFeedback' in value and value['difficultyFeedback'] not in {'easy','just-right','hard'}: invalid('Invalid difficulty feedback.')
        optional_numbers(value,{'kcal':(0,10000),'kcalWeight':(30,400),'kcalMET':(1,20)})
        for field, maximum in [('effort',10),('soreness',5),('kcalAge',59)]:
            if field in value: number(value[field],19 if field=='kcalAge' else 1,maximum,field,integer=True)
        if 'kcalSource' in value and (value['kcalSource'] not in {'estimated','manual'} or 'kcal' not in value): invalid('Invalid energy source.')
        if value.get('kcalSource')=='estimated' and not {'kcalAge','kcalWeight','kcalMET'} <= set(value): invalid('Energy estimate inputs are required.')
        if value.get('kcalSource')!='estimated' and {'kcalAge','kcalWeight','kcalMET'} & set(value): invalid('Only estimates can contain energy inputs.')
    for value in state.get('walks',[]):
        record(value,{'id','date','minutes','intensity'},'Walk');day(value.get('date'));identifier(value.get('id'));number(value.get('minutes'),1,300,'Walking time')
        if value['id'] in seen_ids: invalid('Duplicate activity identifier.')
        seen_ids.add(value['id'])
        if 'intensity' in value and value['intensity'] not in {'easy','brisk'}: invalid('Invalid walk intensity.')
    seen_assessments=set()
    for value in state.get('assessments',[]):
        record(value,{'date','value','goalType','unit','notes','time'},'Assessment');day(value.get('date'));number(value.get('value'),0,10000,'Assessment')
        if 'goalType' in value and value['goalType'] not in GOALS: invalid('Invalid assessment goal.')
        if 'unit' in value and value['unit'] not in {'reps','seconds','minutes','kg','sessions'}: invalid('Invalid assessment unit.')
        if 'notes' in value: text(value['notes'],500,'Assessment note')
        optional_numbers(value,{'time':(0,10000)})
        context=(value['date'],value.get('goalType'),value.get('unit'))
        if context in seen_assessments: invalid('Duplicate assessment context.')
        seen_assessments.add(context)
    for value in state.get('favorites',[]): identifier(value)
    if len(set(state.get('favorites',[]))) != len(state.get('favorites',[])): invalid('Duplicate favorite identifier.')
    routine_ids=set()
    for value in state.get('customRoutines',[]):
        record(value,{'id','name','warmup','cooldown','movements'},'Custom routine');identifier(value.get('id'));text(value.get('name'),120,'Routine name')
        if not value['name'].strip() or re.search(r'[<>]',value['name']) or value['id'] in routine_ids: invalid('Invalid or duplicate custom routine.')
        routine_ids.add(value['id']);number(value.get('warmup'),1,600,'Warm-up',integer=True);number(value.get('cooldown'),1,600,'Cool-down',integer=True)
        moves=value.get('movements')
        if not isinstance(moves,list) or not 1<=len(moves)<=30: invalid('Custom routines need 1–30 movements.')
        total=value['warmup']+value['cooldown'];steps=2
        for move in moves:
            record(move,{'exercise','work','rest','rounds'},'Custom movement')
            if move.get('exercise') not in EXERCISES: invalid('Unknown custom exercise.')
            number(move.get('work'),5,180,'Work interval',integer=True);number(move.get('rest'),0,180,'Rest interval',integer=True);number(move.get('rounds'),1,5,'Rounds',integer=True)
            total+=(move['work']+move['rest'])*move['rounds']
            steps+=move['rounds']*(2 if move['rest'] else 1)
        if total>3600 or steps>500: invalid('Custom routine exceeds its supported duration or interval count.')
    program=state.get('activeProgram')
    if program is not None:
        record(program,{'id','instanceId','startDate','durationWeeks','routineId'},'Program');identifier(program.get('id'));identifier(program.get('instanceId'));day(program.get('startDate'));number(program.get('durationWeeks'),1,104,'Program length',integer=True)
        if 'routineId' in program: identifier(program['routineId'])
    settings=state.get('settings',{})
    record(settings,{'voice','energy','reminders','pelvic'},'Settings')
    if 'voice' in settings and type(settings['voice']) is not bool: invalid('Invalid voice setting.')
    pelvic=settings.get('pelvic',{})
    record(pelvic,{'guide','experience','comfortableHold','week','quickReps','adviceAccepted'},'Pelvic practice preferences')
    guide=pelvic.get('guide','general')
    experience=pelvic.get('experience','new')
    if not isinstance(guide,str) or guide not in {'general','men','women'}: invalid('Invalid pelvic practice guide.')
    if not isinstance(experience,str) or experience not in {'new','practiced'}: invalid('Invalid pelvic practice experience.')
    if 'comfortableHold' in pelvic: number(pelvic['comfortableHold'],1,10,'Comfortable pelvic hold',integer=True)
    if 'week' in pelvic: number(pelvic['week'],1,12,'Pelvic practice week',integer=True)
    for field in ['quickReps','adviceAccepted']:
        if field in pelvic and type(pelvic[field]) is not bool: invalid('Invalid pelvic practice preference.')
    energy=settings.get('energy',{})
    record(energy,{'enabled','age','weight','intensity'},'Energy settings')
    if type(energy.get('enabled',False)) is not bool or energy.get('intensity','light') not in {'light','moderate','vigorous'}: invalid('Invalid energy settings.')
    if 'age' in energy: number(energy['age'],19,59,'Estimate age',integer=True,nullable=True)
    if 'weight' in energy: number(energy['weight'],30,400,'Estimate mass',nullable=True)
    if energy.get('enabled') and (teen or energy.get('age') is None or energy.get('weight') is None): invalid('Adult energy estimates require valid age and mass.')
    reminders=settings.get('reminders',{})
    record(reminders,{'enabled','time','days','lastNotified'},'Reminder settings')
    if 'enabled' in reminders and type(reminders['enabled']) is not bool: invalid('Invalid reminder preference.')
    if 'time' in reminders and not re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d',reminders['time'] or ''): invalid('Invalid reminder time.')
    if 'days' in reminders: choices(reminders['days'],set(range(7)),1,'Reminder days')
    if reminders.get('lastNotified'):
        if not isinstance(reminders['lastNotified'],str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d',reminders['lastNotified']): invalid('Invalid reminder occurrence.')
        day(reminders['lastNotified'][:10])
    if 'sound' in state and type(state['sound']) is not bool: invalid('Invalid sound preference.')
    # Return the complete original validated JSON; no collections/optional fields
    # are projected away from a user's own backup or cloud snapshot.
    return state
