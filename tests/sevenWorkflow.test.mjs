import assert from 'node:assert/strict'
import {test} from 'node:test'
import {activeProductStage,workflowOf,workflowImagePrompt,engineeringViews} from '../src/productWorkflow.ts'
import {firmwareFiles,validateFirmwareFiles} from '../src/firmwarePackage.ts'
import {generateConceptBatch} from '../src/concepts.ts'
const concept=()=>generateConceptBatch({problem:'课间计时',audience:'学生',scenario:'桌面',count:3}).concepts[0]
test('seven steps migrate old selections without losing the render phase and engineering views remain independent',()=>{
 assert.equal(activeProductStage('render'),'design');assert.equal(activeProductStage('sketches'),'design');assert.equal(activeProductStage('tooling'),'structure')
 const c=concept();c.productWorkflow={...workflowOf(c),stage:'render'};delete c.productWorkflow.designPhase
 assert.equal(workflowOf(c).designPhase,'render')
 for(const step of ['sheet','hero'])assert.match(workflowImagePrompt(c,step),/No logos/)
 const prompts=Object.keys(engineeringViews).map(view=>workflowImagePrompt(c,view));assert.equal(new Set(prompts).size,5)
 for(const prompt of prompts){assert.match(prompt,/ONE independent/);assert.match(prompt,/No collage/);assert.match(prompt,/No redesign/)}
})
test('firmware deliverables require all layers and documents and cannot contain path traversal',()=>{
 const files=firmwareFiles.map(name=>({name,data:'fixture source for review only'}))
 const result=validateFirmwareFiles(JSON.stringify({files}));assert.equal(result.length,11);assert.match(result.find(x=>x.name==='README.md').data,/未执行编译/)
 assert.throws(()=>validateFirmwareFiles(JSON.stringify({files:files.slice(1)})))
 assert.throws(()=>validateFirmwareFiles(JSON.stringify({files:[...files,{name:'../secret',data:'x'}]})))
 assert.throws(()=>validateFirmwareFiles(JSON.stringify({files:[...files,{name:'run.exe',data:'x'}]})))
})
