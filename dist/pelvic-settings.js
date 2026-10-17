export const PELVIC_DEFAULTS = Object.freeze({guide:'general',experience:'new',comfortableHold:3,week:1,quickReps:false,adviceAccepted:false});
export function validatePelvicSettings(value) {
  if(value===undefined)return {...PELVIC_DEFAULTS};
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!Object.hasOwn(PELVIC_DEFAULTS,key)))throw new Error('Pelvic floor preferences are invalid.');
  const next={...PELVIC_DEFAULTS,...value};
  if(!['general','men','women'].includes(next.guide)||!['new','practiced'].includes(next.experience)||!Number.isInteger(next.comfortableHold)||next.comfortableHold<1||next.comfortableHold>10||!Number.isInteger(next.week)||next.week<1||next.week>12||typeof next.quickReps!=='boolean'||typeof next.adviceAccepted!=='boolean')throw new Error('Choose valid pelvic floor preferences.');
  return next;
}
