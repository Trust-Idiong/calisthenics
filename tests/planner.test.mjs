import test from 'node:test';
import assert from 'node:assert/strict';
import { GOALS, validatePreferences, buildPlan, recommendedSession, goalProgress, exerciseAllowed, sessionAllowed } from '../dist/planner.js';
import { EXERCISES } from '../dist/exercises.js';
import { sequenceFor, validateSessionDescriptor } from '../dist/engine.js';

const profile = changes => ({ startDate: '2026-10-12', durationWeeks: 8, ...changes });

test('inclusive defaults are general fitness with freely chosen dates, days, and a nullable target', () => {
  const p = validatePreferences(profile());
  assert.equal(p.goalType, 'conditioning');
  assert.equal(p.deadline, '2026-12-07');
  assert.equal(p.durationWeeks, 8);
  assert.equal(p.targetValue, 180);
  assert.deepEqual(p.days, [1, 3, 5]);
  assert.equal(p.startWeight, undefined);
  assert.equal(validatePreferences(profile({ targetValue: null })).targetValue, null);
  assert.deepEqual(Object.keys(GOALS), ['conditioning', 'strength', 'core', 'cardio', 'weight', 'mobility', 'consistency', 'test', 'curves']);
});

test('preset and custom horizons are calendar based rather than seven fixed months', () => {
  for (const weeks of [2, 4, 8, 12, 16, 24, 52]) {
    const plan = buildPlan(profile({ durationWeeks: weeks }), '2026-10-12');
    assert.equal(plan.weeks, weeks);
    assert.equal(plan.totalDays, weeks * 7);
    assert.equal(plan.sessions.length, weeks * 3);
    assert.ok(plan.phaseNames.every(name => !/month|seven|military/i.test(name)));
  }
  const custom = buildPlan(profile({ deadline: '2027-01-14' }), '2026-10-12');
  assert.equal(custom.totalDays, 94);
  assert.equal(custom.weeks, 14);
  assert.ok(custom.sessions.every(session => session.date >= '2026-10-12' && session.date < '2027-01-14'));
});

test('every supported goal and session length produces exact durations and known exercises', () => {
  for (const goalType of Object.keys(GOALS)) for (const sessionMinutes of [10, 11, 20, 35, 60]) {
    const p = profile({ goalType, sessionMinutes, ...(goalType === 'weight' ? { startWeight: 80, targetValue: 78 } : {}) });
    const session = recommendedSession(p, 1);
    assert.equal(session.id, 'personalized');
    assert.equal(session.minutes, sessionMinutes);
    assert.equal(session.steps.reduce((sum, step) => sum + step.duration, 0), sessionMinutes * 60);
    assert.equal(session.steps[0].type, 'warmup');
    assert.equal(session.steps.at(-1).type, 'cooldown');
    assert.ok(session.steps.some(step => step.type === 'work'));
    for (const step of session.steps) {
      assert.ok(Object.hasOwn(EXERCISES, step.exercise));
      assert.ok(Number.isInteger(step.duration) && step.duration > 0);
      assert.ok(Number.isInteger(step.round) && step.round >= 0);
    }
  }
});

test('movement and equipment exclusions apply to warm-up, work, rest, and cool-down', () => {
  const noFloor = recommendedSession(profile({ goalType: 'core', restrictions: ['no-floor'], equipment: ['wall'] }));
  assert.ok(noFloor.steps.every(step => !['chair', 'bridge', 'bird', 'deadbug'].includes(step.exercise)));
  const noEquipment = recommendedSession(profile({ equipment: ['none'], restrictions: ['no-floor'] }));
  assert.ok(noEquipment.steps.every(step => ['march', 'cool'].includes(step.exercise)));
  const knee = recommendedSession(profile({ restrictions: ['knee'] }));
  assert.ok(knee.steps.every(step => !['chair', 'march', 'cool', 'bird'].includes(step.exercise)));
  const wrists = recommendedSession(profile({ restrictions: ['wrist'] }));
  assert.ok(wrists.steps.every(step => !['wall', 'bird'].includes(step.exercise)));
  const shoulder = recommendedSession(profile({ restrictions: ['shoulder'] }));
  assert.ok(shoulder.steps.every(step => !['wall', 'plank', 'bird'].includes(step.exercise)));
  const back = recommendedSession(profile({ restrictions: ['back'] }));
  assert.ok(back.steps.every(step => !['bridge', 'deadbug'].includes(step.exercise)));
  assert.throws(() => recommendedSession(profile({ restrictions: ['no-floor', 'knee', 'wrist', 'shoulder', 'back'], equipment: ['none'] })), /No movements.*match/);
});

