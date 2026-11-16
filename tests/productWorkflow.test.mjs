import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { deflateSync } from 'node:zlib'
import { generateConceptBatch } from '../src/concepts.ts'
import { engineeringContext, engineeringProblems, packagingContext, printResolution, sketchCell, workflowContext, workflowImagePrompt, workflowOf, selectedSketchMatches } from '../src/productWorkflow.ts'
import { cartonGeometry, crc32, engineeringEnvelope, packagingFiles, packagingProblem, pngDensity, zipFiles } from '../src/productionFiles.ts'
import { analyzeEngineering, engineeringInput, engineeringPrompt } from '../src/engineeringModel.ts'
import { getProjectStudio, loadProjects } from '../src/projects.ts'
import { modelApi } from '../server/modelApi.ts'
import { brief } from './fixtures/development.mjs'

const newConcept = () => generateConceptBatch(brief).concepts[0]
function packagedConcept() {
  const concept = newConcept(), data = workflowOf(concept)
  concept.productWorkflow = { ...data, productName: '静息牌', brand: 'INNO LIT', brandColor: '#7865bb', assets: { hero: 'product-photo' }, packaging: { ...data.packaging, length: 150, width: 80, height: 200, stock: '待印厂核对的纸材 350g，厚度以样纸为准', copy: '翻面开启一分钟安静休息。操作与材料以最终产品为准。' } }
  return concept
}
const productImage = 'data:image/png;base64,iVBORw0KGgo='

test('selected sketch survives second-step branding and function edits, including legacy saved selections', () => {
  const concept = packagedConcept(), data = concept.productWorkflow
  data.assets.sheet = 'sheet-original'; data.assets.selected = 'crop-07'; data.selection = 6
  const selected = workflowContext(concept, 'selected')
  const legacy = JSON.stringify({ sheet: data.assets.sheet, selection: 6, sheetContext: workflowContext(concept, 'sheet') })
  data.productName = '优化后的产品名'; data.brand = '新品牌'; data.functions += '完善交互'; data.renderNotes = '增加轻盈的材质细节'
  assert.equal(workflowContext(concept, 'selected'), selected)
  assert.equal(selectedSketchMatches(concept, selected), true)
  assert.equal(selectedSketchMatches(concept, legacy), true)
  data.assets.sheet = 'regenerated-sheet'
  assert.equal(selectedSketchMatches(concept, selected), false)
  assert.equal(selectedSketchMatches(concept, legacy), false)
})

test('five design steps and engineering inputs persist under the project without changing the original concept or freeze', () => {
  const concept = packagedConcept()
  concept.productWorkflow.stage = 'structure'
  concept.productWorkflow.selection = 7
  concept.productWorkflow.components = '01|上壳|材料待工程确认'
  const round = generateConceptBatch(brief); round.concepts[0] = concept
  const [project] = loadProjects({ getItem: () => JSON.stringify([{ id: 'p', name: '项目', messages: [], updatedAt: 1, conceptStudio: { draft: brief, rounds: [round], activeRound: 0 } }]) })
  assert.deepEqual(workflowOf(getProjectStudio(project).rounds[0].concepts[0]), concept.productWorkflow)
  assert.equal(concept.development, undefined)
  assert.equal(workflowOf(newConcept()).stage, 'sketches')
})

test('ten crop cells partition odd-sized sketch sheets without gaps or overlaps', () => {
  const cells = Array.from({ length: 10 }, (_, index) => sketchCell(index, 1537, 1025))
  assert.equal(cells.reduce((area, cell) => area + cell.width * cell.height, 0), 1537 * 1025)
  assert.equal(cells[4].left + cells[4].width, 1537)
  assert.equal(cells[9].top + cells[9].height, 1025)
  assert.equal(cells[5].top, cells[0].height)
  assert.throws(() => sketchCell(10, 1000, 1000))
  assert.throws(() => sketchCell(-1, 1000, 1000))
})

