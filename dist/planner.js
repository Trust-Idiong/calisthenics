import { EXERCISES } from './exercises.js';

// App-authored schedules use the source-linked movement library. Fitness outcomes
// remain observations: elapsed exercise time never turns into estimated repetitions.
export const GOALS = Object.freeze({
  conditioning: { id: 'conditioning', label: 'General fitness', title: 'General fitness', description: 'Build a balanced movement routine.', defaultUnit: 'minutes', units: ['minutes'], defaultTarget: 180 },
  strength: { id: 'strength', label: 'Strength', title: 'Strength', description: 'Practice controlled strength and record a comfortable repetition assessment.', defaultUnit: 'reps', units: ['reps'], defaultTarget: 10 },
  core: { id: 'core', label: 'Core control', title: 'Core control', description: 'Build trunk control and track a comfortable hold.', defaultUnit: 'seconds', units: ['seconds'], defaultTarget: 30 },
  cardio: { id: 'cardio', label: 'Cardio endurance', title: 'Cardio endurance', description: 'Build active minutes through sessions and walking.', defaultUnit: 'minutes', units: ['minutes'], defaultTarget: 120 },
  weight: { id: 'weight', label: 'Weight management', title: 'Weight management', description: 'Track optional measurements alongside a movement routine.', defaultUnit: 'kg', units: ['kg'], defaultTarget: null },
  mobility: { id: 'mobility', label: 'Comfortable movement', title: 'Comfortable movement', description: 'Practice easy movement and record comfortable mobility minutes.', defaultUnit: 'minutes', units: ['minutes'], defaultTarget: 10 },
  consistency: { id: 'consistency', label: 'Consistency', title: 'Consistency', description: 'Complete the workout days you planned.', defaultUnit: 'sessions', units: ['sessions'], defaultTarget: null },
  test: { id: 'test', label: 'Personal performance goal', title: 'Personal performance goal', description: 'Prepare for your own goal and record your own assessments.', defaultUnit: 'reps', units: ['reps', 'seconds', 'minutes'], defaultTarget: null },
  curves: { id: 'curves', label: 'Figure 8 / glutes & core', title: 'Figure 8 / glutes & core', description: 'Build glute and core strength. Comfortable glute repetitions track ability, not body shape. Exercise cannot spot-reduce belly fat or guarantee an hourglass figure; genetics and body composition affect appearance.', defaultUnit: 'reps', units: ['reps'], defaultTarget: null },
  abs: { id: 'abs', label: 'Six-pack & core strength', title: 'Six-pack & core strength', description: 'Train abdominal strength and control with gradual, comfortable practice. Record repetitions using the same core movement. Visible abs depend on body composition, genetics and other factors; core exercise cannot spot-reduce belly fat or promise a six-pack.', defaultUnit: 'reps', units: ['reps'], defaultTarget: null }
});