test('original quick workouts use the same preference checks as personalized sessions', () => {
  assert.equal(sessionAllowed(profile(), sequenceFor('foundation')), true);
  assert.equal(sessionAllowed(profile({ equipment: ['none'] }), sequenceFor('foundation')), false);
  assert.equal(sessionAllowed(profile({ restrictions: ['no-floor'] }), sequenceFor('core')), false);
  assert.equal(sessionAllowed(profile({ restrictions: ['knee'] }), sequenceFor('core')), false);
  assert.equal(exerciseAllowed(profile({ restrictions: ['wrist'] }), 'wall'), false);
  assert.equal(exerciseAllowed(profile({ restrictions: ['no-floor'] }), 'plank'), true);
  const allExcluded = profile({ restrictions: ['no-floor', 'knee'], equipment: ['none'] });
  assert.equal(exerciseAllowed(allExcluded, 'march'), false);
  assert.equal(sessionAllowed(allExcluded, sequenceFor('foundation')), false);
  assert.equal(sessionAllowed(profile(), []), false);
});

test('closely spaced training days have easy sessions between demanding sessions', () => {
  const plan = buildPlan(profile({ days: [0, 1, 2, 3, 4, 5, 6] }), '2026-10-12');
  const demanding = plan.sessions.filter(session => !session.recovery);
  assert.ok(plan.sessions.some(session => session.recovery));
  for (let i = 1; i < demanding.length; i++) assert.ok(Date.parse(demanding[i].date) - Date.parse(demanding[i - 1].date) >= 2 * 86400000);
  for (let week = 1; week <= plan.weeks; week++) assert.ok(demanding.filter(session => session.week === week).length <= 3);
  assert.ok(plan.sessions.filter(session => session.recovery).every(session => session.session.recovery));
});

test('age and experience change pacing without changing workouts based on gender', () => {
  const novice = recommendedSession(profile({ experience: 'beginner' }), 3);
  const advanced = recommendedSession(profile({ experience: 'advanced' }), 3);
  assert.ok(novice.steps.find(step => step.type === 'work').duration < advanced.steps.find(step => step.type === 'work').duration);
  const older = recommendedSession(profile({ ageBand: 'older', experience: 'advanced' }), 7);
  assert.ok(older.steps.filter(step => step.type === 'work').every(step => step.duration <= 30));
  assert.ok(older.steps.filter(step => step.type === 'rest').every(step => step.duration >= 40));
  const teen = recommendedSession(profile({ ageBand: 'teen', experience: 'advanced' }), 7);
  assert.ok(teen.steps.filter(step => step.type === 'work').every(step => step.duration <= 30));
  assert.deepEqual(recommendedSession(profile({ gender: 'female' })).steps, recommendedSession(profile({ gender: 'male' })).steps);
});

