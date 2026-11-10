import { lookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { BlockList } from 'node:net'
import type { Plugin } from 'vite'
import { requireConceptBrief } from '../src/concepts.ts'
import type { ConceptDraft } from '../src/concepts.ts'
import { chatCompletionUrl, modelGenerationPath, modelPrompt, objectRecord } from '../src/modelGeneration.ts'

type ModelTransport = (
  url: URL, key: string, payload: ReturnType<typeof modelPrompt>, signal: AbortSignal,
) => Promise<{ status: number; data?: unknown }>

const privateIPv4 = new BlockList()
for (const [address, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['224.0.0.0', 3],
] as const) privateIPv4.addSubnet(address, bits)
const publicIPv6 = new BlockList()
publicIPv6.addSubnet('2000::', 3, 'ipv6')
const specialIPv6 = new BlockList()
specialIPv6.addSubnet('2001::', 23, 'ipv6')
specialIPv6.addSubnet('2002::', 16, 'ipv6')

async function readJson(stream: IncomingMessage, limit: number): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of stream.iterator({ destroyOnReturn: false })) {
    size += chunk.length
    if (size > limit) {
      stream.destroy()
      throw new Error('内容超出大小限制。')
    }
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const requestProvider: ModelTransport = async (url, key, payload, signal) => {
  const addresses = await lookup(url.hostname, { all: true })
  const target = addresses.find(({ address, family }) => family === 4
    ? !privateIPv4.check(address)
    : publicIPv6.check(address, 'ipv6') && !specialIPv6.check(address, 'ipv6'))
  if (!target) throw new Error('服务地址未指向公开网络。')
  signal.throwIfAborted()

  // Connect to the address just checked while retaining the provider's TLS hostname.
  const body = JSON.stringify(payload)
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      hostname: target.address,
      servername: url.hostname,
      method: 'POST',
      agent: false,
      signal,
      headers: {
        Host: url.host,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, response => {
      const status = response.statusCode ?? 502
      if (status < 200 || status >= 300) {
        response.destroy()
        resolve({ status })
        return
      }
      readJson(response, 256 * 1024).then(data => resolve({ status, data }), reject)
    })
    request.on('error', reject)
    request.end(body)
  })
}

function send(response: ServerResponse, status: number, body: { content: string } | { error: string }) {
  if (response.destroyed) return
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

function isLocalRequest(request: IncomingMessage): boolean {
  const host = request.headers.host ?? ''
  const address = request.socket.remoteAddress ?? ''
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)
    && /^(localhost|127\.0\.0\.1)(:\d+)?$/u.test(host)
    && request.headers.origin === `http://${host}`
}

function providerError(status: number): string {
  if (status === 401 || status === 403) return '服务商拒绝了请求。请检查 API 密钥和模型权限。'
  if (status === 402) return '服务商提示账户余额不足。请检查该账户。'
  if (status === 429) return '服务商暂时限制了请求频率。请稍后重试。'
  return `服务商请求失败（${status}）。请检查 API 地址、模型 ID，以及是否支持 JSON 输出。`
}

export function modelApi(transport: ModelTransport = requestProvider): Plugin {
  async function handle(request: IncomingMessage, response: ServerResponse) {
    if (!isLocalRequest(request)) {
      send(response, 403, { error: '请从本机工作台页面调用自配模型。' })
      return
    }
    if (request.method !== 'POST' || !request.headers['content-type']?.startsWith('application/json')) {
      send(response, 405, { error: '此接口接收本机页面的 JSON 请求。' })
      return
    }
    const key = request.headers.authorization?.match(/^Bearer ([!-~]{1,2048})$/u)?.[1]
    if (!key) {
      send(response, 400, { error: '请填写有效的 API 密钥。' })
      return
    }

    let url: URL
    let payload: ReturnType<typeof modelPrompt>
    try {
      const { baseUrl, model, brief } = objectRecord(await readJson(request, 48 * 1024))
      if (typeof baseUrl !== 'string' || baseUrl.length > 1000 || typeof model !== 'string' || !model.trim() || model.length > 200) {
        throw new Error('请填写 API 地址和模型 ID。')
      }
      const input = objectRecord(brief)
      if (typeof input.problem !== 'string' || typeof input.audience !== 'string' || typeof input.scenario !== 'string') {
        throw new Error('请填写完整的设计简报。')
      }
      url = chatCompletionUrl(baseUrl)
      payload = modelPrompt(requireConceptBrief(input as ConceptDraft), model.trim())
    } catch (error) {
      const message = error instanceof Error && !(error instanceof SyntaxError) ? error.message : '无法读取设计简报。'
      send(response, 400, { error: message })
      return
    }

    const controller = new AbortController()
    response.once('close', () => controller.abort())
    const deadline = AbortSignal.timeout(120000)
    try {
      const result = await transport(url, key, payload, AbortSignal.any([controller.signal, deadline]))
      if (result.status < 200 || result.status >= 300) {
        send(response, 502, { error: providerError(result.status) })
        return
      }
      const { choices } = objectRecord(result.data)
      const choice = objectRecord(Array.isArray(choices) ? choices[0] : null)
      const { content } = objectRecord(choice.message)
      if (choice.finish_reason !== 'stop' || typeof content !== 'string' || !content.trim()) {
        send(response, 502, { error: '模型未返回完整结果。请减少生成数量后重试，或更换模型。' })
        return
      }
      send(response, 200, { content })
    } catch {
      send(response, 502, { error: deadline.aborted ? '模型服务响应超时。可减少生成数量后重试。' : '无法连接模型服务。请检查 API 地址或网络。' })
    }
  }

  function middleware(request: IncomingMessage, response: ServerResponse, next: () => void) {
    if (request.url !== modelGenerationPath) return next()
    void handle(request, response)
  }

  return {
    name: 'inno-lit-model-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
