import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { requireConceptBrief } from '../src/concepts.ts'
import type { ConceptDraft } from '../src/concepts.ts'
import {
  chatCompletionUrl, modelChatPath, modelExtractPath, modelGenerationPath, modelPrompt, modelReviewPath, objectRecord,
} from '../src/modelGeneration.ts'
import { chatPrompt } from '../src/modelChat.ts'
import { extractPrompt, reviewPrompt } from '../src/modelStudio.ts'
import { readJson, requestProviderJson } from './providerHttp.ts'

type ModelPayload = ReturnType<typeof modelPrompt> | ReturnType<typeof chatPrompt>

type ModelTransport = (
  url: URL, key: string, payload: ModelPayload, signal: AbortSignal,
) => Promise<{ status: number; data?: unknown }>


export function send(response: ServerResponse, status: number, body: { content: string } | { error: string }) {
  if (response.destroyed) return
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

export function isLocalRequest(request: IncomingMessage): boolean {
  const host = request.headers.host ?? ''
  const address = request.socket.remoteAddress ?? ''
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)
    && /^(localhost|127\.0\.0\.1)(:\d+)?$/u.test(host)
    && request.headers.origin === `http://${host}`
}

export function providerError(status: number): string {
  if (status === 401 || status === 403) return '服务商拒绝了请求。请检查 API 密钥和模型权限。'
  if (status === 402) return '服务商提示账户余额不足。请检查该账户。'
  if (status === 429) return '服务商暂时限制了请求频率。请稍后重试。'
  return `服务商请求失败（${status}）。请检查 API 地址、模型 ID 和服务商设置。`
}

export function modelApi(transport: ModelTransport = requestProviderJson): Plugin {
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
    let payload: ModelPayload
    try {
      const input = objectRecord(await readJson(request, request.url === modelReviewPath ? 128 * 1024 : 64 * 1024))
      const { baseUrl, model, brief, messages } = input
      if (typeof baseUrl !== 'string' || baseUrl.length > 1000 || typeof model !== 'string' || !model.trim() || model.length > 200) {
        throw new Error('请填写 API 地址和模型 ID。')
      }
      url = chatCompletionUrl(baseUrl)
      if (request.url === modelChatPath) {
        payload = chatPrompt(messages, model.trim())
      } else if (request.url === modelReviewPath) {
        payload = reviewPrompt(input, model.trim())
      } else if (request.url === modelExtractPath) {
        payload = extractPrompt(input, model.trim())
      } else {
        const input = objectRecord(brief)
        if (typeof input.problem !== 'string' || typeof input.audience !== 'string' || typeof input.scenario !== 'string') {
          throw new Error('请填写完整的设计简报。')
        }
        payload = modelPrompt(requireConceptBrief(input as ConceptDraft), model.trim())
      }
    } catch (error) {
      const message = error instanceof Error && !(error instanceof SyntaxError) ? error.message : '无法读取模型请求。'
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
        send(response, 502, { error: '模型未返回完整结果。可缩短输入或更换模型后重试。' })
        return
      }
      send(response, 200, { content })
    } catch {
      send(response, 502, { error: deadline.aborted ? '模型服务响应超时。请稍后重试。' : '无法连接模型服务。请检查 API 地址或网络。' })
    }
  }

  function middleware(request: IncomingMessage, response: ServerResponse, next: () => void) {
    if (request.url !== modelGenerationPath && request.url !== modelChatPath
      && request.url !== modelReviewPath && request.url !== modelExtractPath) return next()
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
