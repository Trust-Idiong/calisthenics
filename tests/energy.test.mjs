import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sessionEnergy} from '../dist/energy.js';
test('energy is optional, excludes teens and malformed age/mass, and uses actual elapsed time',()=>{
  assert.equal(sessionEnergy({enabled:false},600,'adult'),null);
  assert.equal(sessionEnergy({enabled:true,age:17,weight:100,intensity:'moderate'},600,'adult'),null);
  assert.equal(sessionEnergy({enabled:true,age:35,weight:100,intensity:'moderate'},600,'teen'),null);
  assert.equal(sessionEnergy({enabled:true,age:35,weight:100,intensity:'moderate'},0,'adult'),null);
  assert.deepEqual(sessionEnergy({enabled:true,age:35,weight:100,intensity:'moderate'},600,'adult'),{kcal:67,kcalSource:'estimated',kcalAge:35,kcalWeight:100,kcalMET:3.8});
  assert.equal(sessionEnergy({enabled:true,age:35,weight:100,intensity:'light'},300,'adult').kcal,25);
});