test('source-linked written guides add real variety while preserving all original demonstration videos', () => {
  assert.equal(Object.keys(EXERCISES).length, 37);
  const videoIds = Object.values(EXERCISES).filter(exercise => exercise.video && !exercise.catalogAddition).map(exercise => exercise.id);
  assert.deepEqual(videoIds, ['chair', 'wall', 'march', 'bridge', 'bird', 'plank', 'deadbug', 'cool']);
  const guides = Object.values(EXERCISES).filter(exercise => !exercise.video);
  assert.equal(guides.length, 27);
  for (const guide of guides) {
    assert.equal(guide.video, null);
    assert.equal(guide.provider, 'Written technique guide');
    const hostname = new URL(guide.source).hostname;
    assert.ok(['nasm.org','nhs.uk','acefitness.org','eacefitness.com'].some(domain => hostname === domain || hostname.endsWith('.' + domain)));
    assert.ok(guide.description.length > 80 && guide.cues.length === 3);
    assert.ok(['gentle', 'intermediate', 'advanced'].includes(guide.level));
  }
});

test('intermediate and advanced no-equipment plans choose harder movements rather than just longer timers', () => {
  const p = profile({ goalType: 'strength', equipment: ['none'] });
  const work = options => new Set(recommendedSession({ ...p, ...options }).steps.filter(step => step.type === 'work').map(step => step.exercise));
  const gentle = work({ experience: 'beginner' });
  const intermediate = work({ experience: 'intermediate' });
  const advanced = work({ experience: 'advanced' });
  assert.ok(!gentle.has('pushup') && !gentle.has('kneepushup') && !gentle.has('squat'));
  for (const id of ['squat', 'kneepushup', 'reverselunge', 'forearmplank']) assert.ok(intermediate.has(id), id);
  for (const id of ['pushup', 'squat', 'reverselunge', 'sideplank', 'forearmplank']) assert.ok(advanced.has(id), id);
  const standing = recommendedSession({ ...p, experience: 'advanced', restrictions: ['no-floor'] });
  assert.ok(standing.steps.every(step => !EXERCISES[step.exercise].floor && !['bridge', 'bird', 'deadbug'].includes(step.exercise)));
  assert.ok(standing.steps.some(step => step.exercise === 'squat'));
  assert.ok(standing.steps.some(step => step.exercise === 'reverselunge'));
});

test('higher-impact choices require an experienced adult opting out of low-impact sessions', () => {
  const p = profile({ goalType: 'cardio', experience: 'advanced', equipment: ['none'] });
  assert.ok(!recommendedSession(p).steps.some(step => step.exercise === 'jumpingjack'));
  assert.ok(recommendedSession({ ...p, lowImpact: false }).steps.some(step => step.exercise === 'jumpingjack'));
  for (const ageBand of ['teen', 'older']) {
    const session = recommendedSession({ ...p, ageBand, lowImpact: false });
    assert.ok(session.steps.every(step => !EXERCISES[step.exercise].level || EXERCISES[step.exercise].level === 'gentle'));
    assert.ok(!session.steps.some(step => step.exercise === 'jumpingjack'));
  }
  assert.equal(exerciseAllowed({ ...p, lowImpact: false, restrictions: ['knee'] }, 'jumpingjack'), false);
  assert.equal(exerciseAllowed({ ...p, lowImpact: false, restrictions: ['shoulder'] }, 'jumpingjack'), false);
});

test('side-plank windows include both sides even in the shortest advanced core session', () => {
  const session = recommendedSession(profile({ goalType: 'core', experience: 'advanced', sessionMinutes: 10, equipment: ['none'] }));
  const sideSteps = session.steps.filter(step => step.type === 'work' && step.exercise === 'sideplank');
  assert.equal(sideSteps.length % 2, 0);
  assert.ok(sideSteps.length >= 2);
  for (let index = 0; index < sideSteps.length; index += 2) {
    assert.match(sideSteps[index].label, /left side/);
    assert.match(sideSteps[index + 1].label, /right side/);
  }
  assert.equal(session.steps.reduce((sum, step) => sum + step.duration, 0), 600);
});

