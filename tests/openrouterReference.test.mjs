import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { imageApi } from '../server/imageApi.ts'
import { imageRequest, supportsImageReference, imageGenerationPath, generateConceptImage } from '../src/imageGeneration.ts'
import { generateOpenRouterImage } from '../server/openrouterImageAdapter.ts'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII=', 'base64')
const reference = 'data:image/png;base64,' + png.toString('base64')
const settings = { baseUrl: 'https://openrouter.ai/api/v1', protocol: 'openrouter', model: 'fixture/reference-image-model', apiKey: 'fixture-router-key', size: '1024x1024' }

test('OpenRouter reference support is no longer blocked by the client or restricted to a single Recraft model', () => {
  assert.equal(supportsImageReference(settings), true)
  assert.doesNotThrow(() => imageRequest({ ...settings, reference, prompt: 'Generate ten sketches from this style reference.', purpose: 'concept' }))
  assert.doesNotThrow(() => imageRequest({ ...settings, reference, prompt: 'Preserve the chosen product.', purpose: 'portrait' }))
})

test('no-reference drawing sends only required fields and does not query reference capabilities', async context => {
  let calls = 0
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++
    assert.equal(url, 'https://openrouter.ai/api/v1/images')
    assert.deepEqual(JSON.parse(options.body), { model: settings.model, prompt: 'ten sketches without any image' })
    return Response.json({ data: [{ b64_json: png.toString('base64') }] })
  })
  await generateOpenRouterImage({ ...settings, prompt: 'ten sketches without any image' }, settings.apiKey, new AbortController().signal)
  assert.equal(calls, 1)
})

test('400 errors retain the actual provider reason, redact private inputs and never retry generation automatically', async context => {
  let calls = 0
  context.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/images/models')) return Response.json({ data: [] })
    calls++
    return Response.json({ error: { message: `input_references is not supported by this endpoint; token=${settings.apiKey}; image=${reference}` } }, { status: 400 })
  })
  await assert.rejects(generateOpenRouterImage({ ...settings, prompt: 'style', reference }, settings.apiKey, new AbortController().signal), error => {
    assert.match(error.message, /input_references is not supported/)
    assert.ok(!error.message.includes(settings.apiKey)); assert.ok(!error.message.includes(reference))
    assert.match(error.message, /未自动重试/)
    return true
  })
  assert.equal(calls, 1)
})

test('OpenRouter forwards the exact reference with the official input_references schema and selected credentials', async context => {
  let count = 0
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/images/models')) return Response.json({ data: [{ id: settings.model, architecture: { input_modalities: ['text', 'image'], output_modalities: ['image'] } }] })
    assert.equal(url, 'https://openrouter.ai/api/v1/images')
    assert.equal(options.headers.Authorization, 'Bearer fixture-router-key')
    const body = JSON.parse(options.body)
    assert.equal(body.model, settings.model)
    assert.deepEqual(body.input_references, [{ type: 'image_url', image_url: { url: reference } }])
    assert.equal('image' in body, false)
    count++
    return Response.json({ data: [{ b64_json: png.toString('base64') }] })
  })
  assert.deepEqual(Buffer.from(await generateOpenRouterImage({ ...settings, prompt: 'style sketch', reference }, settings.apiKey, new AbortController().signal)), png)
  assert.equal(count, 1)
})

test('provider-declared text-only image models report their exact limitation before any generation request', async context => {
  let generations = 0
  context.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/images/models')) return Response.json({ data: [{ id: settings.model, architecture: { input_modalities: ['text'], output_modalities: ['image'] } }] })
    generations++; return Response.json({})
  })
  await assert.rejects(generateOpenRouterImage({ ...settings, prompt: 'style', reference }, settings.apiKey, new AbortController().signal), /支持绘图.*不接收参考图片/)
  assert.equal(generations, 0)
})

test('full local relay preserves the reference image through client validation, authentication and provider dispatch', async context => {
  let middleware, forwarded = false
  const nativeFetch = globalThis.fetch
  imageApi().configureServer({ middlewares: { use: handler => { middleware = handler } } })
  const server = createServer((req, res) => middleware(req, res, () => res.writeHead(404).end()))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); context.after(() => new Promise(resolve => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === imageGenerationPath) return nativeFetch(origin + url, { ...options, headers: { ...options.headers, Origin: origin } })
    if (url.endsWith('/images/models')) return Response.json({ data: [{ id: settings.model, architecture: { input_modalities: ['image', 'text'] } }] })
    const body = JSON.parse(options.body)
    assert.equal(body.input_references[0].image_url.url, reference)
    assert.equal(options.headers.Authorization, 'Bearer fixture-router-key')
    forwarded = true
    return Response.json({ data: [{ b64_json: png.toString('base64') }] })
  })
  assert.equal((await generateConceptImage(settings, 'Generate ten sketches.', new AbortController().signal, { reference, purpose: 'concept' })).size, png.length)
  assert.equal(forwarded, true)
})
