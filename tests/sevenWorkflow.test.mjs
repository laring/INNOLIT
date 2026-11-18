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

test('professional English briefs use frozen-aware context, feed generation and invalidate dependent presentation boards',async()=>{
 const {englishPromptSource,workflowContext}=await import('../src/productWorkflow.ts')
 const {engineeringInput,engineeringPrompt,translateImagePrompt}=await import('../src/engineeringModel.ts')
 const c=concept(),source=englishPromptSource(c)
 c.productWorkflow={...workflowOf(c),englishPrompt:'A compact tactile timer with an ivory enclosure.',englishPromptSource:source,assets:{hero:'approved-hero'},confirmedHero:'approved-hero'}
 assert.equal(englishPromptSource(c),source)
 for(const role of ['sheet','hero','pcb','orthographic','presentation'])assert.match(workflowImagePrompt(c,role),/compact tactile timer/)
 const before=workflowContext(c,'presentation');c.productWorkflow.assets.hero='new-hero';assert.notEqual(workflowContext(c,'presentation'),before)
 const board=workflowImagePrompt(c,'presentation');assert.match(board,/over 50%/);assert.match(board,/No redesign/);assert.match(board,/No iF logo/)
 c.productWorkflow.useEnglishPrompt=false;assert.doesNotMatch(workflowImagePrompt(c,'hero'),/compact tactile timer/)
 const request=engineeringInput(c,'image-prompt');assert.ok(request.product.subject.sentences)
 assert.ok(JSON.stringify(engineeringPrompt(request,'fixture')).includes('Frozen subject identity'))
 assert.equal(typeof translateImagePrompt,'function')
 c.development={frozen:{revision:2,design:{title:'Frozen product',format:c.format,sentences:{...c.sentences,idea:'Frozen idea'}},identity:{shape:'fixed oval'}}}
 const frozenInput=engineeringInput(c,'image-prompt');assert.equal(frozenInput.product.subject.title,'Frozen product');assert.equal(frozenInput.product.subject.identity.shape,'fixed oval')
 assert.match(englishPromptSource(c),/冻结 V2/)
})

test('automatic English prompt fill preserves manual edits, changed source and opted-out projects',async()=>{
 const {englishPromptSource,fillEnglishPrompt}=await import('../src/productWorkflow.ts')
 const c=concept(),source=englishPromptSource(c)
 const result=fillEnglishPrompt(c,source,'Professional English product brief')
 assert.equal(result.productWorkflow.englishPrompt,'Professional English product brief')
 assert.equal(fillEnglishPrompt(result,source,'Overwrite'),result)
 c.productWorkflow={...workflowOf(c),useEnglishPrompt:false};assert.equal(fillEnglishPrompt(c,source,'Ignored'),c)
 c.productWorkflow.useEnglishPrompt=true;c.productWorkflow.functions='changed';assert.equal(fillEnglishPrompt(c,source,'Stale'),c)
})

test('drawing parameter recommendations include the real image and keep estimates distinct from measured engineering data',async context=>{
 const {engineeringInput,engineeringPrompt,recommendDrawingParameters}=await import('../src/engineeringModel.ts')
 const c=concept(),reference='data:image/jpeg;base64,/9j/AA=='
 const request={...engineeringInput(c,'drawing-parameters'),reference}
 const payload=engineeringPrompt(request,'vision-fixture')
 assert.equal(payload.messages[1].content[1].image_url.url,reference)
 assert.match(payload.messages[1].content[0].text,/输出仅为推荐参数/)
 assert.match(payload.messages[1].content[0].text,/一组可直接出图的默认选值/)
 assert.match(payload.messages[1].content[0].text,/不混用工艺精度/)
 assert.throws(()=>engineeringPrompt({...request,reference:'https://example.com/private.jpg'},'fixture'))
 assert.throws(()=>engineeringPrompt({...request,reference:reference+'A'.repeat(250000)},'fixture'))
 context.mock.method(globalThis,'fetch',async(_url,options)=>{
  assert.equal(JSON.parse(options.body).reference,reference)
  return Response.json({content:JSON.stringify({recommendations:'长宽高建议范围待验证；材料候选 PLA；公差由工程师核对。'})})
 })
 const result=await recommendDrawingParameters(c,reference,{baseUrl:'https://example.com/v1',model:'vision-fixture',apiKey:'fixture'},new AbortController().signal)
 assert.doesNotMatch(result,/AI 推荐估算，非实测/)
 assert.match(result,/材料候选 PLA/)
 assert.equal(c.productWorkflow,undefined)
})