test('new movements respect restriction and equipment combinations and validate against the actual timer engine', () => {
  const restrictions = ['no-floor', 'knee', 'wrist', 'shoulder', 'back'];
  const equipmentOptions = [['none'], ['chair'], ['wall'], ['chair', 'wall']];
  let built = 0;
  let blocked = 0;
  for (let mask = 0; mask < 32; mask++) for (const equipment of equipmentOptions) for (const experience of ['beginner', 'intermediate', 'advanced']) {
    const choices = profile({ goalType: 'conditioning', restrictions: restrictions.filter((_, bit) => mask & (1 << bit)), equipment, experience, lowImpact: false, sessionMinutes: mask % 2 ? 10 : 60 });
    let session;
    try { session = recommendedSession(choices, 3); } catch (error) { assert.match(error.message, /No movements.*match/); blocked++; continue; }
    const clean = validateSessionDescriptor(session);
    assert.equal(clean.steps.reduce((sum, step) => sum + step.duration, 0), choices.sessionMinutes * 60);
    for (const step of clean.steps) {
      if (choices.restrictions.includes('no-floor')) assert.ok(!EXERCISES[step.exercise].floor && !['bridge', 'bird', 'deadbug'].includes(step.exercise));
      assert.ok((EXERCISES[step.exercise].equipment ?? []).every(item => equipment.includes(item)));
      if (choices.restrictions.includes('wrist')) assert.ok(!['wall', 'bird', 'pushup', 'kneepushup', 'calfstretch'].includes(step.exercise));
      if (choices.restrictions.includes('shoulder')) assert.ok(!['wall', 'plank', 'bird', 'pushup', 'kneepushup', 'forearmplank', 'sideplank', 'calfstretch', 'stepjack', 'jumpingjack'].includes(step.exercise));
    }
    built++;
  }
  assert.ok(built > 100 && blocked > 0);
});

test('lighter weeks and final performance week reduce effort with no mandatory maximal assessment', () => {
  const normal = recommendedSession(profile({ experience: 'advanced' }), 3);
  const lighter = recommendedSession(profile({ experience: 'advanced' }), 4);
  assert.ok(lighter.steps.find(step => step.type === 'work').duration < normal.steps.find(step => step.type === 'work').duration);
  const plan = buildPlan(profile({ goalType: 'test', durationWeeks: 7, targetValue: 20 }), '2026-10-12');
  assert.ok(plan.sessions.filter(session => session.week === 7).every(session => session.phase === 'Ease into your goal'));
  assert.match(plan.explanation, /assessments are optional.*never require maximal effort/);
});

test('weight targets are optional and unsafe weight targets cannot create a plan', () => {
  assert.doesNotThrow(() => validatePreferences(profile({ goalType: 'weight', targetValue: null })));
  assert.doesNotThrow(() => validatePreferences(profile({ goalType: 'weight', startWeight: 80, targetValue: 78, ageBand: 'older' })));
  assert.throws(() => validatePreferences(profile({ goalType: 'weight', ageBand: 'teen' })), /fitness or movement goal for teens/);
  assert.throws(() => validatePreferences(profile({ goalType: 'weight', startWeight: 100, targetValue: 90, durationWeeks: 4 })), /more than 1 kg/);
  assert.throws(() => validatePreferences(profile({ goalType: 'weight', startWeight: 70, targetValue: 55, heightCm: 180, durationWeeks: 52 })), /healthy-weight screening range/);
  assert.throws(() => validatePreferences(profile({ goalType: 'weight', targetValue: 25 })), /30 and 400/);
  const legacy = validatePreferences({ goalType: 'weight', startDate: '2026-10-12', deadline: '2027-05-12', startWeight: 100, goalLoss: 10 });
  assert.equal(legacy.targetValue, 90);
});

test('short ambitious non-weight targets are labeled, without promising results or blocking practice', () => {
  const plan = buildPlan(profile({ goalType: 'strength', durationWeeks: 2, targetValue: 100, baselineValue: 2 }), '2026-10-12');
  assert.equal(plan.feasibility.status, 'ambitious');
  assert.equal(plan.feasibility.blocked, false);
  assert.match(plan.feasibility.message, /not guaranteed/);
  const minutes = buildPlan(profile({ targetValue: 300 }), '2026-10-12');
  assert.equal(minutes.feasibility.status, 'ambitious');
  assert.match(minutes.feasibility.message, /60 minutes per week/);
});

