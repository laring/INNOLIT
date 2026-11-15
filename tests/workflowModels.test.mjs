import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { createEmptyRouting, createEmptyWorkflowRouting, resolveWorkflowModels, workflowTasks } from '../src/aiModelRouter.ts'
import { parseModelObject } from '../src/modelJson.ts'
import { generateConceptBatch } from '../src/concepts.ts'
import { freezeConcept, developmentOf } from '../src/conceptDevelopment.ts'
import { assistDevelopment, synthesizeConcept } from '../src/developmentModel.ts'
import { generateWithModel, modelChatPath, modelDevelopmentPath, modelGenerationPath } from '../src/modelGeneration.ts'
import { replyWithModel } from '../src/modelChat.ts'
import { generateConceptImage, imageGenerationPath } from '../src/imageGeneration.ts'
import { frozenVisualInput, translateVisualWithAI, visualConceptOf, visualTranslationPrompt } from '../src/visualPromptAI.ts'
import { draftDesignReport, reportContext } from '../src/reportModel.ts'
import { modelApi } from '../server/modelApi.ts'
import { brief, developedConcept, responseFor } from './fixtures/development.mjs'

const text = { baseUrl: 'https://api.example.com/v1', model: 'default-text', apiKey: 'fixture-only-token' }
const image = { ...text, model: 'default-image', protocol: 'siliconflow', size: '1024x1024' }
const signal = () => new AbortController().signal
const prompt = 'A quiet classroom desk product with one clear interaction and a consistent shape. No unsupported performance claims.'

test('eight workflow models override legacy routes independently and clearing restores the original fallback', () => {
  const legacy = { ...createEmptyRouting(), concept: { ...text, model: 'old-creative' }, refinement: { ...text, model: 'old-refinement' }, translation: { ...text, model: 'old-translation' }, image: { ...image, model: 'old-image' } }
  const workflow = createEmptyWorkflowRouting()
  const inherited = resolveWorkflowModels(workflow, legacy, text, image)
  assert.equal(inherited.home.model, 'old-creative')
  assert.equal(inherited.optimization.model, 'old-refinement')
  assert.equal(inherited.visual.model, 'old-image')
  for (const task of Object.keys(workflowTasks)) workflow[task] = { ...(task === 'visual' ? image : text), model: task }
  const routed = resolveWorkflowModels(workflow, legacy, text, image)
  for (const task of Object.keys(workflowTasks)) assert.equal(routed[task].model, task)
  assert.equal(routed.translation.model, 'old-translation')
  workflow.feasibility = null
  assert.equal(resolveWorkflowModels(workflow, legacy, text, image).feasibility.model, 'old-refinement')
  assert.equal(legacy.refinement.model, 'old-refinement')
})

test('JSON parser accepts wrappers and quoted braces but rejects arrays, malformed and truncated responses', () => {
  const value = { prompt: prompt + ' "{indicator}"', warnings: [] }
  for (const content of [JSON.stringify(value), '```json\n' + JSON.stringify(value) + '\n```', '说明\n' + JSON.stringify(value) + '\n结束 {说明}']) assert.deepEqual(parseModelObject(content), value)
  for (const content of ['[]', '[{"prompt":"nested"}]', '{"prompt":"unterminated', '{"prompt":}', 'no object']) assert.throws(() => parseModelObject(content, '视觉转译模型'), /有效的 JSON/)
  assert.throws(() => parseModelObject(' '), /空内容/)
})

test('visual translation works on drafts and optimized concepts, validates fields and preserves genuine frozen constraints', async context => {
  const concept = generateConceptBatch(brief).concepts[0]
  const draft = visualConceptOf(concept)
  assert.equal(draft.locked, false)
  assert.doesNotThrow(() => visualTranslationPrompt(frozenVisualInput(draft, 'concept', 1600, 1000), 'test-model'))
  let response = '```json\n' + JSON.stringify({ prompt, warnings: ['draft only'] }) + '\n```'
  context.mock.method(globalThis, 'fetch', async () => Response.json({ content: response }))
  const result = await translateVisualWithAI(draft, 'concept', 1600, 1000, text, signal())
  assert.match(result.prompt, /DRAFT, NOT FROZEN/)
  for (const [value, error] of [[{}, /缺少 prompt/], [{ prompt: 'tiny' }, /过短/], [{ prompt: 'x'.repeat(16001) }, /超过/]]) {
    response = JSON.stringify(value)
    await assert.rejects(translateVisualWithAI(draft, 'concept', 1600, 1000, text, signal()), error)
  }
  response = JSON.stringify({ prompt: 'x'.repeat(13980) })
  await assert.rejects(translateVisualWithAI(draft, 'concept', 1600, 1000, text, signal()), /14000/)
  const optimized = developedConcept()
  assert.equal(visualConceptOf(optimized).design.title, optimized.development.final.title)
  const frozen = visualConceptOf(freezeConcept(optimized, 'real-freeze', 1))
  assert.equal(frozen.locked, true)
  assert.throws(() => visualTranslationPrompt(frozenVisualInput({ ...frozen, identity: { ...frozen.identity, shape: '' } }, 'board', 1600, 1000), 'test-model'), /缺少 shape/)
})

