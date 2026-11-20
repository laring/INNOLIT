import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateConceptBatch } from '../src/concepts.ts'
import { emptyPlanningInputs, planningModules, planningTemplate, planningContext, parsePlanningSections, generatePlanning, formatPlanningReports } from '../src/planningReport.ts'
import { reportPrompt } from '../src/reportModel.ts'
import { buildPlanningPptx, planningSlides, wrapReportText } from '../src/planningPptx.ts'
import { loadProjects, STORAGE_KEY } from '../src/projects.ts'

const concept = generateConceptBatch({ problem: '专注', audience: '办公人群', scenario: '桌面', count: 3 }).concepts[0]
const inputs = { ...emptyPlanningInputs, product: 'PCB 桌面计时器', markets: '待确认' }
const key = planningContext(concept, inputs)

test('two independent 12-chapter reports persist with their owning concept and preserve human edits', () => {
  const state = { inputs, product: planningTemplate('product', key), compliance: planningTemplate('compliance', key) }
  state.product.sections[0].body = '人工确认：产品功能需进一步测试。'
  const project = { id: 'one', name: '报告项目', messages: [], updatedAt: 1, conceptStudio: { draft: {}, rounds: [{ concepts: [{ ...concept, planningReport: state }] }], activeRound: 0 } }
  const loaded = loadProjects({ getItem: name => name === STORAGE_KEY ? JSON.stringify([project]) : null })
  const saved = loaded[0].conceptStudio.rounds[0].concepts[0].planningReport
  assert.deepEqual(saved, state)
  assert.equal(saved.product.sections.length, 12)
  assert.equal(saved.compliance.sections.length, 12)
  assert.match(formatPlanningReports(saved), /人工确认/)
  assert.notEqual(planningContext({ ...concept, notes: '更新依据' }, inputs), key)
  assert.notEqual(planningContext(concept, { ...inputs, markets: '欧盟' }), key)
  assert.equal(planningContext({ ...concept, planningReport: state }, inputs), key)
})

test('report generation validates completeness and order and carries boundaries through the existing report route', async () => {
  const fixture = planningTemplate('compliance', key)
  const prompt = reportPrompt({ stage: 'report', kind: 'planning', reportKind: 'compliance', inputs, context: key }, 'selected-report-model')
  assert.equal(prompt.model, 'selected-report-model')
  assert.match(prompt.messages[0].content, /不能虚构/)
  assert.match(prompt.messages[1].content, /营销物料与法务预审/)
  assert.throws(() => reportPrompt({ kind: 'planning', reportKind: 'invalid' }, 'x'))
  assert.throws(() => parsePlanningSections(JSON.stringify({ sections: fixture.sections.slice(1) }), 'compliance'), /完整/)
  assert.throws(() => parsePlanningSections(JSON.stringify({ sections: [...fixture.sections].reverse() }), 'compliance'), /格式/)
  const original = globalThis.fetch
  let request
  globalThis.fetch = async (url, init) => { request = { url, init, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ content: JSON.stringify({ sections: fixture.sections }) }), { headers: { 'Content-Type': 'application/json' } }) }
  try {
    const draft = await generatePlanning('compliance', concept, inputs, { model: 'selected-report-model', baseUrl: 'https://example.com/v1', apiKey: 'fixture-secret' }, new AbortController().signal)
    assert.equal(draft.contextKey, key)
    assert.equal(request.body.stage, 'report')
    assert.equal(request.body.model, 'selected-report-model')
    assert.ok(!JSON.stringify(request.body).includes('fixture-secret'))
    assert.match(draft.source, /selected-report-model/)
  } finally { globalThis.fetch = original }
})

function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), files = new Map()
  let offset = 0
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true)
    const start = offset + 30 + nameLength + extraLength
    files.set(new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength)), bytes.subarray(start, start + size))
    offset = start + size
  }
  return files
}
test('editable PPTX preserves all report chapters, diagram objects, XML escaping and media relationships', () => {
  for (const kind of ['product', 'compliance']) {
    const draft = planningTemplate(kind, key)
    draft.sections[0].body = '<待确认> & 人工\n' + '测试概念😀'.repeat(150)
    const png = new Uint8Array([137,80,78,71,13,10,26,10])
    const slides = planningSlides(kind, draft, inputs, [{ title: '产品图', data: png, width: 800, height: 600 }], true)
    const files = unzip(buildPlanningPptx(slides))
    const content = [...files.entries()].filter(([name]) => /^ppt\/slides\/slide\d+.xml$/.test(name)).map(([,data]) => new TextDecoder().decode(data)).join('\n')
    assert.equal(slides.length, [...files.keys()].filter(name => /^ppt\/slides\/slide\d+.xml$/.test(name)).length)
    for (const [title] of planningModules[kind]) assert.ok(content.includes(title))
    assert.match(content, /&lt;待确认&gt; &amp;/)
    assert.match(content, /依据已变化/)
    assert.ok(files.has('ppt/media/image1.png'))
    assert.match(new TextDecoder().decode(files.get('ppt/slides/_rels/slide2.xml.rels')), /rImage/)
    assert.ok(slides.some(slide => slide.diagram))
    assert.ok(slides.every(slide => slide.lines.length <= 12))
    assert.ok(!content.includes('�'))
  }
  assert.deepEqual(wrapReportText('😀'.repeat(40)).join(''), '😀'.repeat(40))
  assert.throws(() => buildPlanningPptx([]))
})

test('planning tasks pass the real authenticated loopback report relay with the selected model', async context => {
  const { createServer } = await import('node:http')
  const { modelApi } = await import('../server/modelApi.ts')
  let middleware, seen
  modelApi(async (_url, token, payload) => {
    seen = payload
    assert.equal(token, 'fixture-only-token')
    return { status: 200, data: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ sections: planningTemplate('product', key).sections }) } }] } }
  }).configureServer({ middlewares: { use: handler => { middleware = handler } } })
  const server = createServer((request, response) => middleware(request, response, () => response.writeHead(404).end()))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise(resolve => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  const payload = { stage: 'report', kind: 'planning', reportKind: 'product', inputs, context: key, baseUrl: 'https://example.com/v1', model: 'report-specific-model' }
  const response = await fetch(origin + '/api/inno-lit/develop', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: 'Bearer fixture-only-token' }, body: JSON.stringify(payload) })
  assert.equal(response.status, 200)
  assert.equal(parsePlanningSections((await response.json()).content, 'product').length, 12)
  assert.equal(seen.model, 'report-specific-model')
  assert.match(seen.messages[1].content, /硬件架构与 PCB 工程/)
  assert.doesNotMatch(JSON.stringify(seen), /fixture-only-token/)
})