test('manual assessments, not workout intervals, determine strength and core outcome progress', () => {
  const state = { profile: profile({ goalType: 'strength', baselineValue: 2, targetValue: 10 }), workouts: [{ date: '2026-10-13', seconds: 1200, skipped: 0 }], assessments: [] };
  const unmeasured = goalProgress(state, '2026-10-14');
  assert.equal(unmeasured.current, null);
  assert.equal(unmeasured.percent, null);
  assert.equal(unmeasured.assessed, false);
  state.assessments = [
    { date: '2026-10-12', value: 4, goalType: 'strength', unit: 'reps' },
    { date: '2026-10-13', value: 6, goalType: 'strength', unit: 'reps' },
    { date: '2026-10-14', value: 99, goalType: 'core', unit: 'seconds' },
    { date: '2026-10-15', value: 10, goalType: 'strength', unit: 'reps' }
  ];
  const measured = goalProgress(state, '2026-10-14');
  assert.equal(measured.current, 6);
  assert.equal(measured.percent, 50);
  assert.equal(measured.source, 'manual assessment');
  const faster = goalProgress({ ...state, profile: profile({ goalType: 'test', targetUnit: 'seconds', baselineValue: 120, targetValue: 100 }), assessments: [{ date: '2026-10-13', value: 110 }] }, '2026-10-14');
  assert.equal(faster.percent, 50);
});

test('weekly conditioning and cardio minutes count actual time and reset on Monday', () => {
  const state = { profile: profile({ goalType: 'cardio', targetValue: 120 }), workouts: [
    { date: '2026-10-11', seconds: 3600 },
    { date: '2026-10-12', seconds: 900 },
    { date: '2026-10-13', seconds: 450, skipped: 1 },
    { date: '2026-10-15', seconds: 1200 }
  ], walks: [{ date: '2026-10-12', minutes: 20 }, { date: '2026-10-13', minutes: 10 }] };
  const result = goalProgress(state, '2026-10-14');
  assert.equal(result.current, 52.5);
  assert.equal(result.percent, 43.8);
  assert.match(result.source, /actual logged.*this week/);
  assert.equal(goalProgress(state, '2026-10-19').current, 0);
});

test('consistency uses distinct completed scheduled days and prevents an impossible schedule count', () => {
  const p = validatePreferences(profile({ goalType: 'consistency', durationWeeks: 2 }));
  assert.equal(p.targetValue, 6);
  assert.throws(() => validatePreferences(profile({ goalType: 'consistency', durationWeeks: 2, targetValue: 7 })), /exceeds your planned training days/);
  const result = goalProgress({ profile: p, workouts: [
    { date: '2026-10-12', seconds: 600, skipped: 0 },
    { date: '2026-10-12', seconds: 720, skipped: 0 },
    { date: '2026-10-13', seconds: 600, skipped: 0 },
    { date: '2026-10-14', seconds: 300, skipped: 1 },
    { date: '2026-10-16', seconds: 0, skipped: 0 },
    { date: '2026-10-19', seconds: 600, skipped: 0 }
  ] }, '2026-10-18');
  assert.equal(result.current, 1);
  assert.equal(result.percent, 16.7);
  assert.match(result.source, /unique planned workout days/);
});

test('weight progress uses actual measurements and keeps optional goals unscored', () => {
  const state = { profile: profile({ goalType: 'weight', startWeight: 80, targetValue: 76 }), weights: [{ date: '2026-10-13', weight: 79 }, { date: '2026-10-14', weight: 78 }, { date: '2026-10-20', weight: 76 }] };
  const result = goalProgress(state, '2026-10-15');
  assert.equal(result.current, 78);
  assert.equal(result.percent, 50);
  assert.equal(result.source, 'latest logged weight');
  const optional = goalProgress({ ...state, profile: { ...state.profile, targetValue: null } }, '2026-10-15');
  assert.equal(optional.hasTarget, false);
  assert.equal(optional.percent, null);
});

