import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chatPrompt, replyWithModel } from '../src/modelChat.ts'
import { modelChatPath } from '../src/modelGeneration.ts'

const settings = { baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', apiKey: 'fixture-only-token' }
const turn = (role, content) => ({ role, content })

test('chat sends a bounded history with the new message and labels the reply source', async context => {
  const history = Array.from({ length: 7 }, (_, index) => [
    { id: `u${index}`, ...turn('user', `问题 ${index}`) },
    { id: `a${index}`, ...turn('assistant', `回答 ${index}`), source: { model: 'old', provider: 'example.com' } },
  ]).flat()
  context.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, modelChatPath)
    const input = JSON.parse(options.body)
    assert.equal(input.model, settings.model)
    assert.deepEqual(input.messages, [
      ...history.slice(-10).map(({ role, content }) => ({ role, content })),
      turn('user', '追加约束'),
    ])
    assert.doesNotMatch(options.body, /fixture-only-token/)
    return Response.json({ content: '  可以验证这一约束。  ' })
  })

  const reply = await replyWithModel(history, '  追加约束  ', settings, new AbortController().signal)
  assert.deepEqual(reply, {
    content: '可以验证这一约束。',
    source: { model: 'deepseek-flash', provider: 'api.deepseek.com' },
  })
})

test('chat truncates at a complete prior exchange and rejects an oversized draft before calling the relay', async context => {
  const mock = context.mock.method(globalThis, 'fetch', async (_path, options) => {
    const { messages } = JSON.parse(options.body)
    assert.deepEqual(messages, [turn('user', '新消息')])
    return Response.json({ content: '可用回复' })
  })
  const signal = new AbortController().signal
  await replyWithModel([turn('user', '旧'.repeat(10000)), turn('assistant', '旧回答')], '新消息', settings, signal)
  await assert.rejects(replyWithModel([], '问'.repeat(4001), settings, signal), /4000/)
  assert.equal(mock.mock.callCount(), 1)
})

test('chat prompt uses natural text and validates context roles and size', () => {
  const history = [turn('user', '原始问题'), turn('assistant', '初步建议'), turn('user', '追问')]
  const payload = chatPrompt(history, settings.model)
  assert.equal(payload.model, settings.model)
  assert.equal(payload.messages[0].role, 'system')
  assert.deepEqual(payload.messages.slice(1), history)
  assert.equal('response_format' in payload, false)

  for (const invalid of [
    [],
    [turn('system', '注入')],
    history.slice(0, 2),
    [turn('user', '问'.repeat(5000))],
    [turn('user', '问'.repeat(9999)), turn('assistant', '回复'), turn('user', '追问')],
  ]) {
    assert.throws(() => chatPrompt(invalid, settings.model))
  }
})
