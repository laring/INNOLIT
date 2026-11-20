import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { imageApi, imageServiceKey } from '../server/imageApi.ts'
import { createEmptyRouting, createEmptyWorkflowRouting, resolveWorkflowModels } from '../src/aiModelRouter.ts'
import { imageConfigurationLabel } from '../src/imageConfiguration.ts'
import { generateConceptImage, imageGenerationPath, imageRequest } from '../src/imageGeneration.ts'
import { hasModelSettings } from '../src/modelGeneration.ts'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII=', 'base64')
const defaults = { baseUrl: 'https://api.siliconflow.cn/v1', model: 'default-image', apiKey: 'default-fixture-key', protocol: 'siliconflow', size: '1024x1024' }

test('image configuration summary and request settings resolve the same complete configuration, including independent empty keys', () => {
  const legacy = createEmptyRouting(), workflow = createEmptyWorkflowRouting()
  for (const source of ['default', 'legacy', 'workflow']) {
    if (source === 'legacy') legacy.image = { ...defaults, model: 'legacy-image', apiKey: 'legacy-fixture-key' }
    if (source === 'workflow') workflow.visual = { ...defaults, model: 'workflow-image', apiKey: 'workflow-fixture-key' }
    const image = resolveWorkflowModels(workflow, legacy, defaults, defaults).visual
    const label = imageConfigurationLabel(workflow, legacy, defaults)
    assert.ok(label.includes(image.model)); assert.ok(label.includes('密钥已填写'))
    assert.ok(!label.includes(image.apiKey))
    assert.equal(image, source === 'workflow' ? workflow.visual : source === 'legacy' ? legacy.image : defaults)
  }
  workflow.visual.apiKey = ''
  assert.equal(hasModelSettings(resolveWorkflowModels(workflow, legacy, defaults, defaults).visual), false)
  assert.match(imageConfigurationLabel(workflow, legacy, defaults), /独立配置.*密钥未填写/)
})

test('browser image credentials take precedence for every protocol, with server fallback retained only for legacy callers', () => {
  const environment = { OPENAI_API_KEY: 'server-openai', OPENROUTER_API_KEY: 'server-router' }
  for (const protocol of ['siliconflow', 'images', 'openai', 'openrouter']) assert.equal(imageServiceKey(protocol, 'Bearer browser-fixture', environment), 'browser-fixture')
  assert.equal(imageServiceKey('openai', undefined, environment), 'server-openai')
  assert.equal(imageServiceKey('openrouter', undefined, environment), 'server-router')
  assert.equal(imageServiceKey('images', undefined, environment), undefined)
  for (const protocol of ['siliconflow', 'images', 'openai', 'openrouter']) assert.equal(hasModelSettings({ ...defaults, protocol, apiKey: '' }), false)
  assert.throws(() => imageRequest({ ...defaults, protocol: 'openai', baseUrl: 'https://custom.example/v1', prompt: 'test' }), /自定义服务/)
})

test('all four image protocols carry the configured browser key through the real local relay to provider adapters', async context => {
  const nativeFetch = globalThis.fetch
  const received = []
  let middleware
  imageApi(async (_url, key, payload) => { received.push({ key, model: payload.model }); return { status: 200, data: { data: [{ b64_json: png.toString('base64') }] } } }).configureServer({ middlewares: { use: handler => { middleware = handler } } })
  const server = createServer((request, response) => middleware(request, response, () => response.writeHead(404).end()))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); context.after(() => new Promise(resolve => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === imageGenerationPath) {
      assert.ok(!options.body.includes('fixture-key'))
      return nativeFetch(origin + url, { ...options, headers: { ...options.headers, Origin: origin } })
    }
    const body = JSON.parse(options.body)
    received.push({ key: options.headers.Authorization.replace('Bearer ', ''), model: body.model })
    return Response.json({ data: [{ b64_json: png.toString('base64') }] })
  })
  for (const protocol of ['siliconflow', 'images', 'openai', 'openrouter']) {
    const settings = { ...defaults, protocol, apiKey: `${protocol}-fixture-key`, model: protocol === 'openrouter' ? 'recraft/recraft-v4.1-flash-v2:free' : `${protocol}-fixture-model`, baseUrl: protocol === 'openai' ? 'https://api.openai.com/v1' : protocol === 'openrouter' ? 'https://openrouter.ai/api/v1' : defaults.baseUrl }
    assert.equal((await generateConceptImage(settings, 'configuration regression test', new AbortController().signal)).size, png.length)
    assert.deepEqual(received.at(-1), { key: settings.apiKey, model: settings.model })
  }
  assert.equal(received.length, 4)
  await assert.rejects(generateConceptImage({ ...defaults, apiKey: '' }, 'test', new AbortController().signal), /AI 模型中心/)
})