test('all eight selected models reach their actual clients, with optional freeze and editable report provenance', async context => {
  const workflow = createEmptyWorkflowRouting()
  for (const task of Object.keys(workflowTasks)) workflow[task] = { ...(task === 'visual' ? image : text), model: `route-${task}` }
  const models = resolveWorkflowModels(workflow, createEmptyRouting(), text, image)
  const seen = []
  const concept = generateConceptBatch(brief).concepts[0]
  const round = generateConceptBatch(brief)
  context.mock.method(globalThis, 'fetch', async (path, options) => {
    const input = JSON.parse(options.body)
    seen.push(input.model)
    assert.doesNotMatch(options.body, /fixture-only-token/)
    if (path === imageGenerationPath) return new Response(new Uint8Array([137,80,78,71,13,10,26,10]), { headers: { 'Content-Type': 'image/png' } })
    let data
    if (path === modelChatPath) return Response.json({ content: '测试创意' })
    if (path === modelGenerationPath) data = { concepts: round.concepts.map(item => ({ title: item.title, format: item.format, ...item.sentences })) }
    else if (input.stage === 'report') data = { report: '根据现有记录整理；尚未实测，检索与冻结均未完成。' }
    else if (input.stage === 'visual-translation') data = { prompt }
    else data = responseFor(input.stage, input)
    return Response.json({ content: JSON.stringify(data) })
  })
  await replyWithModel([], '一个设计想法', models.home, signal())
  await generateWithModel(brief, models.conceptStudio, signal())
  await assistDevelopment(concept, 'notes', models.notes, signal())
  await assistDevelopment(concept, 'validation', models.feasibility, signal())
  await assistDevelopment(concept, 'research', models.originality, signal())
  const optimized = await synthesizeConcept(concept, models.optimization, signal())
  assert.equal(concept.development, undefined)
  concept.development = { ...developmentOf(concept), final: optimized.final, identity: optimized.identity }
  await translateVisualWithAI(visualConceptOf(concept), 'concept', 1600, 1000, models.translation, signal())
  await generateConceptImage(models.visual, prompt, signal(), { purpose: 'concept' })
  const report = await draftDesignReport('项目', round, 1, concept, models.report, signal())
  assert.match(report.text, /尚未实测/)
  assert.equal(report.source.model, 'route-report')
  assert.equal(report.contextKey, reportContext(concept))
  concept.notes += '人工新记录'
  assert.notEqual(report.contextKey, reportContext(concept))
  assert.deepEqual(seen, ['route-home', 'route-conceptStudio', 'route-notes', 'route-feasibility', 'route-originality', 'route-optimization', 'default-text', 'route-visual', 'route-report'])
})

test('local model relay accepts draft visual translation and report tasks without a frozen snapshot', async context => {
  let middleware
  const seen = []
  modelApi(async (_url, _key, payload) => {
    seen.push(payload)
    return { status: 200, data: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ prompt, report: '尚未实测。' }) } }] } }
  }).configureServer({ middlewares: { use: handler => { middleware = handler } } })
  const server = createServer((request, response) => middleware(request, response, () => response.writeHead(404).end()))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise(resolve => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  const post = input => fetch(origin + modelDevelopmentPath, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: 'Bearer fixture-only-token' }, body: JSON.stringify({ ...input, ...text, apiKey: undefined }) })
  assert.equal((await post(frozenVisualInput(visualConceptOf(generateConceptBatch(brief).concepts[0]), 'concept', 1600, 1000))).status, 200)
  assert.equal((await post({ stage: 'report', sections: [{ heading: '实测', entries: [{ label: '状态', value: '尚未实测' }] }] })).status, 200)
  assert.equal(seen.length, 2)
  assert.match(seen[1].messages[0].content, /不编造实测/)
})