test('uploaded reference is the only sketch style source and obsolete built-in preferences do not change generation', () => {
  const concept = packagedConcept()
  concept.productWorkflow.assets.style = 'uploaded-style-image'
  const key = workflowContext(concept, 'sheet'), prompt = workflowImagePrompt(concept, 'sheet')
  assert.match(prompt, /Follow the uploaded style reference only/)
  assert.ok(key.includes('uploaded-style-image'))
  concept.productWorkflow.style = 'marker'
  assert.equal(workflowContext(concept, 'sheet'), key)
  assert.equal(workflowImagePrompt(concept, 'sheet'), prompt)
  concept.productWorkflow.assets.style = 'replacement-upload'
  assert.notEqual(workflowContext(concept, 'sheet'), key)
})

test('sketch prompts support explicitly drawing without a reference and do not pretend to see an absent image', () => {
  const concept = newConcept()
  const prompt = workflowImagePrompt(concept, 'sheet')
  assert.match(prompt, /No style reference image is supplied/)
  assert.doesNotMatch(prompt, /Follow the uploaded style reference only/)
})

test('product identity and upstream choices invalidate downstream images while display-only navigation does not', () => {
  const concept = packagedConcept(), data = concept.productWorkflow
  data.assets.sheet = 'sheet-a'; data.assets.selected = 'selected-3'; data.selection = 2
  const hero = workflowContext(concept, 'hero'), exploded = workflowContext(concept, 'exploded'), sheet = workflowContext(concept, 'sheet')
  data.stage = 'packaging'; data.printWidth = 50
  assert.equal(workflowContext(concept, 'hero'), hero)
  data.selection = 3
  assert.notEqual(workflowContext(concept, 'hero'), hero)
  data.selection = 2; data.components = '01|new internal structure'
  assert.equal(workflowContext(concept, 'hero'), hero)
  assert.notEqual(workflowContext(concept, 'exploded'), exploded)
  data.brand = 'NEW BRAND'
  assert.notEqual(workflowContext(concept, 'sheet'), sheet)
  for (const role of ['sheet', 'hero', 'exploded', 'package']) {
    const prompt = workflowImagePrompt(concept, role)
    assert.ok(prompt.includes(data.productName)); assert.ok(prompt.includes(data.brand)); assert.ok(prompt.includes(data.brandColor))
  }
  assert.match(workflowImagePrompt(concept, 'sheet'), /EXACTLY TEN.*2 rows by 5 columns/)
  assert.match(workflowImagePrompt(concept, 'exploded'), /not production CAD/)
  assert.match(workflowImagePrompt(concept, 'package'), /editable vector files/)
})

test('mould handoff requires real engineering inputs, correctly classified files and a current review', () => {
  const data = workflowOf(newConcept())
  assert.ok(engineeringProblems(data).length >= 7)
  Object.assign(data.engineering, { length: 90, width: 60, height: 12, wall: 2, material: '供应商指定树脂', shrinkage: '以该牌号供应商实测报告为准', tolerance: '关键尺寸见已审核图纸', review: '工程师复核记录', files: [
    { id: 'p', name: 'product.step', role: 'product' }, { id: 'm', name: 'tooling.step', role: 'mould' }, { id: 'd', name: 'machining.dxf', role: 'drawing' },
  ] })
  assert.deepEqual(engineeringProblems(data), [])
  const key = engineeringContext(data); data.engineering.confirmedContext = key
  assert.equal(engineeringContext(data), key)
  data.engineering.review += '更新审查结论'
  assert.notEqual(engineeringContext(data), key)
  data.engineering.files = data.engineering.files.filter(file => file.role !== 'mould')
  assert.ok(engineeringProblems(data).includes('上传模具三维总装'))
  assert.match(engineeringEnvelope(data), /NOT MOULD CAVITY OR MACHINING DRAWING/)
})

