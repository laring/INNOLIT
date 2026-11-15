
import { imageByteLimit, imageMime } from '../src/imageGeneration.ts'

type OpenAIImageInput = {
  model: string
  prompt: string
  size: string
  reference?: string
}

function openaiSize(size: string): string {
  const [width, height] = size.split('x').map(Number)

  if (!width || !height) {
    throw new Error('图片尺寸无效。')
  }

  const ratio = width / height

  if (ratio > 1.15) return '1536x1024'
  if (ratio < 0.87) return '1024x1536'
  return '1024x1024'
}

export async function generateOpenAIImage(
  input: OpenAIImageInput,
  apiKey: string,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const endpoint = input.reference
    ? 'https://api.openai.com/v1/images/edits'
    : 'https://api.openai.com/v1/images/generations'

  let body: string | FormData
  let headers: Record<string, string>

  if (input.reference) {
    const match = input.reference.match(
      /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/u,
    )

    if (!match) {
      throw new Error('参考图必须为 PNG、JPEG 或 WebP。')
    }

    const mime = match[1]
    const bytes = Buffer.from(match[2], 'base64')

    if (
      bytes.length > imageByteLimit ||
      imageMime(bytes) !== mime
    ) {
      throw new Error('参考图格式或大小无效。')
    }

    const form = new FormData()

    form.append('model', input.model)
    form.append('prompt', input.prompt)
    form.append('size', openaiSize(input.size))

    const extension =
    mime === 'image/jpeg'
        ? 'jpg'
        : mime === 'image/webp'
        ? 'webp'
        : 'png'

    form.append(
    'image',
    new Blob([new Uint8Array(bytes)], { type: mime }),
    `reference.${extension}`,
    )

    body = form
    headers = {
      Authorization: `Bearer ${apiKey}`,
    }
  } else {
    body = JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      size: openaiSize(input.size),
      n: 1,
    })

    headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body,
    signal,
    redirect: 'error',
  })

  if (!response.ok) {
    throw new Error(
      `OpenAI 图像生成失败：HTTP ${response.status}`,
    )
  }

  const result: unknown = await response.json()

  if (!result || typeof result !== 'object') {
    throw new Error('OpenAI 未返回有效数据。')
  }

  const data = (result as {
    data?: Array<{ b64_json?: string }>
  }).data

  const base64 = data?.[0]?.b64_json

  if (!base64) {
    throw new Error('OpenAI 未返回 Base64 图片。')
  }

  const bytes = Buffer.from(base64, 'base64')

  if (
    bytes.length > imageByteLimit ||
    !imageMime(bytes)
  ) {
    throw new Error('OpenAI 返回图片无效或超过大小限制。')
  }

  return new Uint8Array(bytes)
}
