import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { modelApi } from '../server/modelApi.ts'
import { appendConceptRound, generateConceptBatch, sentenceLabels } from '../src/concepts.ts'
import { buildDesignReport, formatDesignReport } from '../src/designWork.ts'
import { chatCompletionUrl, generateWithModel, modelGenerationPath, parseModelConcepts } from '../src/modelGeneration.ts'

const brief = { problem: '课间放松', audience: '中学生', scenario: '教室', count: 3 }
const settings = { baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', apiKey: 'fixture-only-token' }
const generation = { model: settings.model, provider: 'api.deepseek.com' }
const concepts = ['翻面计时', '提示灯', '呼吸任务卡'].map(title => ({
  title,
  format: '桌面原型',
  idea: `用${title}完成短暂停顿。`,
  interaction: '学生在课间自行开始。',
  difference: `以${title}为主要机制。`,
  value: '可能让学生更容易开始休息。',
  risk: '提示可能被忽略。',
  test: '用纸板原型观察五名志愿者。',
}))

test('uses HTTPS provider URLs and preserves prefixes or full completion endpoints', () => {
  assert.equal(chatCompletionUrl('https://api.deepseek.com').href, 'https://api.deepseek.com/chat/completions')
  assert.equal(chatCompletionUrl('https://api.example.com/v1/').href, 'https://api.example.com/v1/chat/completions')
  assert.equal(chatCompletionUrl('https://api.example.com/v1/chat/completions').href, 'https://api.example.com/v1/chat/completions')
  for (const input of [
    'http://api.example.com', 'https://127.0.0.1', 'https://[::1]', 'https://gateway.internal',
    'https://user:pass@api.example.com', 'https://api.example.com/?token=secret', 'https://api.example.com/#key',
  ]) {
    assert.throws(() => chatCompletionUrl(input), /API 地址/)
  }
})

test('appends complete AI rounds alongside rule rounds and records only model provenance', () => {
  const ruleRound = generateConceptBatch(brief)
  const batch = parseModelConcepts(brief, generation, JSON.stringify({ concepts }))
  const state = appendConceptRound({ draft: brief, rounds: [ruleRound], activeRound: 0 }, batch)
  assert.equal(state.rounds[0], ruleRound)
  assert.equal(state.activeRound, 1)
  assert.deepEqual(batch.generation, generation)
  assert.equal(batch.selectedId, null)
  for (const concept of batch.concepts) {
    assert.deepEqual(Object.keys(concept.sentences), Object.keys(sentenceLabels))
    assert.deepEqual(concept.scores, { novelty: null, feasibility: null, value: null })
  }
  assert.ok(formatDesignReport(buildDesignReport('演示', batch, 2, batch.concepts[0]))
    .includes('AI · deepseek\\-flash（api\\.deepseek\\.com）'))
  assert.doesNotMatch(JSON.stringify(state), /fixture-only-token/)
})

test('rejects invalid, incomplete, and repeated concepts before creating a round', () => {
  for (const text of [
    'not JSON',
    JSON.stringify({ concepts: concepts.slice(1) }),
    JSON.stringify({ concepts: [{ ...concepts[0], risk: ' ' }, ...concepts.slice(1)] }),
    JSON.stringify({ concepts: [concepts[0], concepts[0], concepts[1]] }),
  ]) {
    assert.throws(() => parseModelConcepts(brief, generation, text), /不完整或有重复/)
  }
})

test('sends the user model settings through the local relay and validates the result', async context => {
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, modelGenerationPath)
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, `Bearer ${settings.apiKey}`)
    assert.equal(options.redirect, 'error')
    assert.deepEqual(JSON.parse(options.body), { brief, baseUrl: settings.baseUrl, model: settings.model })
    return Response.json({ content: JSON.stringify({ concepts }) })
  })
  assert.deepEqual((await generateWithModel(brief, settings, new AbortController().signal)).generation, generation)
})

test('relay accepts only its local origin, forwards the chosen model, and redacts provider errors', async context => {
  let attempts = 0
  let middleware
  modelApi(async (url, key, payload) => {
    attempts++
    assert.equal(url.href, 'https://api.deepseek.com/chat/completions')
    assert.equal(key, settings.apiKey)
    assert.equal(payload.model, settings.model)
    assert.deepEqual(payload.response_format, { type: 'json_object' })
    assert.doesNotMatch(JSON.stringify(payload), /fixture-only-token/)
    if (attempts === 2) return { status: 401, data: { error: settings.apiKey } }
    return { status: 200, data: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ concepts }) } }] } }
  }).configureServer({ middlewares: { use: handler => { middleware = handler } } })
  const server = createServer((request, response) => middleware(request, response, () => response.writeHead(404).end()))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise(resolve => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  const post = (requestOrigin, baseUrl = settings.baseUrl) => fetch(origin + modelGenerationPath, {
    method: 'POST',
    headers: { Origin: requestOrigin, 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify({ brief, baseUrl, model: settings.model }),
  })

  assert.equal((await post('https://example.org')).status, 403)
  assert.equal((await post(origin, 'https://127.0.0.1')).status, 400)
  assert.equal(attempts, 0)
  const success = await post(origin)
  assert.equal(success.status, 200)
  assert.equal(success.headers.get('cache-control'), 'no-store')
  assert.deepEqual(JSON.parse((await success.json()).content), { concepts })
  const failure = await post(origin)
  assert.equal(failure.status, 502)
  const error = await failure.text()
  assert.match(error, /检查 API 密钥/)
  assert.doesNotMatch(error, /fixture-only-token/)
})