const MOVEMENTS = Object.keys(EXERCISES);
const FOCUS_AREAS = ['full', 'abs', 'chest', 'arms', 'core', 'back', 'glutes', 'legs'];
const RESTRICTIONS = ['no-floor', 'knee', 'wrist', 'shoulder', 'back'];
const EXCLUSIONS = {
  'no-floor': ['bridge', 'bird', 'deadbug', 'pushup', 'kneepushup', 'forearmplank', 'sideplank'],
  knee: ['chair', 'march', 'cool', 'bird', 'squat', 'kneepushup', 'reverselunge', 'calfraise', 'anklepump', 'seatedmarch', 'calfstretch', 'stepjack', 'jumpingjack'],
  wrist: ['wall', 'bird', 'pushup', 'kneepushup', 'calfstretch'],
  shoulder: ['wall', 'plank', 'bird', 'pushup', 'kneepushup', 'forearmplank', 'sideplank', 'calfstretch', 'stepjack', 'jumpingjack'],
  back: ['bridge', 'deadbug', 'squat', 'pushup', 'kneepushup', 'forearmplank', 'sideplank', 'reverselunge', 'jumpingjack']
};
const DAY_MS = 86400000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const roundOne = value => Math.round(value * 10) / 10;
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
const addDays = (date, amount) => new Date(Date.parse(date + 'T12:00:00Z') + amount * DAY_MS).toISOString().slice(0, 10);
const between = (start, end) => Math.round((Date.parse(end + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / DAY_MS);
const weekday = date => new Date(date + 'T12:00:00Z').getUTCDay();

function plannedDates(profile) {
  const result = [];
  const total = between(profile.startDate, profile.deadline);
  // The deadline is the end boundary: eight weeks contains exactly 56 days.
  for (let offset = 0; offset < total; offset++) {
    const date = addDays(profile.startDate, offset);
    if (profile.days.includes(weekday(date))) result.push({ date, week: Math.floor(offset / 7) + 1 });
  }
  return result;
}

/** Validate user choices without deriving ability, gender, or health from a name. */
export function validatePreferences(profile = {}, today = localDate()) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new Error('Your training preferences are invalid.');
  const p = { ...profile };
  p.goalType = p.goalType ?? 'conditioning';
  if (!Object.hasOwn(GOALS, p.goalType)) throw new Error('Choose a supported training goal.');
  const goal = GOALS[p.goalType];
  p.name = typeof p.name === 'string' ? p.name.trim() : '';
  if (p.name.length > 80) throw new Error('Keep your name under 80 characters.');
  p.experience = p.experience ?? 'beginner';
  if (!['beginner', 'intermediate', 'advanced'].includes(p.experience)) throw new Error('Choose a training experience level.');
  p.ageBand = p.ageBand ?? 'adult';
  if (!['teen', 'adult', 'older'].includes(p.ageBand)) throw new Error('Choose an age group.');
  const currentYear = new Date().getFullYear();
  if(p.birthYear!=null&&(!Number.isInteger(p.birthYear)||p.birthYear<currentYear-100||p.birthYear>currentYear-16))throw new Error('Choose a birth year for an age between 16 and 100, or leave it blank.');
  if(p.birthYear!=null&&currentYear-p.birthYear<18&&p.ageBand!=='teen')throw new Error('Use the teen age group for a birth year under 18.');
  if (['curves', 'abs'].includes(p.goalType) && p.ageBand === 'teen') throw new Error('Appearance-focused goals are for adults. Choose a strength, core or fitness goal for teens.');
  p.coaching = p.coaching ?? 'supportive';
  if (!['supportive', 'quiet'].includes(p.coaching)) throw new Error('Choose a coaching style.');
  p.lowImpact = p.lowImpact ?? true;
  if (typeof p.lowImpact !== 'boolean') throw new Error('The low-impact preference is invalid.');
  p.focusAreas = p.focusAreas === undefined ? ['full'] : p.focusAreas;
  if (!Array.isArray(p.focusAreas) || p.focusAreas.length < 1 || p.focusAreas.length > FOCUS_AREAS.length || p.focusAreas.some(area => !FOCUS_AREAS.includes(area)) || new Set(p.focusAreas).size !== p.focusAreas.length) throw new Error('Choose one or more different focus areas.');
  p.focusAreas = [...p.focusAreas];
  for (const [field, choices] of [['cardioComfort', ['out-of-breath', 'mild', 'easy']], ['flexibility', ['far', 'near', 'touch']]]) {
    p[field] = p[field] === undefined ? null : p[field];
    if (p[field] !== null && !choices.includes(p[field])) throw new Error(`Choose a supported ${field} answer, or skip it.`);
  }
  p.days = p.days ?? [1, 3, 5];
  if (!Array.isArray(p.days) || p.days.length < 1 || p.days.length > 7 || p.days.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(p.days).size !== p.days.length) throw new Error('Choose one to seven different training days.');
  p.days = [...p.days].sort((a, b) => a - b);
  p.sessionMinutes = p.sessionMinutes ?? 20;
  if (!Number.isInteger(p.sessionMinutes) || p.sessionMinutes < 10 || p.sessionMinutes > 60) throw new Error('Sessions can be between 10 and 60 minutes.');
  p.restrictions = p.restrictions ?? [];
  if (!Array.isArray(p.restrictions) || p.restrictions.some(r => !RESTRICTIONS.includes(r)) || new Set(p.restrictions).size !== p.restrictions.length) throw new Error('Check your movement preferences.');
  p.restrictions = [...p.restrictions];
  p.equipment = p.equipment ?? ['chair', 'wall'];
  if (typeof p.equipment === 'string') p.equipment = [p.equipment];
  if (!Array.isArray(p.equipment) || p.equipment.some(e => !['none', 'chair', 'wall'].includes(e)) || new Set(p.equipment).size !== p.equipment.length || (p.equipment.includes('none') && p.equipment.length !== 1)) throw new Error('Choose no equipment, a stable chair, a wall, or both.');
  p.equipment = p.equipment.length ? [...p.equipment] : ['none'];
  p.startDate = p.startDate ?? today;
  if (!validDate(p.startDate)) throw new Error('Choose a valid start date.');
  const suppliedDuration = p.durationWeeks;
  if (p.deadline === undefined || p.deadline === null || p.deadline === '') {
    p.durationWeeks = suppliedDuration ?? 8;
    if (!Number.isInteger(p.durationWeeks) || p.durationWeeks < 2 || p.durationWeeks > 52) throw new Error('Choose 2 to 52 weeks, or enter a custom goal date.');
    p.deadline = addDays(p.startDate, p.durationWeeks * 7);
  } else {
    if (!validDate(p.deadline)) throw new Error('Choose a valid goal date.');
    const days = between(p.startDate, p.deadline);
    if (days < 14) throw new Error('Allow at least two weeks for your training plan.');
    if (days > 3653) throw new Error('Choose a goal date within ten years.');
    p.durationWeeks = Math.ceil(days / 7);
  }
  p.baselineValue = p.baselineValue ?? 0;
  if (!Number.isFinite(p.baselineValue) || p.baselineValue < 0 || p.baselineValue > 100000) throw new Error('Use a valid, non-negative baseline.');
  p.targetUnit = p.targetUnit ?? goal.defaultUnit;
  if (!goal.units.includes(p.targetUnit)) throw new Error('Choose a measurement unit supported by your goal.');
  if (p.startWeight !== undefined && p.startWeight !== null && (!Number.isFinite(p.startWeight) || p.startWeight < 30 || p.startWeight > 400)) throw new Error('Starting weight must be between 30 and 400 kg.');
  if (p.heightCm !== undefined && p.heightCm !== null && (!Number.isFinite(p.heightCm) || p.heightCm < 100 || p.heightCm > 250)) throw new Error('Height must be between 100 and 250 cm.');
  if (p.targetValue === undefined) {
    if (p.goalType === 'weight' && Number.isFinite(p.startWeight) && Number.isFinite(p.goalLoss) && p.goalLoss > 0) p.targetValue = roundOne(p.startWeight - p.goalLoss);
    else if (p.goalType === 'consistency') p.targetValue = plannedDates(p).length;
    else p.targetValue = goal.defaultTarget;
  }
  if (p.targetValue !== null && (!Number.isFinite(p.targetValue) || p.targetValue <= 0 || p.targetValue > 100000)) throw new Error('Enter a positive target, or leave it blank.');
  if (['reps', 'sessions'].includes(p.targetUnit) && p.targetValue !== null && !Number.isInteger(p.targetValue)) throw new Error('Repetition and session targets must be whole numbers.');
  if (p.goalType === 'consistency' && p.targetValue !== null && p.targetValue > plannedDates(p).length) throw new Error('Your session target exceeds your planned training days. Add training days or extend your timeframe.');
  if (p.goalType === 'weight') {
    if (p.ageBand === 'teen') throw new Error('Choose a fitness or movement goal for teens. Weight-loss targets are available to adults.');
    if (p.targetValue !== null) {
      if (p.targetValue < 30 || p.targetValue > 400) throw new Error('Target weight must be between 30 and 400 kg.');
      if (Number.isFinite(p.heightCm) && p.targetValue / ((p.heightCm / 100) ** 2) < 18.5) throw new Error('This target is below the adult healthy-weight screening range. Choose a different target or discuss it with a qualified professional.');
      if (Number.isFinite(p.startWeight) && (p.startWeight - p.targetValue) / (between(p.startDate, p.deadline) / 7) > 1) throw new Error('This target asks for more than 1 kg of weight loss per week. Choose a smaller change or a longer timeframe.');
    }
  }
  return p;
}

function eligibleMovements(profile) {
  const excluded = new Set(profile.restrictions.flatMap(r => EXCLUSIONS[r]));
  if (!profile.equipment.includes('chair')) excluded.add('chair');
  if (!profile.equipment.includes('wall')) { excluded.add('wall'); excluded.add('plank'); }
  const level = profile.ageBand === 'adult' ? profile.experience : 'beginner';
  const levels = { beginner: ['gentle'], intermediate: ['gentle', 'intermediate'], advanced: ['gentle', 'intermediate', 'advanced'] }[level];
  return MOVEMENTS.filter(id => {
    const exercise = EXERCISES[id];
    if ((exercise.avoid ?? []).some(restriction => profile.restrictions.includes(restriction))) return false;
    if (excluded.has(id) || (profile.restrictions.includes('no-floor') && exercise.floor)) return false;
    if ((exercise.equipment ?? []).some(item => !profile.equipment.includes(item))) return false;
    if (!levels.includes(exercise.level ?? 'gentle')) return false;
    if (exercise.impact === 'higher' && (profile.lowImpact || profile.ageBand !== 'adult' || profile.experience !== 'advanced')) return false;
    return true;
  });
}

function allowedMovements(profile) {
  const result = eligibleMovements(profile);
  if (result.length === 0) throw new Error('No movements in the current library match these preferences. Change your movement choices only if comfortable, or use guidance from a qualified professional.');
  return result;
}

export function exerciseAllowed(profile, exerciseId) {
  return eligibleMovements(validatePreferences(profile)).includes(exerciseId);
}

/** Include preparation and recovery steps when checking an original quick session. */
export function sessionAllowed(profile, steps) {
  const allowed = new Set(eligibleMovements(validatePreferences(profile)));
  return Array.isArray(steps) && steps.length > 0 && steps.every(step => step && allowed.has(step.exercise));
}

function phaseFor(profile, week) {
  if (profile.goalType === 'test' && week === profile.durationWeeks) return 'Ease into your goal';
  if (week % 4 === 0) return 'Lighter week';
  if (week === 1) return 'Find your rhythm';
  const position = week / profile.durationWeeks;
  if (position <= 0.25) return 'Find your rhythm';
  if (position <= 0.6) return 'Build steadily';
  if (position <= 0.85) return 'Practice and progress';
  return 'Make it sustainable';
}

const priorities = {
  conditioning: ['chair', 'wall', 'march', 'bridge', 'plank', 'bird', 'deadbug'],
  strength: ['chair', 'wall', 'bridge', 'plank', 'bird', 'deadbug', 'march'],
  core: ['plank', 'bird', 'deadbug', 'bridge', 'wall', 'chair', 'march'],
  abs: ['deadbug', 'bird', 'plank', 'bridge', 'chair', 'wall', 'march'],
  cardio: ['march', 'chair', 'cool', 'wall', 'bridge', 'plank', 'bird'],
  weight: ['march', 'chair', 'wall', 'bridge', 'plank', 'bird', 'deadbug'],
  mobility: ['march', 'cool', 'chair', 'bridge', 'bird', 'wall', 'plank'],
  consistency: ['chair', 'wall', 'march', 'bridge', 'plank', 'bird', 'deadbug'],
  test: ['chair', 'wall', 'plank', 'march', 'bridge', 'bird', 'deadbug'],
  curves: ['bridge', 'deadbug', 'clamshell', 'sidehipraise', 'donkeykick', 'standinghipabduction', 'standinghipextension', 'chair', 'plank', 'bird']
};

const progressions = {
  intermediate: {
    conditioning: ['squat', 'kneepushup', 'stepjack', 'bridge', 'forearmplank', 'reverselunge'],
    strength: ['squat', 'kneepushup', 'reverselunge', 'forearmplank', 'bridge', 'calfraise'],
    core: ['forearmplank', 'deadbug', 'bird', 'bridge', 'kneepushup', 'plank'],
    abs: ['forearmplank', 'deadbug', 'crunch', 'bird', 'bridge', 'plank'],
    cardio: ['stepjack', 'march', 'squat', 'reverselunge', 'calfraise', 'seatedmarch'],
    weight: ['stepjack', 'squat', 'kneepushup', 'march', 'bridge', 'forearmplank'],
    consistency: ['squat', 'kneepushup', 'stepjack', 'bridge', 'forearmplank', 'reverselunge'],
    test: ['squat', 'kneepushup', 'forearmplank', 'reverselunge', 'bridge', 'march'],
    curves: ['bridge', 'squat', 'deadbug', 'reverselunge', 'sidehipraise', 'donkeykick', 'clamshell']
  },
  advanced: {
    conditioning: ['jumpingjack', 'pushup', 'squat', 'reverselunge', 'forearmplank', 'sideplank', 'stepjack'],
    strength: ['pushup', 'squat', 'reverselunge', 'sideplank', 'forearmplank', 'bridge'],
    core: ['sideplank', 'forearmplank', 'deadbug', 'bird', 'pushup', 'bridge'],
    abs: ['sideplank', 'forearmplank', 'deadbug', 'crunch', 'bird', 'bridge'],
    cardio: ['jumpingjack', 'stepjack', 'squat', 'march', 'reverselunge', 'calfraise'],
    weight: ['jumpingjack', 'squat', 'pushup', 'reverselunge', 'stepjack', 'forearmplank'],
    consistency: ['pushup', 'squat', 'reverselunge', 'stepjack', 'forearmplank', 'sideplank'],
    test: ['pushup', 'squat', 'forearmplank', 'reverselunge', 'sideplank', 'march'],
    curves: ['squat', 'reverselunge', 'bridge', 'sidehipraise', 'sideplank', 'donkeykick', 'deadbug', 'clamshell']
  }
};
const easyMovements = ['march', 'cool', 'anklepump', 'seatedmarch', 'calfstretch', 'calfraise', 'wall', 'chair', 'plank', 'bridge', 'deadbug', 'bird'];
const mobilityMovements = ['anklepump', 'shoulderroll', 'sidebend', 'cheststretch', 'calfstretch', 'hamstringstretch', 'glutestretch', 'quadstretch'];
const comfortableRangeMovements = ['anklepump', 'shoulderroll', 'sidebend', 'cheststretch'];

function priorityFor(profile, recovery) {
  if (recovery || profile.goalType === 'mobility') return ['anklepump', 'calfstretch', 'seatedmarch', 'march', 'cool', 'calfraise', 'wall', 'bridge'];
  const level = profile.ageBand === 'adult' ? profile.experience : 'beginner';
  return [...new Set([...(progressions[level]?.[profile.goalType] ?? []), ...priorities[profile.goalType], ...easyMovements])];
}

function selectionFor(profile, candidates, allowed, week, recovery) {
  const count = profile.experience === 'beginner' ? 4 : 6;
  // Full-body is the compatibility default. A focus is a preference within the
  // permitted library, rather than an exclusion or a body-shape prediction.
  const focus = profile.focusAreas.filter(area => area !== 'full');
  if (!focus.length) return { selected: candidates.slice(0, count), reason: '' };
  const additional = recovery ? mobilityMovements : MOVEMENTS.filter(id => !mobilityMovements.includes(id) && id !== 'cool');
  const pool = [...new Set([...candidates, ...additional])].filter(id => allowed.includes(id));
  const focused = pool.filter(id => EXERCISES[id].bodyAreas?.some(area => focus.includes(area)));
  if (!focused.length) return { selected: candidates.slice(0, count), reason: 'Your selected focus areas have no eligible movements here, so the session keeps the available movements for your main goal.' };
  const offset = (week - 1) % focused.length;
  const rotation = [...focused.slice(offset), ...focused.slice(0, offset)];
  const preferred = [];
  const quota = Math.min(Math.floor(count / 2), focused.length);
  const areaOffset = (week - 1) % focus.length;
  const orderedAreas = [...focus.slice(areaOffset), ...focus.slice(0, areaOffset)];
  for (const area of orderedAreas) {
    const movement = rotation.find(id => !preferred.includes(id) && EXERCISES[id].bodyAreas?.includes(area));
    if (movement) preferred.push(movement);
    if (preferred.length >= quota) break;
  }
  for (const movement of rotation) {
    if (preferred.length >= quota) break;
    if (!preferred.includes(movement)) preferred.push(movement);
  }
  const anchors = candidates.length ? [candidates[0]] : [];
  const requiredAreas = profile.goalType === 'curves' ? ['glutes', 'core'] : ['core', 'abs'].includes(profile.goalType) ? ['core'] : [];
  for (const area of requiredAreas) {
    if (!anchors.some(id => EXERCISES[id].bodyAreas?.includes(area))) {
      const movement = candidates.find(id => EXERCISES[id].bodyAreas?.includes(area));
      if (movement) anchors.push(movement);
    }
  }
  if (profile.goalType === 'curves' && anchors.filter(id => EXERCISES[id].bodyAreas?.includes('glutes')).length < 2) {
    const movement = candidates.find(id => !anchors.includes(id) && EXERCISES[id].bodyAreas?.includes('glutes'));
    if (movement) anchors.push(movement);
  }
  return { selected: [...new Set([...anchors, ...preferred, ...candidates])].slice(0, count), reason: 'Movement variety reflects your selected focus areas while retaining the main training goal. Preferred choices rotate as the weeks progress.' };
}

/** A complete timed session. Recovery is optional; legacy workouts are untouched. */
export function recommendedSession(profile, week = 1, options = {}) {
  const p = validatePreferences(profile);
  if (!Number.isInteger(week) || week < 1 || week > p.durationWeeks) throw new Error('Choose a week inside your plan.');
  const allowed = allowedMovements(p);
  const recovery = options.recovery === true || p.goalType === 'mobility';
  const gentle = easyMovements.find(id => allowed.includes(id)) ?? allowed[0];
  const warmExercise = allowed.includes('march') ? 'march' : gentle;
  const mobilityChoices = comfortableRangeMovements.filter(id => allowed.includes(id));
  const supportedRange = p.flexibility === 'far' ? (mobilityChoices.find(id => EXERCISES[id].bodyAreas?.some(area => area !== 'full' && p.focusAreas.includes(area))) ?? mobilityChoices[0]) : undefined;
  const coolExercise = supportedRange ?? (allowed.includes('cool') ? 'cool' : gentle);
  const candidates = priorityFor(p, recovery).filter(id => allowed.includes(id));
  if (p.goalType === 'curves' && !recovery && !candidates.some(id => EXERCISES[id].bodyAreas?.includes('glutes'))) throw new Error('No glute-strength movements match these preferences. Choose an available strength or mobility goal, or review your equipment and movement choices.');
  if (p.goalType === 'abs' && !recovery && !candidates.some(id => EXERCISES[id].bodyAreas?.includes('core'))) throw new Error('No core-strength movements match these preferences. Review your equipment and movement choices, or choose a comfortable movement goal.');
  // When knee preferences remove walking, use a permitted movement with short,
  // gentle efforts and long breaks. Excluded exercises never become fallbacks.
  const selection = selectionFor(p, candidates.length ? candidates : [gentle], allowed, week, recovery);
  const selected = selection.selected;
  const isLighter = week % 4 === 0 || (p.goalType === 'test' && week === p.durationWeeks);
  const baseWork = { beginner: 25, intermediate: 35, advanced: 40 }[p.experience];
  const cap = p.ageBand === 'adult' ? 50 : 30;
  let work = Math.min(cap, baseWork + Math.floor((week - 1) / 2) * 2);
  let rest = Math.max(20, 60 - work);
  if (p.ageBand === 'older') rest = Math.max(rest, 40);
  if (p.ageBand === 'teen') rest = Math.max(rest, 35);
  if (p.goalType === 'curves') rest = Math.max(rest, 45);
  if (p.goalType === 'abs') rest = Math.max(rest, 40);
  const breathingSupport = p.cardioComfort === 'out-of-breath';
  if (breathingSupport) { work = Math.min(work, 25); rest = Math.max(rest, 45); }
  if (isLighter) { work = Math.max(15, work - 10); rest += 10; }
  if (recovery) { work = 20; rest = p.ageBand === 'older' ? 45 : 40; }
  if (breathingSupport) rest = Math.max(rest, 45);
  const total = p.sessionMinutes * 60;
  const warm = Math.round(clamp(total * 0.2, 120, 360));
  const cool = Math.round(clamp(total * 0.15, 120, 300));
  let budget = total - warm - cool;
  const steps = [{ type: 'warmup', exercise: warmExercise, duration: warm, label: p.coaching === 'quiet' ? 'Warm up' : 'Warm up gently; take breaks as needed', round: 0 }];
  let index = 0;
  while (budget >= work + rest) {
    const exercise = selected[index % selected.length];
    const round = Math.floor(index / selected.length) + 1;
    if (EXERCISES[exercise].bilateral) {
      // Both sides fit inside one work allocation, with a transition from its rest
      // allocation. A short session cannot accidentally train only one side.
      steps.push({ type: 'work', exercise, duration: Math.floor(work / 2), round, label: `${EXERCISES[exercise].name} · left side` });
      steps.push({ type: 'rest', exercise, duration: 5, round, label: 'Lower gently and change sides' });
      steps.push({ type: 'work', exercise, duration: Math.ceil(work / 2), round, label: `${EXERCISES[exercise].name} · right side` });
      steps.push({ type: 'rest', exercise, duration: rest - 5, round, label: p.coaching === 'quiet' ? 'Rest' : 'Rest; breathe normally' });
    } else {
      steps.push({ type: 'work', exercise, duration: work, round, ...(recovery ? { label: 'Easy, comfortable movement' } : {}) });
      steps.push({ type: 'rest', exercise, duration: rest, round, label: p.coaching === 'quiet' ? 'Rest' : 'Rest; breathe normally' });
    }
    budget -= work + rest;
    index++;
  }
  // Unused seconds extend the cool-down rather than creating a rushed final set.
  steps.push({ type: 'cooldown', exercise: coolExercise, duration: cool + budget, label: p.coaching === 'quiet' ? 'Cool down' : 'Slow down; let your breathing settle', round: 0 });
  const title = recovery ? 'Easy movement & recovery' : `${GOALS[p.goalType].label} · week ${week}`;
  const description = recovery ? 'Keep every effort easy. Pause whenever you need; this supports recovery and is not rehabilitation.' : 'Use controlled movement and stop before form slips. Timed windows allow breaks; they are not continuous hold requirements.';
  const curvesGuidance = p.goalType === 'curves' ? ' Build repetitions or a set gradually when current work is comfortable and you are recovered. Record actual repetitions yourself; the timer does not count reps or muscle-building sets. Bodyweight practice is a starting point; further muscle growth may need progressively greater resistance. Belly fat cannot be spot-reduced and an hourglass shape is not guaranteed.' : p.goalType === 'abs' ? ' Choose manageable core efforts and stop before form slips. Reduce or pause the work when needed; progress only while comfortable and recovered. Record actual core repetitions yourself using the same movement and method. The timer does not measure abdominal strength. Visible abs depend on several factors; this plan does not promise a six-pack or selective belly-fat loss.' : '';
  const adaptations = [selection.reason, breathingSupport ? 'Shorter efforts and longer breaks reflect your chosen cardio comfort; use a pace that feels comfortable.' : '', supportedRange ? 'Your cool-down includes easy mobility in a comfortable range. No toe-touch depth is required.' : ''].filter(Boolean);
  return { id: 'personalized', title, minutes: p.sessionMinutes, steps, recovery, level: p.experience, phase: phaseFor(p, week), description: description + curvesGuidance + (adaptations.length ? ' ' + adaptations.join(' ') : ''), ...(adaptations.length ? { adaptationReason: adaptations.join(' ') } : {}) };
}

function feasibilityFor(p) {
  const weeks = between(p.startDate, p.deadline) / 7;
  const availableMinutes = p.days.length * p.sessionMinutes;
  if (p.targetValue === null) return { status: 'flexible', label: 'Flexible goal', message: 'Build the routine at your own pace. You can add a measurable target later.', blocked: false };
  if (['conditioning', 'cardio'].includes(p.goalType) && p.targetValue > availableMinutes) return { status: 'ambitious', label: 'Extra activity needed', message: `Your sessions provide up to ${availableMinutes} minutes per week. Add comfortable walks or adjust your weekly minute target. Recovery and pauses can lower actual active time.`, blocked: false };
  if (['strength', 'core', 'test', 'mobility', 'curves', 'abs'].includes(p.goalType) && weeks <= 4 && (p.baselineValue === 0 || Math.abs(p.targetValue - p.baselineValue) > p.baselineValue * 0.5)) return { status: 'ambitious', label: 'Ambitious timeframe', message: 'This short timeframe may be ambitious. Assess comfortable progress and adjust the date or target; results are not guaranteed.', blocked: false };
  return { status: 'steady', label: 'Review as you go', message: 'The schedule builds practice gradually. Use your own logged progress to decide when to adjust it.', blocked: false };
}

/** Date-based plan with recovery spacing, regular lighter weeks, and a goal taper. */
export function buildPlan(profile, today = localDate()) {
  if (!validDate(today)) throw new Error('Choose a valid date for the plan.');
  const p = validatePreferences(profile, today);
  allowedMovements(p);
  let lastDemanding = null;
  const demandingByWeek = new Map();
  const maxDemanding = p.experience === 'advanced' && p.ageBand === 'adult' ? 4 : 3;
  const sessions = plannedDates(p).map(({ date, week }) => {
    const count = demandingByWeek.get(week) ?? 0;
    const recovery = p.goalType === 'mobility' || (lastDemanding !== null && between(lastDemanding, date) < 2) || count >= maxDemanding;
    if (!recovery) { lastDemanding = date; demandingByWeek.set(week, count + 1); }
    const session = recommendedSession(p, week, { recovery });
    return { date, week, phase: phaseFor(p, week), title: session.title, sessionId: 'personalized', recovery, minutes: session.minutes, session, past: date < today };
  });
  const phaseNames = [...new Set(Array.from({ length: p.durationWeeks }, (_, i) => phaseFor(p, i + 1)))];
  return {
    weeks: p.durationWeeks,
    totalDays: between(p.startDate, p.deadline),
    phaseNames,
    sessions,
    explanation: `${GOALS[p.goalType].label} across ${p.durationWeeks} weeks, with ${p.days.length} chosen day${p.days.length === 1 ? '' : 's'} per week and ${p.sessionMinutes}-minute sessions. Closely spaced days become easy recovery sessions. Every fourth week is lighter.${p.goalType === 'test' ? ' The final week eases the workload; assessments are optional and never require maximal effort.' : ''} Movement choices reflect your experience, equipment and preferences. Older-adult and teen plans keep gentle pacing. Technique sources are linked; the app's scheduling rules await professional review.`,
    feasibility: feasibilityFor(p)
  };
}

/** Progress has an explicit source and never claims unmeasured strength gains. */
export function goalProgress(state, today = localDate()) {
  if (!state || !state.profile || !validDate(today)) throw new Error('Progress needs a profile and a valid date.');
  const p = validatePreferences(state.profile, today);
  let current = null;
  let baseline = p.baselineValue;
  let source = 'manual assessment';
  let label = GOALS[p.goalType].label;
  let assessed = false;
  let message = 'Record a comfortable assessment to track this goal. Timed workouts do not estimate repetitions or hold ability.';
  if (['conditioning', 'cardio'].includes(p.goalType)) {
    const monday = addDays(today, -((weekday(today) + 6) % 7));
    const inWeek = item => item && item.date >= monday && item.date <= today;
    const workoutMinutes = (state.workouts ?? []).filter(inWeek).reduce((sum, item) => sum + (Number.isFinite(item.seconds) ? Math.max(0, item.seconds) / 60 : 0), 0);
    const walkingMinutes = (state.walks ?? []).filter(inWeek).reduce((sum, item) => sum + (Number.isFinite(item.minutes) ? Math.max(0, item.minutes) : 0), 0);
    current = roundOne(workoutMinutes + walkingMinutes);
    baseline = 0;
    assessed = true;
    source = 'actual logged session and walking minutes this week';
    label = 'Active minutes this week';
    message = 'Logged session time includes warm-up, rest and cool-down; walking uses the minutes you enter. This weekly total resets on Monday.';
  } else if (p.goalType === 'consistency') {
    const scheduled = new Set(plannedDates(p).map(item => item.date));
    const completed = new Set((state.workouts ?? []).filter(item => item && item.routineId !== 'pelvic-floor' && scheduled.has(item.date) && item.date <= today && item.seconds > 0 && item.skipped === 0).map(item => item.date));
    current = completed.size;
    baseline = 0;
    assessed = true;
    source = 'completed unique planned workout days';
    label = 'Planned workout days completed';
    message = 'One full workout counts per planned date. Partial workouts and unscheduled days remain in your history but do not count toward this target.';
  } else if (p.goalType === 'weight') {
    const readings = (state.weights ?? []).filter(item => item && validDate(item.date) && item.date <= today && Number.isFinite(item.weight)).sort((a, b) => a.date.localeCompare(b.date));
    baseline = Number.isFinite(p.startWeight) ? p.startWeight : null;
    current = readings.at(-1)?.weight ?? baseline;
    assessed = current !== null;
    source = readings.length ? 'latest logged weight' : 'starting weight';
    label = 'Weight measurement';
    message = assessed ? 'Measurements show your recorded trend; exercise does not guarantee a weight change.' : 'Add a starting weight or a measurement when you want to track weight.';
  } else {
    const readings = (state.assessments ?? []).filter(item => item && validDate(item.date) && item.date <= today && Number.isFinite(item.value) && item.value >= 0 && (!item.goalType || item.goalType === p.goalType) && (!item.unit || item.unit === p.targetUnit)).sort((a, b) => a.date.localeCompare(b.date));
    if (readings.length) { current = readings.at(-1).value; assessed = true; message = 'Your latest manual assessment is shown. Use the same comfortable assessment each time; maximal effort is optional and is never required.'; }
    if (p.goalType === 'curves') { label = 'Comfortable glute reps'; source = 'Manual strength proxy, not body shape'; message = 'Use the same comfortable glute exercise and assessment method each time. These repetitions track movement ability; they do not measure hip growth, a flatter tummy or an hourglass shape. Appearance outcomes vary and belly fat cannot be spot-reduced.'; }
    if (p.goalType === 'abs') { label = 'Comfortable core reps'; source = 'Manual core assessment'; message = 'Use the same comfortable core movement and method each time. Logged practice time never becomes a repetition result or a six-pack score. Visible abs and body-composition changes vary between people.'; }
  }
  const target = p.targetValue;
  const hasTarget = target !== null;
  let percent = null;
  if (hasTarget && current !== null && baseline !== null) {
    const range = target - baseline;
    percent = range === 0 ? (current === target ? 100 : 0) : roundOne(clamp((current - baseline) / range * 100, 0, 100));
  }
  return { goalType: p.goalType, label, current, target, baseline, unit: p.targetUnit, percent, hasTarget, assessed, source, message };
}