test('packaging exports editable artwork with the exact product image, matching names, closed mm geometry and complete copy', () => {
  const data = workflowOf(packagedConcept()), geometry = cartonGeometry(data), files = packagingFiles(data, productImage)
  assert.equal(packagingProblem(data), '')
  const svg = files.find(file => file.name === 'artwork.svg').data
  const dxf = files.find(file => file.name === 'dieline.dxf').data
  assert.ok(svg.includes(productImage)); assert.ok(svg.includes(data.brandColor)); assert.ok(svg.includes(data.productName)); assert.ok(svg.includes(data.brand))
  assert.match(svg, /id="NONPRINT_DIELINE" visibility="hidden"/)
  assert.match(svg, /width=".*mm" height=".*mm"/)
  assert.match(dxf, /\$INSUNITS\r\n70\r\n4\r\n/)
  assert.match(dxf, /LWPOLYLINE/); assert.match(dxf, /CREASE/)
  assert.ok(geometry.outline.length > 25)
  for (let index = 1; index < geometry.outline.length; index++) assert.notDeepEqual(geometry.outline[index], geometry.outline[index - 1])
  // A closed dieline must never self-intersect; ignore shared endpoints and adjacent edges.
  const points = geometry.outline
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  for (let a = 0; a < points.length; a++) for (let b = a + 2; b < points.length; b++) {
    if (a === 0 && b === points.length - 1) continue
    const p1 = points[a], p2 = points[(a + 1) % points.length], q1 = points[b], q2 = points[(b + 1) % points.length]
    assert.equal(cross(p1, p2, q1) * cross(p1, p2, q2) < 0 && cross(q1, q2, p1) * cross(q1, q2, p2) < 0, false)
  }
  const prior = packagingContext(data); data.packaging.confirmedContext = prior
  assert.match(packagingFiles(data, productImage).find(file => file.name === 'README.md').data, /含人工确认/)
  data.packaging.copy += '更新'
  assert.notEqual(packagingContext(data), prior)
  assert.match(packagingFiles(data, productImage).find(file => file.name === 'README.md').data, /待印厂确认/)
})

test('packaging blocks invalid dimensions, excess copy, unsafe image sources and XML injection', () => {
  const data = workflowOf(packagedConcept())
  for (const field of ['length', 'width', 'height', 'flap', 'bleed']) {
    const spec = structuredClone(data); spec.packaging[field] = 0
    assert.ok(packagingProblem(spec)); assert.throws(() => cartonGeometry(spec))
  }
  const excess = structuredClone(data); excess.packaging.copy = '很多文案'.repeat(500)
  assert.match(packagingProblem(excess), /超过当前背板容量/)
  assert.throws(() => packagingFiles(data, 'https://tracking.example/image.png'), /嵌入当前产品效果图/)
  data.brand = '<svg>'
  assert.ok(packagingFiles(data, productImage)[0].data.includes('&lt;svg&gt;'))
  assert.equal(packagingFiles(data, productImage)[0].data.includes('><svg><'), false)
})

function chunk(name, content) {
  const bytes = Buffer.alloc(content.length + 12); bytes.writeUInt32BE(content.length); bytes.write(name, 4, 'ascii'); bytes.set(content, 8); bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4); return bytes
}
function tinyPng() {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0,255,255,255,255]))), chunk('IEND', Buffer.alloc(0))])
}
test('native-pixel print exports use valid PNG density and CRC without modifying image data or accepting sub-300 dpi', () => {
  assert.equal(printResolution(3000, 254), 300)
  assert.throws(() => printResolution(1000, 0))
  const original = tinyPng(), result = pngDensity(original, 300), repeated = pngDensity(result, 600)
  let count = 0
  for (let offset = 8; offset < repeated.length;) {
    const view = new DataView(repeated.buffer, repeated.byteOffset + offset), size = view.getUint32(0)
    const name = String.fromCharCode(...repeated.subarray(offset + 4, offset + 8))
    assert.equal(view.getUint32(size + 8), crc32(repeated.subarray(offset + 4, offset + size + 8)))
    if (name === 'pHYs') { count++; assert.equal(view.getUint32(8), Math.round(600 / .0254)); assert.equal(repeated[offset + 16], 1) }
    if (name === 'IDAT') { const start = original.indexOf('IDAT') + 4; assert.deepEqual(Buffer.from(repeated.subarray(offset + 8, offset + size + 8)), original.subarray(start, start + original.readUInt32BE(start - 8))) }
    offset += size + 12
  }
  assert.equal(count, 1)
  assert.throws(() => pngDensity(original, 299), /不低于 300/)
  assert.throws(() => pngDensity(original.subarray(0, -5), 300), /不完整/)
})

