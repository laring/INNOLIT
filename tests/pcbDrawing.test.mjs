import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyPcb, pcbGeometry, pcbSvg } from '../src/pcbDrawing.ts'
import { productStages, workflowOf, workflowContext, workflowImagePrompt } from '../src/productWorkflow.ts'
import { engineeringInput, engineeringPrompt } from '../src/engineeringModel.ts'
import { generateConceptBatch } from '../src/concepts.ts'
import { loadProjects } from '../src/projects.ts'
const size = { layout:'landscape',width:1600,height:1000 }
const pcb = () => ({...emptyPcb,length:80,width:40,thickness:'1.6 mm（测试）',copper:'35 µm（测试）',finish:'ENIG（待核实）',tolerance:'±0.2 mm（测试）',drawingNo:'TEST-PCB-001',revision:'A',designer:'测试工程师',holes:'H1|PTH|5|5|1|2\nH2|NPTH|75|35|2|0',pads:'U1.1|30|20|2|1|+|VCC\nU1.2|35|20|2|1|-|GND',tracks:'VCC|0.3|30,20;30,10;50,10',components:'U1|32|25|10|5|+'})
const concept = () => generateConceptBatch({problem:'休息计时',audience:'学生',scenario:'桌面',count:3}).concepts[0]
test('six-step order inserts PCB between product rendering and exploded structure and restores older stages',()=>{
  assert.deepEqual(Object.keys(productStages),['design','structure','drawings','pcb','firmware','packaging','compliance'])
  const current=concept();current.productWorkflow={...workflowOf(current),stage:'packaging'}
  delete current.productWorkflow.pcb
  assert.deepEqual(workflowOf(current).pcb,emptyPcb)
  current.productWorkflow={...workflowOf(current),stage:'pcb',pcb:pcb()}
  const project={id:'pcb-project',name:'PCB',messages:[],conceptStudio:{rounds:[{concepts:[current]}]}}
  const restored=loadProjects({getItem:()=>JSON.stringify([project])})[0].conceptStudio.rounds[0].concepts[0]
  assert.deepEqual(workflowOf(restored).pcb,pcb())
  assert.equal(workflowOf(restored).stage,'pcb')
})
test('PCB drawing contexts follow the approved product and PCB data without invalidating the hero',()=>{
  const current=concept();current.productWorkflow={...workflowOf(current),pcb:pcb(),assets:{hero:'hero-1'},confirmedHero:'hero-1'}
  const hero=workflowContext(current,'hero'),drawing=workflowContext(current,'pcb')
  current.productWorkflow.pcb.length=90
  assert.notEqual(workflowContext(current,'pcb'),drawing)
  assert.equal(workflowContext(current,'hero'),hero)
  const next=workflowContext(current,'pcb');current.productWorkflow.assets.hero='hero-2'
  assert.notEqual(workflowContext(current,'pcb'),next)
  const prompt=workflowImagePrompt(current,'pcb')
  assert.match(prompt,/Senior electronics engineer/)
  assert.match(prompt,/NO 3D/)
  assert.match(prompt,/PTH.*NPTH/)
  assert.match(prompt,/BOTTOM RIGHT/)
  assert.doesNotMatch(prompt,/refined studio lighting|avant-garde/)
  const payload=engineeringPrompt(engineeringInput(current,'pcb'),'pcb-review-model')
  assert.equal(payload.model,'pcb-review-model')
  assert.match(payload.messages[1].content,/网表/)
  assert.match(payload.messages[1].content,/TEST-PCB-001/)
})
test('PCB vector exports explicit coordinates, distinct holes, pads, top copper, polarity and title data without embedded raster',()=>{
  const geometry=pcbGeometry(pcb())
  assert.equal(geometry.holes.length,2);assert.equal(geometry.pads.length,2);assert.equal(geometry.tracks.length,1)
  const svg=pcbSvg('测试产品',pcb(),size)
  for(const text of ['TEST-PCB-001','35 µm','ENIG','测试工程师','PTH','NPTH','data-net="VCC"','id="silk-U1"','id="pad-U1.1"','id="hole-H1"','±0.2'])assert.ok(svg.includes(text),text)
  assert.match(svg,/未完成电气校核/)
  assert.doesNotMatch(svg,/<image|<script|linearGradient|filter=/)
  assert.ok(svg.includes('stroke-width="0.5"'))
  const escaped=pcbSvg('<script>&测试', {...pcb(),designer:'<img onerror="x">'},size)
  assert.ok(escaped.includes('&lt;script&gt;&amp;测试'))
  assert.doesNotMatch(escaped,/<script>|<img /)
  const missing=pcbSvg('未布线',{...emptyPcb,length:80,width:40},size)
  assert.doesNotMatch(missing,/id="hole-|id="pad-|id="silk-|<polyline/)
})
test('invalid or fabricated-looking geometry is blocked before vector generation',()=>{
  for(const patch of [
    {length:0},{width:Infinity},{holes:'H1|PTH|5|5|2|1'},
    {holes:'H1|NPTH|5|5|1|2'},{holes:'H1|NPTH|0|0|2|0'},
    {holes:'H1|NPTH||5|1|0'}, {holes:'H1|NPTH|5|5|1|0\nH1|NPTH|10|10|1|0'},
    {pads:'U1.1|79|20|4|1|+|VCC'},{tracks:'VCC|0.3|5,5;90,5'},
    {tracks:'VCC|0.3|5,5'},{components:'U1|0|0|10|10|+'},
  ])assert.throws(()=>pcbSvg('产品',{...pcb(),...patch},size))
  assert.throws(()=>pcbSvg('产品',pcb(),{...size,width:6000,height:320}))
})

test('PCB analysis uses the authenticated engineering relay and keeps model credentials out of PCB data', async context => {
  const { createServer } = await import('node:http')
  const { modelApi } = await import('../server/modelApi.ts')
  const { analyzeEngineering } = await import('../src/engineeringModel.ts')
  const current=concept();current.productWorkflow={...workflowOf(current),pcb:pcb()}
  let middleware,seen
  modelApi(async (_url,key,payload)=>{
    assert.equal(key,'fixture-only-pcb-token');seen=payload
    return {status:200,data:{choices:[{finish_reason:'stop',message:{content:JSON.stringify({analysis:'工程分析：待核实网表。',draft:'建议核对PTH/NPTH和板框。',missing:['ERC/DRC记录']})}}]}}
  }).configureServer({middlewares:{use:handler=>{middleware=handler}}})
  const server=createServer((request,response)=>middleware(request,response,()=>response.writeHead(404).end()))
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  context.after(()=>new Promise(resolve=>server.close(resolve)))
  const origin=`http://127.0.0.1:${server.address().port}`
  const originalFetch=globalThis.fetch
  context.mock.method(globalThis,'fetch',(url,options)=>originalFetch(origin+url,{...options,headers:{...options.headers,Origin:origin}}))
  const result=await analyzeEngineering(current,'pcb',{baseUrl:'https://example.com/v1',model:'pcb-review-model',apiKey:'fixture-only-pcb-token'},new AbortController().signal)
  assert.match(result,/ERC\/DRC/)
  assert.equal(seen.model,'pcb-review-model')
  assert.doesNotMatch(JSON.stringify(seen),/fixture-only-pcb-token/)
  assert.deepEqual(current.productWorkflow.pcb,pcb())
})
