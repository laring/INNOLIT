import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { modelApi } from '../server/modelApi.ts'
import { confirmStep, developmentOf, freezeConcept, freezeProblems, reopenConcept, stepConfirmed } from '../src/conceptDevelopment.ts'
import { assistDevelopment, developmentInput, developmentPrompt, parseDevelopmentAdvice, synthesizeConcept } from '../src/developmentModel.ts'
import { buildDesignReport, formatDesignReport } from '../src/designWork.ts'
import { generateConceptBatch } from '../src/concepts.ts'
import { modelDevelopmentPath } from '../src/modelGeneration.ts'
import { brief, developedConcept, responseFor, source } from './fixtures/development.mjs'

test('development confirmation requires AI participation and becomes stale after manual edits', () => {
  let concept = developedConcept()
  assert.equal(stepConfirmed(concept, 'notes'), true)
  concept.notes += '增加操作风险'
  assert.equal(stepConfirmed(concept, 'notes'), false)
  assert.ok(freezeProblems(concept).some(item => item.includes('深化笔记')))
  concept = confirmStep(concept, 'notes')
  assert.equal(stepConfirmed(concept, 'notes'), true)
  assert.ok(freezeProblems(concept).some(item => item.includes('最新的三步记录')))
  delete concept.development.advice.validation
  assert.equal(stepConfirmed(confirmStep(concept, 'validation'), 'validation'), false)
  assert.throws(() => freezeConcept(concept, 'freeze', 1), /需要 AI 参与/)
})

test('freeze snapshots are independent, keep untested status truthful, and retain revision history', () => {
  const original = developedConcept()
  assert.deepEqual(freezeProblems(original), [])
  const locked = freezeConcept(original, 'freeze-1', 1000)
  original.development.identity.shape = '另一个造型'
  original.research.evidence[0].comparison = '修改原始证据'
  original.scores.novelty = 5
  assert.equal(locked.development.frozen.identity.shape, '圆角矩形翻面牌，R8 圆角')
  assert.equal(locked.development.frozen.research.evidence[0].comparison, '用户核对后认为触发方式不同。')
  assert.equal(locked.development.frozen.validation.outcome, 'pending')
  assert.equal(locked.development.frozen.scores.novelty, null)
  assert.equal(freezeConcept(locked, 'replace', 2000), locked)
  const reopened = reopenConcept(freezeConcept(developedConcept(), 'freeze-1', 1000))
  assert.equal(reopened.development.frozen, undefined)
  assert.equal(reopened.development.history[0].id, 'freeze-1')
  reopened.development.identity = { ...reopened.development.identity, shape: '圆角矩形翻面牌，R10 圆角' }
  const revised = freezeConcept(reopened, 'freeze-2', 3000)
  assert.equal(revised.development.frozen.revision, 2)
  assert.equal(revised.development.history[0].identity.shape, '圆角矩形翻面牌，R8 圆角')
  const report = formatDesignReport(buildDesignReport('测试项目', generateConceptBatch(brief), 1, locked))
  assert.match(report, /freeze\\-1/)
  assert.match(report, /尚未提供实测记录/)
  assert.match(report, /人工已|已确认当前记录/)
  assert.doesNotMatch(report, /修改原始证据/)
})

test('freeze requires concrete product identity and a complete optimized concept', () => {
  const concept = developedConcept()
  concept.development.identity.proportions = '尺寸待确认'
  assert.throws(() => freezeConcept(concept, 'f', 1), /待确认参数/)
  concept.development.identity.proportions = '90×60×12 mm'
  concept.development.final.sentences.idea = ''
  assert.throws(() => freezeConcept(concept, 'f', 1), /补齐完善方案/)
  assert.equal(developmentOf(generateConceptBatch(brief).concepts[0]).history.length, 0)
})

test('research AI cannot introduce sources outside supplied evidence and cannot fill actual observations', () => {
  const concept = developedConcept()
  const references = concept.research.evidence
  assert.throws(() => parseDevelopmentAdvice(JSON.stringify({ ...responseFor('research'), comparisons: [{ id: 'invented', comparison: '伪造来源' }] }), concept, 'research', source, references), /不属于本次检索/)
  const research = parseDevelopmentAdvice(JSON.stringify({ ...responseFor('research', { references }), comparisons: [{ id: 'e1', comparison: '只比较已有来源', url: 'https://forged.example' }] }), concept, 'research', source, references)
  assert.equal(research.references[0].url, references[0].url)
  const feasibility = parseDevelopmentAdvice(JSON.stringify({ ...responseFor('validation'), observations: '模型伪造实测', outcome: 'pass' }), concept, 'validation', source, [])
  assert.deepEqual(Object.keys(feasibility.validation), ['prototype', 'method', 'criteria'])
  assert.doesNotMatch(JSON.stringify(feasibility), /模型伪造实测/)
  assert.throws(() => developmentPrompt({ stage: 'research', design: concept, references: [{ id: 'x', title: 'x', url: 'file:///private' }] }, 'fixture'), /真实检索记录/)
})

test('model helpers send bounded design records without credentials and validate editable synthesis', async context => {
  const concept = developedConcept()
  const settings = { baseUrl: 'https://api.example.com/v1', model: source.model, apiKey: 'fixture-only-key' }
  context.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, modelDevelopmentPath)
    assert.equal(options.headers.Authorization, 'Bearer fixture-only-key')
    assert.doesNotMatch(options.body, /fixture-only-key|confirmedContent|contextKey/)
    const input = JSON.parse(options.body)
    return Response.json({ content: JSON.stringify(responseFor(input.stage, input)) })
  })
  const advice = await assistDevelopment(concept, 'notes', settings, new AbortController().signal)
  assert.equal(advice.source.provider, 'api.example.com')
  assert.equal(advice.confirmedContent, undefined)
  const result = await synthesizeConcept(concept, settings, new AbortController().signal)
  assert.equal(Object.keys(result.final.sentences).length, 9)
  assert.equal(result.identity.proportions, '90×60×12 mm')
})

test('development route applies the same loopback restrictions and structured model transport', async context => {
  let middleware
  let attempts = 0
  modelApi(async (_url, key, payload) => {
    attempts++
    assert.equal(key, 'fixture-only-key')
    assert.deepEqual(payload.response_format, { type: 'json_object' })
    assert.match(payload.messages[0].content, /严禁编造实测/)
    return { status: 200, data: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(responseFor('notes')) } }] } }
  }).configureServer({ middlewares: { use: handler => { middleware = handler } } })
  const server = createServer((request, response) => middleware(request, response, () => response.writeHead(404).end()))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise(resolve => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  const post = requestOrigin => fetch(origin + modelDevelopmentPath, { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json', Authorization: 'Bearer fixture-only-key' }, body: JSON.stringify({ ...developmentInput(developedConcept(), 'notes'), baseUrl: 'https://api.example.com', model: source.model }) })
  assert.equal((await post('https://other.example')).status, 403)
  assert.equal((await post(origin)).status, 200)
  assert.equal(attempts, 1)
})