test('delivery ZIP preserves exact editable files, UTF-8 names and valid checksums without path traversal', () => {
  const files = [...packagingFiles(workflowOf(packagedConcept()), productImage), { name: '工程/产品.step', data: new Uint8Array([1, 2, 3]) }]
  const zip = zipFiles(files), view = new DataView(zip.buffer)
  let offset = 0
  for (const file of files) {
    assert.equal(view.getUint32(offset, true), 0x04034b50)
    assert.equal(view.getUint16(offset + 6, true), 0x800)
    const size = view.getUint32(offset + 18, true), length = view.getUint16(offset + 26, true)
    assert.equal(new TextDecoder().decode(zip.subarray(offset + 30, offset + 30 + length)), file.name)
    const content = zip.subarray(offset + 30 + length, offset + 30 + length + size)
    assert.equal(crc32(content), view.getUint32(offset + 14, true))
    assert.deepEqual(content, typeof file.data === 'string' ? new TextEncoder().encode(file.data) : file.data)
    offset += 30 + length + size
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50)
  assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50)
  for (const name of ['../escape.step', '/absolute', 'D:\\secret', 'safe/../escape']) assert.throws(() => zipFiles([{ name, data: 'no' }]), /文件名/)
  assert.throws(() => zipFiles([{ name: 'A', data: '' }, { name: 'a', data: '' }]), /名称/)
})

test('engineering AI uses supplied metadata only, returns editable analysis, and keeps CAD review boundaries explicit', async context => {
  const concept = packagedConcept(), settings = { baseUrl: 'https://api.example.com', model: 'fixture-engineer', apiKey: 'test-only-key' }
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.doesNotMatch(options.body, /test-only-key|confirmedContext/)
    const input = JSON.parse(options.body), payload = engineeringPrompt(input, settings.model)
    assert.match(payload.messages[0].content, /没有读取 CAD 几何/)
    return Response.json({ content: '```json\n' + JSON.stringify({ analysis: '建议复核壁厚与拔模。', draft: '01|上壳|待定|待工程确认', missing: ['三维几何'] }) + '\n```' })
  })
  assert.match(await analyzeEngineering(concept, 'structure', settings, new AbortController().signal), /三维几何/)
  assert.equal(concept.productWorkflow.engineering.confirmedContext, undefined)
  assert.throws(() => engineeringPrompt({ ...engineeringInput(concept, 'dfm'), action: 'invent-toolpaths' }, settings.model), /未知/)
})

test('engineering tasks use the existing local authenticated model relay', async context => {
  let middleware, called = false
  modelApi(async (_url, _key, payload) => { called = true; assert.match(payload.messages[1].content, /注塑 DFM/); return { status: 200, data: { choices: [{ finish_reason: 'stop', message: { content: '{"analysis":"待工程确认"}' } }] } } }).configureServer({ middlewares: { use: handler => { middleware = handler } } })
  const server = createServer((request, response) => middleware(request, response, () => response.writeHead(404).end()))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); context.after(() => new Promise(resolve => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  const response = await fetch(origin + '/api/inno-lit/develop', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: 'Bearer test-only-key' }, body: JSON.stringify({ ...engineeringInput(packagedConcept(), 'dfm'), baseUrl: 'https://api.example.com', model: 'fixture-engineer' }) })
  assert.equal(response.status, 200); assert.equal(called, true)
})