test('invalid preferences fail explicitly instead of silently changing the user plan', () => {
  const invalid = [
    { days: [] }, { days: [1, 1] }, { days: [7] }, { sessionMinutes: 9 }, { sessionMinutes: 61 },
    { durationWeeks: 1 }, { durationWeeks: 53 }, { deadline: '2026-02-30' }, { deadline: '2026-10-20' },
    { experience: 'elite' }, { ageBand: 'infant' }, { equipment: ['none', 'wall'] }, { restrictions: ['unknown'] },
    { targetValue: NaN }, { targetUnit: 'miles' }, { baselineValue: -1 }, { lowImpact: 'yes' }, { coaching: 'harsh' }
  ];
  for (const changes of invalid) assert.throws(() => validatePreferences(profile(changes)), JSON.stringify(changes));
});

test('Curves is an adult glute-strength goal with optional targets and no body-shape score', () => {
  const p = validatePreferences(profile({ goalType: 'curves' }));
  assert.equal(p.targetUnit, 'reps');
  assert.equal(p.targetValue, null);
  assert.match(GOALS.curves.description, /cannot spot-reduce.*guarantee/);
  assert.throws(() => validatePreferences(profile({ goalType: 'curves', ageBand: 'teen' })), /for adults.*strength, core or fitness/);
  assert.doesNotThrow(() => validatePreferences(profile({ goalType: 'strength', ageBand: 'teen' })));
  assert.doesNotThrow(() => validatePreferences(profile({ goalType: 'curves', ageBand: 'older' })));
  const state = { profile: profile({ goalType: 'curves', baselineValue: 5, targetValue: 15 }), workouts: [{ date: '2026-10-13', seconds: 1200, skipped: 0 }], assessments: [], weights: [{ date: '2026-10-13', weight: 70, waist: 80, hips: 100 }] };
  const unseen = goalProgress(state, '2026-10-14');
  assert.equal(unseen.current, null);
  assert.equal(unseen.percent, null);
  state.assessments.push({ date: '2026-10-13', goalType: 'curves', unit: 'reps', value: 10 });
  const observed = goalProgress(state, '2026-10-14');
  assert.equal(observed.label, 'Comfortable glute reps');
  assert.equal(observed.current, 10);
  assert.equal(observed.percent, 50);
  assert.match(observed.source, /strength proxy, not body shape/);
  assert.match(observed.message, /do not measure hip growth.*hourglass shape/);
});

test('automatic Curves sessions cover glutes, core and both sides at exact selected durations', () => {
  for (const experience of ['beginner', 'intermediate', 'advanced']) for (const sessionMinutes of [10, 20, 60]) {
    const p = profile({ goalType: 'curves', experience, equipment: ['none'], sessionMinutes });
    const session = recommendedSession(p, 3);
    assert.equal(session.steps.reduce((sum, step) => sum + step.duration, 0), sessionMinutes * 60);
    const work = session.steps.filter(step => step.type === 'work');
    assert.ok(work.some(step => EXERCISES[step.exercise].bodyAreas.includes('glutes')));
    assert.ok(work.some(step => EXERCISES[step.exercise].bodyAreas.includes('core')));
    for (const id of new Set(work.filter(step => EXERCISES[step.exercise].bilateral).map(step => step.exercise))) {
      const left = work.filter(step => step.exercise === id && /left side/.test(step.label ?? ''));
      const right = work.filter(step => step.exercise === id && /right side/.test(step.label ?? ''));
      assert.ok(left.length > 0);
      assert.equal(left.length, right.length);
    }
    assert.match(session.description, /timer does not count reps or muscle-building sets/);
    assert.match(session.description, /greater resistance.*hourglass shape is not guaranteed/);
  }
});

