# Onboarding reference screen map

Prepared October 13, 2026 for version 6. The user supplied **29 screenshots** as visual references. They cover welcome, a questionnaire and a scrollable final plan preview. Several images show continuations of the same stage; they do not define 29 distinct questions.

No signup/login form, main app tabs, workout player or paywall was visible in this set. Existing app features were retained from FORM's requirements rather than claimed as copies of unseen reference screens. The user chose device-only profiles, so the reference login entry is adapted to a local profile route.

## Screen mapping

| Reference stage | Observed content | FORM implementation/adaptation |
| --- | --- | --- |
| Splash/welcome | Welcome video, LET'S GO and Log in entry | Original welcome photo; LET'S GO enters gender/setup directly. Your device profile opens the local continue/create-plan route. No cloud signup is required. |
| 01 · Goal: gender | Male, Female, Others, Prefer not to answer | Same profile-choice pattern. Gender does not dictate ability or lock goals to a stereotype. |
| Motivation | Toning, confidence, energy, health, stress | One choice stored as a personal preference. It is not a diagnosis or a result guarantee. |
| Main target | Lose weight, Build muscle, Keep fit | Nine FORM goals, including adult Curves & glute development, strength, core, cardio, mobility, consistency and personal performance. Adult appearance/weight controls keep their age restrictions. |
| Focus | Chest/PECs, arms, belly, legs, full body | Multiple focus areas with original body illustration; glutes and back are available. A personal plan still balances movement. |
| 02 · Know your body: height | cm/feet control and ruler | Optional adult height; cm or total inches converted to cm. The ruler is a visual input aid. |
| Current weight | kg/lbs ruler and BMI display | Optional adult weight, kg/lbs converted to kg. Weight is not required for a strength/Curves plan. The implementation does not reproduce a diagnostic body classification from the reference BMI display. |
| Target weight | kg/lbs target input | Optional weight-goal-only step with existing pace/range checks. Other goals skip this step. |
| Birth year | Birth-year selection | Optional year plus age group choices 16–17, 18–64, 65+. Year-based age is approximate. Teen profiles cannot select adult weight/Curves targets. |
| Information/projection | Before/after imagery and a projected target date | General strength/body-shape context and an editable training timeframe. No simulated transformation or guaranteed result-date graph. |
| 03 · Workout preference: location | Gym, Home, Outdoors | Stored location preference. Available routines still honor declared equipment and movement restrictions. |
| Frequency | 1–7 day presets and weekday tiles | Frequency presets plus explicit weekdays. Recovery remains part of scheduling. |
| Injury question | No injuries, shoulder, back/waist, wrist, knee | Movement-avoidance filters plus no-floor and low-impact choices. The wording avoids presenting this as injury diagnosis or rehabilitation. |
| Additional FORM controls | Not shown in this set | Equipment and session-time questions preserve the existing app's practical constraints. |
| 04 · Fitness assessment: level | Beginner, Intermediate, Advanced | Experience choice determines an appropriate starting level. |
| Brisk walking | Out of breath, mildly breathless, at ease | Optional self-report with a skip choice; no exercise test is demanded. |
| Forward bend | Far from, close to, or easily touching feet | Optional comfortable-reach self-report with a skip choice. Users are not asked to force a stretch. |
| Revised projection/comparison | Forecast and plan comparison | General explanation of pacing, recovery and later difficulty feedback. No statistical success badge or fabricated comparison result. |
| Desired feelings | Confidence, body satisfaction, achievement, energy, health reassurance | Multiple personal preferences, stored locally. No mental-health treatment claim. |
| Reward | Clothes, meal, gift, trip, photos; final item partly occluded | Personal reward choices, including deciding later. The occluded text was not treated as a verified requirement. |
| Additional FORM controls | Not shown in this set | Optional name and manually entered outcome assessment; training-guidance acknowledgment and optional adult body tracking. |
| Final plan preview | Summary/calendar, four-week preview, GET MY PLAN | Actual generated schedule and editable dates, level, duration, weekdays and focus. The personal timeframe remains flexible rather than fixed to four weeks. |

The implementation follows [SETUP_STEPS in onboarding.js](../dist/onboarding.js), which contains 25 possible stages. Conditional steps are skipped: weight targets are shown only for weight goals, manual non-weight targets use their own stage, and adult body questions are skipped for a known teen profile. Back/Next controls preserve the question flow; a local setup draft supports resumption. Existing records skip compulsory onboarding and can enter the questionnaire when editing preferences.

## What the references do not establish

The screenshots include example weights/dates, a **93%/40 kg** promotional claim and a **200 kcal/day** figure. These are observed marketing/example content, not validated requirements or evidence of an algorithm. FORM does not copy those claims into outcome calculations, infer an appearance score, or promise a physical transformation by a chosen date.

The reference images do not establish provider connectivity, purchases, expert-coach endorsements, background notification delivery or cloud workout storage. FORM's confirmed device-only mode and inactive future account preparation are documented separately in [account preparation](authentication-setup.md).

## Assets and product scope

Layout and question patterns informed the implementation. The welcome photo was generated originally for FORM without input images; reference photos and screenshot bitmaps were not reused. Body diagrams and interface icons remain original code/SVG artwork. See [asset provenance](assets-provenance.md).

The new Home screen and focused Workouts/Programs/My workouts/For you destinations provide access to existing routines, programs, custom workouts and reports. They were not visible in the 29 onboarding reference images. Existing workout, progress, backup and safety behavior remains part of the product requirements.
