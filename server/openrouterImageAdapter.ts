
import { imageByteLimit, imageMime } from '../src/imageGeneration.ts'

type OpenRouterImageInput = {
  model: string
  prompt: string
  size: string
}

function aspectRatio(size: string): string {
  const [width, height] = size.split('x').map(Number)

  if (!width || !height) {
    throw new Error('图像尺寸无效。')
  }

  const ratio = width / height

  if (ratio >= 1.6) return '16:9'
  if (ratio >= 1.15) return '4:3'
  if (ratio <= 0.625) return '9:16'
  if (ratio <= 0.87) return '3:4'

  return '1:1'
}

export async function generateOpenRouterImage(
  input: OpenRouterImageInput,
  apiKey: string,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (input.model !== 'recraft/recraft-v4.1-flash-v2:free') {
    throw new Error('当前仅支持已配置的 Recraft 免费模型。')
  }

  const response = await fetch(
    'https://openrouter.ai/api/v1/images',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        aspect_ratio: aspectRatio(input.size),
        n: 1,
      }),
      signal,
      redirect: 'error',
    },
  )

  if (!response.ok) {
    throw new Error(
      `OpenRouter 图像生成失败：HTTP ${response.status}`
    )
  }

  const result: unknown = await response.json()

  const data = (
    result as {
      data?: Array<{ b64_json?: string }>
    }
  )?.data

  const base64 = data?.[0]?.b64_json

  if (!base64) {
    throw new Error('OpenRouter 未返回有效图像数据。')
  }

  const bytes = Buffer.from(base64, 'base64')

  if (bytes.length > imageByteLimit || !imageMime(bytes)) {
    throw new Error('返回图片格式无效或超出大小限制。')
  }

  return new Uint8Array(bytes)
}
