import { generateOpenRouterImage } from './openrouterImageAdapter.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

import {
  imageByteLimit,
  imageGenerationPath,
  imageMime,
  imageRequest,
} from '../src/imageGeneration.ts'

import { objectRecord } from '../src/modelGeneration.ts'
import { isLocalRequest, providerError, send } from './modelApi.ts'

import {
  readJson,
  requestProviderJson,
  requestPublicBytes,
} from './providerHttp.ts'

import { generateOpenAIImage } from './openaiImageAdapter.ts'

type ImageTransport = (
  url: URL,
  key: string,
  payload: unknown,
  signal: AbortSignal,
) => Promise<{ status: number; data?: unknown }>

type DownloadImage = (
  url: URL,
  signal: AbortSignal,
) => Promise<{ status: number; bytes: Uint8Array }>

export function imageServiceKey(protocol: string, authorization: string | undefined, environment: Record<string, string | undefined> = process.env) {
  const browserKey = authorization?.match(/^Bearer ([!-~]{1,2048})$/u)?.[1]
  if (browserKey) return browserKey
  if (protocol === 'openai') return environment.OPENAI_API_KEY?.trim() || undefined
  if (protocol === 'openrouter') return environment.OPENROUTER_API_KEY?.trim() || undefined
  return undefined
}

async function imageBytes(
  data: unknown,
  signal: AbortSignal,
  download: DownloadImage,
): Promise<Uint8Array> {
  const body = objectRecord(data)
  const images = Array.isArray(body.images) ? body.images : body.data
  const first = objectRecord(Array.isArray(images) ? images[0] : null)

  if (typeof first.b64_json === 'string') {
    if (
      first.b64_json.length > imageByteLimit * 1.4 ||
      !/^[A-Za-z0-9+/=\r\n]+$/u.test(first.b64_json)
    ) {
      throw new Error('图片内容无效。')
    }

    return Buffer.from(first.b64_json, 'base64')
  }

  if (typeof first.url !== 'string' || first.url.length > 8000) {
    throw new Error('服务未返回图片。')
  }

  const url = new URL(first.url)
  const result = await download(url, signal)

  if (result.status < 200 || result.status >= 300) {
    throw new Error('图片下载失败。')
  }

  return result.bytes
}

export function imageApi(
  transport: ImageTransport = (url, key, payload, signal) =>
    requestProviderJson(
      url,
      key,
      payload,
      signal,
      12 * 1024 * 1024,
    ),

  download: DownloadImage = (url, signal) =>
    requestPublicBytes(url, signal, imageByteLimit),
): Plugin {
  async function handle(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    if (!isLocalRequest(request)) {
      return send(response, 403, {
        error: '请从本机工作台生成概念图。',
      })
    }

    if (
      request.method !== 'POST' ||
      !request.headers['content-type']?.startsWith('application/json')
    ) {
      return send(response, 405, {
        error: '请使用页面中的图片生成入口。',
      })
    }

    let input: Record<string, unknown>
    let spec: ReturnType<typeof imageRequest>

    try {
      input = objectRecord(
        await readJson(request, 12 * 1024 * 1024),
      )

      spec = imageRequest(input)

      if (typeof input.reference === 'string') {
        const reference = Buffer.from(
          input.reference.split(',')[1] ?? '',
          'base64',
        )

        if (
          reference.length > imageByteLimit ||
          !imageMime(reference)
        ) {
          throw new Error('产品母版参考图不可用。')
        }
      }
    } catch (error) {
      return send(response, 400, {
        error:
          error instanceof Error &&
          !(error instanceof SyntaxError)
            ? error.message
            : '图片请求无效。',
      })
    }

    const isOpenAI = input.protocol === 'openai'

    const isOpenRouter = input.protocol === 'openrouter'
    const key = imageServiceKey(String(input.protocol), request.headers.authorization)

    if (!key) {
      return send(response, 400, {
        error: '当前图片请求没有有效密钥。请在 AI 模型中心检查「概念图与展板」的生效配置（独立配置优先，其次原有图像任务，最后默认图像模型）。',
      })
    }

    const controller = new AbortController()
    response.once('close', () => controller.abort())

    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(120000),
    ])

    try {
      let bytes: Uint8Array
      if (isOpenRouter) {
        bytes = await generateOpenRouterImage(
          {
            model: String(input.model),
            prompt: String(input.prompt),
            size: String(input.size),
            ...(typeof input.reference === 'string' ? { reference: input.reference } : {}),
          },
          key,
          signal,
        )
      } else if (isOpenAI) {
        bytes = await generateOpenAIImage(
          {
            model: String(input.model),
            prompt: String(input.prompt),
            size: String(input.size),
            reference:
              typeof input.reference === 'string'
                ? input.reference
                : undefined,
          },
          key,
          signal,
        )
      } else {
        const result = await transport(
          spec.url,
          key,
          spec.payload,
          signal,
        )

        if (
          result.status < 200 ||
          result.status >= 300
        ) {
          return send(response, 502, {
            error: providerError(result.status),
          })
        }

        bytes = await imageBytes(
          result.data,
          signal,
          download,
        )
      }

      const mime = imageMime(bytes)

      if (!mime || bytes.length > imageByteLimit) {
        throw new Error('图片格式或大小超出范围。')
      }

      if (response.destroyed) return

      response.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-store',
      })

      response.end(bytes)
    } catch (error) {
      if (response.destroyed) return

      return send(response, 502, {
        error:
          error instanceof Error
            ? error.message
            : '概念图生成失败。',
      })
    }
  }

  function middleware(
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ) {
    if (request.url !== imageGenerationPath) {
      return next()
    }

    void handle(request, response)
  }

  return {
    name: 'inno-lit-image-api',

    configureServer(server) {
      server.middlewares.use(middleware)
    },

    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