test('Curves standing alternatives honor no-floor and fail rather than substitute non-glute activity', () => {
  const p = profile({ goalType: 'curves', restrictions: ['no-floor'], equipment: ['chair'] });
  const session = recommendedSession(p);
  assert.ok(session.steps.every(step => !EXERCISES[step.exercise].floor));
  assert.ok(session.steps.some(step => ['standinghipabduction', 'standinghipextension'].includes(step.exercise)));
  assert.throws(() => recommendedSession({ ...p, equipment: ['none'] }), /No glute-strength movements/);
  const restricted = recommendedSession(profile({ goalType: 'curves', equipment: ['none'], restrictions: ['wrist'] }));
  assert.ok(restricted.steps.every(step => step.exercise !== 'donkeykick'));
});

test('full-body defaults preserve existing sessions while specific focus preferences add eligible variety over weeks', () => {
  const choices = profile({ goalType: 'conditioning', sessionMinutes: 20 });
  assert.deepEqual(recommendedSession(choices, 1).steps, recommendedSession({ ...choices, focusAreas: ['full'], cardioComfort: null, flexibility: null }, 1).steps);
  const workIds = session => [...new Set(session.steps.filter(step => step.type === 'work').map(step => step.exercise))];
  const matching = (ids, area) => ids.filter(id => EXERCISES[id].bodyAreas.includes(area)).length;
  const baseline = workIds(recommendedSession(choices, 1));
  const chest = recommendedSession({ ...choices, focusAreas: ['chest'] }, 1),later = recommendedSession({ ...choices, focusAreas: ['chest'] }, 2);
  assert.ok(matching(workIds(chest), 'chest') > matching(baseline, 'chest'));
  assert.notDeepEqual(workIds(chest), workIds(later));
  assert.ok(workIds(chest).some(id => EXERCISES[id].bodyAreas.includes('legs')));
  assert.match(chest.adaptationReason, /focus areas.*main training goal/);
  const mixed = workIds(recommendedSession({ ...choices, focusAreas: ['arms', 'glutes'] }, 2));
  assert.ok(matching(mixed, 'arms') > 0 && matching(mixed, 'glutes') > 0);
  assert.ok(matching(workIds(recommendedSession({ ...choices, focusAreas: ['full', 'chest'] }, 1)), 'chest') > matching(baseline, 'chest'));
});

test('focus preferences retain primary core, cardio and glute goals rather than replacing them', () => {
  const work = options => recommendedSession(profile(options), 2).steps.filter(step => step.type === 'work');
  assert.ok(work({ goalType: 'core', focusAreas: ['legs'] }).some(step => EXERCISES[step.exercise].bodyAreas.includes('core')));
  const cardio = work({ goalType: 'cardio', focusAreas: ['abs'] });
  assert.equal(cardio[0].exercise, 'march');assert.ok(cardio.some(step => EXERCISES[step.exercise].bodyAreas.includes('abs')));
  for (const experience of ['beginner', 'intermediate', 'advanced']) {
    const curves = work({ goalType: 'curves', experience, focusAreas: ['arms'] });
    assert.ok(curves.some(step => EXERCISES[step.exercise].bodyAreas.includes('core')));
    assert.ok(new Set(curves.filter(step => EXERCISES[step.exercise].bodyAreas.includes('glutes')).map(step => step.exercise)).size >= 2);
  }
});

test('unavailable focus choices fall back to allowed goal movements and never override equipment or restrictions', () => {
  const choices = profile({ focusAreas: ['chest', 'arms'], equipment: ['none'], restrictions: ['no-floor'] });
  const session = recommendedSession(choices);assert.deepEqual(session.steps, recommendedSession({ ...choices, focusAreas: ['full'] }).steps);assert.match(session.adaptationReason, /no eligible movements/);
  for (const focusAreas of [['chest'], ['abs', 'core'], ['back'], ['glutes', 'legs']]) for (const restrictions of [['wrist'], ['no-floor'], ['knee'], ['back']]) {
    const p = profile({ focusAreas, restrictions, experience: 'advanced', equipment: ['wall'] });
    const focused = recommendedSession(p, 3);validateSessionDescriptor(focused);
    assert.ok(focused.steps.every(step => exerciseAllowed(p, step.exercise)));
  }
  const recovery = recommendedSession(profile({ focusAreas: ['arms'], experience: 'advanced' }), 2, { recovery: true });
  assert.ok(recovery.steps.filter(step => step.type === 'work').every(step => (EXERCISES[step.exercise].level ?? 'gentle') === 'gentle'));
});

