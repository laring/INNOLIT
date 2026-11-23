import {test} from 'node:test'
import assert from 'node:assert/strict'
import {presentationSpecs,presentationPrompt,presentationKey,jpegDensity} from '../src/presentationSet.ts'
import {developedConcept} from './fixtures/development.mjs'
import {freezeConcept} from '../src/conceptDevelopment.ts'
test('three-entry specification locks frozen identity and uses distinct roles and exact poster units',()=>{
 const concept=freezeConcept(developedConcept(),'freeze-test',1)
 assert.deepEqual(presentationSpecs.map(s=>[s.width,s.height]),[[4750,3167],[3167,4750],[8400,4300]])
 assert.ok(Math.abs(8400/254*25.4-840)<1e-9);assert.ok(Math.abs(4300/254*25.4-430)<1e-9)
 const prompts=presentationSpecs.map((_,i)=>presentationPrompt(concept,i))
 assert.equal(new Set(prompts).size,3)
 for(const prompt of prompts){assert.match(prompt,/No iF logo/);assert.match(prompt,/no SDG/);assert.match(prompt,/Freeze is immutable/);assert.match(prompt,/LOCK all silhouette/)}
 assert.match(prompts[0],/WHY \+ WHAT/);assert.match(prompts[1],/HOW/);assert.match(prompts[2],/more than 50%/)
 assert.throws(()=>presentationPrompt(developedConcept(),0),/冻结/)
 const key=presentationKey(concept);concept.productWorkflow={...concept.productWorkflow,confirmedHero:'different-image'};assert.notEqual(presentationKey(concept),key)
})
test('JPG density metadata replaces JFIF without changing compressed image data',()=>{
 const original=new Uint8Array([255,216,255,219,0,2,255,217])
 const once=jpegDensity(original,254),twice=jpegDensity(once,300)
 assert.deepEqual(twice.slice(20),original.slice(2));assert.equal(twice.length,once.length)
 assert.equal(once[13],1);assert.equal((once[14]<<8)|once[15],254)
 assert.equal((twice[14]<<8)|twice[15],300)
 assert.throws(()=>jpegDensity(new Uint8Array([1,2]),254),/JPG/)
})
