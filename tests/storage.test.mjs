import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StateStore} from '../dist/storage.js';
const memory=initial=>({value:initial,getItem(){return this.value},setItem(key,value){this.value=value}});
test('corrupt saved records are preserved until explicit recovery',()=>{const storage=memory('broken { data'),store=new StateStore(storage,'test');assert.deepEqual(store.load(JSON.parse,()=>({fresh:true})),{fresh:true});assert.throws(()=>store.save({replacement:true}));assert.equal(storage.value,'broken { data');assert.equal(store.raw,'broken { data');store.replace({restored:true});assert.equal(store.locked,false);assert.equal(storage.value,'{"restored":true}');});
test('valid records load normally and save successfully',()=>{const storage=memory('{"kept":true}'),store=new StateStore(storage,'test');assert.deepEqual(store.load(v=>v,()=>({})),{kept:true});store.save({updated:true});assert.equal(storage.value,'{"updated":true}');});
test('failed recovery never unlocks the original records',()=>{const storage=memory('corrupt'),store=new StateStore(storage,'test');store.load(v=>v,()=>({}));storage.setItem=()=>{throw new Error('quota')};assert.throws(()=>store.replace({restored:true}));assert.equal(store.locked,true);assert.equal(store.raw,'corrupt');});
