// Gross session energy proxy from the 2024 Adult Compendium (ages 19-59).
// https://pacompendium.com/conditioning-exercise/
// https://pacompendium.com/unite-conversions/
export const ENERGY_MET = Object.freeze({light:2.8,moderate:3.8,vigorous:7.5});
export function sessionEnergy(settings,seconds,ageBand){
  if(!settings?.enabled||ageBand==='teen')return null;
  const {age,weight,intensity}=settings,met=ENERGY_MET[intensity];
  if(!Number.isInteger(age)||age<19||age>59||!Number.isFinite(weight)||weight<30||weight>400||!met||!Number.isFinite(seconds)||seconds<=0)return null;
  return {kcal:Math.round(Number((met*3.5*weight/200*(seconds/60)).toFixed(8))),kcalSource:'estimated',kcalAge:age,kcalWeight:weight,kcalMET:met};
}
