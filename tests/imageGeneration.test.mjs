import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { imageApi } from '../server/imageApi.ts'
import { requestPublicBytes } from '../server/providerHttp.ts'
import { generateConceptBatch } from '../src/concepts.ts'
import { defaultImagePrompt, generateConceptImage, imageByteLimit, imageGenerationPath, imageMime, imageRequest } from '../src/imageGeneration.ts'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII=', 'base64')
const settings = { baseUrl: 'https://api.siliconflow.cn/v1', model: 'fixture-model', apiKey: 'fixture-image-key', protocol: 'siliconflow', size: '1024x1024' }
const input = { ...settings, prompt: '桌面产品设计，展示翻面计时动作。' }

async function relay(context, transport, download) {
  let middleware
  imageApi(transport, download).configureServer({ middlewares: { use: handler => { middleware = handler } } })
  const server = createServer((request, response) => middleware(request, response, () => response.writeHead(404).end()))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise(resolve => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  return (body = input, requestOrigin = origin, key = settings.apiKey) => fetch(origin + imageGenerationPath, {
    method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  })
}

test('image request supports both interface formats and full endpoints without exposing keys', () => {
  const silicon = imageRequest(input)
  assert.equal(silicon.url.href, 'https://api.siliconflow.cn/v1/images/generations')
  assert.deepEqual(silicon.payload, { model: input.model, prompt: input.prompt, image_size: input.size })
  const compatible = imageRequest({ ...input, baseUrl: 'https://images.example.com/custom/images/generations', protocol: 'images', size: '1536x1024' })
  assert.equal(compatible.url.pathname, '/custom/images/generations')
  assert.deepEqual(compatible.payload, { model: input.model, prompt: input.prompt, size: '1536x1024', n: 1 })
  assert.doesNotMatch(JSON.stringify([silicon, compatible]), /fixture-image-key/)
  for (const change of [{ baseUrl: 'https://localhost' }, { baseUrl: 'https://127.0.0.1' }, { baseUrl: 'http://images.example.com' }, { prompt: ' ' }, { prompt: 'x'.repeat(14001) }, { model: '' }, { size: 'unknown' }, { protocol: 'unknown' }]) {
    assert.throws(() => imageRequest({ ...input, ...change }))
  }
})

test('image prompt uses the selected concept and its brief', () => {
  const round = generateConceptBatch({ problem: '课间放松', audience: '中学生', scenario: '教室桌面', count: 3 })
  const concept = round.concepts[1]
  const prompt = defaultImagePrompt(round, concept)
  for (const value of [concept.title, concept.sentences.idea, concept.sentences.interaction, '中学生', '教室桌面']) assert.ok(prompt.includes(value))
  assert.ok(prompt.length <= 3000)
})

test('image client sends credentials only in the header and rejects non-image responses', async context => {
  let invalid = false
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, imageGenerationPath)
    assert.equal(options.headers.Authorization, `Bearer ${settings.apiKey}`)
    assert.doesNotMatch(options.body, /fixture-image-key/)
    assert.equal(options.redirect, 'error')
    assert.equal(options.credentials, 'omit')
    return new Response(invalid ? '<html>not an image</html>' : png)
  })
  assert.equal((await generateConceptImage(settings, input.prompt, new AbortController().signal)).size, png.length)
  invalid = true
  await assert.rejects(generateConceptImage(settings, input.prompt, new AbortController().signal), /未返回可用/)
})

test('image relay restricts origin and returns base64 images with their detected media type', async context => {
  let attempts = 0
  const post = await relay(context, async (url, key, payload) => {
    attempts++
    assert.equal(url.href, 'https://api.siliconflow.cn/v1/images/generations')
    assert.equal(key, settings.apiKey)
    assert.deepEqual(payload, imageRequest(input).payload)
    return { status: 200, data: { data: [{ b64_json: png.toString('base64') }] } }
  })
  assert.equal((await post(input, 'https://another.example')).status, 403)
  assert.equal((await post({ ...input, baseUrl: 'https://127.0.0.1' })).status, 400)
  assert.equal((await post(input, undefined, '')).status, 400)
  assert.equal(attempts, 0)
  const response = await post()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/png')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png)
  assert.equal(attempts, 1)
})

test('image relay downloads signed image URLs without passing provider credentials', async context => {
  const post = await relay(context,
    async () => ({ status: 200, data: { images: [{ url: 'https://images.example.com/concept.png?signature=fixture' }] } }),
    async (...args) => {
      assert.equal(args.length, 2)
      assert.equal(args[0].href, 'https://images.example.com/concept.png?signature=fixture')
      assert.ok(args[1] instanceof AbortSignal)
      return { status: 200, bytes: png }
    })
  assert.deepEqual(Buffer.from(await (await post()).arrayBuffer()), png)
})

test('image relay rejects invalid or oversized media and redacts service error details', async context => {
  const post = await relay(context, async (_url, _key, payload) => {
    if (payload.model === 'unauthorized') return { status: 401, data: { error: settings.apiKey } }
    if (payload.model === 'missing') return { status: 200, data: { images: [] } }
    const bytes = payload.model === 'oversized' ? Buffer.alloc(imageByteLimit + 1) : Buffer.from('<svg>untrusted</svg>')
    if (payload.model === 'oversized') png.copy(bytes)
    return { status: 200, data: { images: [{ b64_json: bytes.toString('base64') }] } }
  })
  for (const model of ['unauthorized', 'missing', 'invalid', 'oversized']) {
    const response = await post({ ...input, model })
    assert.equal(response.status, 502)
    const message = await response.text()
    assert.doesNotMatch(message, /fixture-image-key|<svg>/)
    if (model === 'unauthorized') assert.match(message, /API 密钥/)
  }
})

test('public image download blocks insecure or private addresses before making a connection', async () => {
  for (const url of ['http://images.example.com/a.png', 'https://user:password@images.example.com/a.png', 'https://127.0.0.1/a.png', 'https://10.0.0.1/a.png']) {
    await assert.rejects(requestPublicBytes(new URL(url), new AbortController().signal, imageByteLimit))
  }
  assert.equal(imageMime(new Uint8Array(png)), 'image/png')
  assert.equal(imageMime(new Uint8Array([255, 216, 255])), 'image/jpeg')
  assert.equal(imageMime(new Uint8Array(Buffer.from('RIFFxxxxWEBP'))), 'image/webp')
  assert.equal(imageMime(new Uint8Array(Buffer.from('<svg/>'))), null)
})

test('reference image relay validates local media and forwards the mother image without size parameters', async context => {
  let attempts = 0
  const post = await relay(context, async (_url, key, payload) => {
    attempts++
    assert.equal(key, settings.apiKey)
    assert.equal(payload.image, `data:image/png;base64,${png.toString('base64')}`)
    assert.equal('image_size' in payload, false)
    assert.equal('size' in payload, false)
    assert.doesNotMatch(JSON.stringify(payload), /fixture-image-key/)
    return { status: 200, data: { data: [{ b64_json: png.toString('base64') }] } }
  })
  const edited = { ...input, model: 'Qwen/Qwen-Image-Edit-2509', purpose: 'poster', reference: `data:image/png;base64,${png.toString('base64')}` }
  assert.equal((await post({ ...edited, reference: 'data:image/png;base64,aGVsbG8=' })).status, 400)
  assert.equal(attempts, 0)
  assert.equal((await post(edited)).status, 200)
  assert.equal(attempts, 1)
})