test('selected breathing comfort reduces effort and preserves longer breaks, lighter weeks and exact session duration', () => {
  const p = profile({ experience: 'advanced', sessionMinutes: 20 });
  const totalWork = session => session.steps.filter(step => step.type === 'work').reduce((seconds, step) => seconds + step.duration, 0);
  const normal = recommendedSession(p, 3),supported = recommendedSession({ ...p, cardioComfort: 'out-of-breath' }, 3),lighter = recommendedSession({ ...p, cardioComfort: 'out-of-breath' }, 4);
  assert.ok(totalWork(supported) < totalWork(normal));assert.ok(totalWork(lighter) < totalWork(supported));
  assert.ok(supported.steps.filter(step => step.type === 'work').every(step => step.duration <= 25));
  const restByAllocation=new Map();for(const step of supported.steps.filter(step=>step.type==='rest')){const key=`${step.round}:${step.exercise}`;restByAllocation.set(key,(restByAllocation.get(key)??0)+step.duration);}assert.ok([...restByAllocation.values()].every(seconds=>seconds>=45));
  assert.equal(supported.steps.reduce((seconds, step) => seconds + step.duration, 0),1200);assert.match(supported.adaptationReason, /chosen cardio comfort|chosen cardio|cardio comfort/);
  assert.deepEqual(recommendedSession({ ...p, cardioComfort: 'easy' }, 3).steps,normal.steps);
  assert.deepEqual(recommendedSession({ ...p, cardioComfort: 'out-of-breath', gender: 'female' }, 3).steps,recommendedSession({ ...p, cardioComfort: 'out-of-breath', gender: 'male' }, 3).steps);
});

test('far flexibility uses comfortable eligible mobility without demanding a toe-touch or inferred diagnosis', () => {
  const p = profile({ focusAreas: ['legs'], flexibility: 'far', equipment: ['chair'] });
  const session = recommendedSession(p);assert.equal(session.steps.at(-1).exercise,'anklepump');assert.match(session.adaptationReason,/comfortable range.*No toe-touch depth/);assert.equal(session.steps.reduce((seconds, step) => seconds + step.duration,0),1200);
  const restricted = profile({ flexibility: 'far', equipment: ['none'], restrictions: ['shoulder', 'back'] });
  assert.deepEqual(recommendedSession(restricted).steps,recommendedSession({ ...restricted, flexibility: null }).steps);
  for (const goalType of Object.keys(GOALS)) for (const sessionMinutes of [10,60]) {
    const session = recommendedSession(profile({ goalType,sessionMinutes,focusAreas:['glutes','core'],cardioComfort:'out-of-breath',flexibility:'far' }));validateSessionDescriptor(session);assert.equal(session.steps.reduce((seconds, step) => seconds + step.duration,0),sessionMinutes*60);
  }
});

test('invalid focus and self-reported comfort answers fail explicitly without silently changing preferences', () => {
  for (const changes of [{focusAreas:[]},{focusAreas:null},{focusAreas:['arms','arms']},{focusAreas:['<script>']},{cardioComfort:'bad'},{flexibility:'extreme'}])assert.throws(()=>validatePreferences(profile(changes)));
  const original=profile({focusAreas:['glutes','arms'],cardioComfort:null,flexibility:null});const cleaned=validatePreferences(original);assert.deepEqual(cleaned.focusAreas,original.focusAreas);cleaned.focusAreas.push('core');assert.deepEqual(original.focusAreas,['glutes','arms']);
});
