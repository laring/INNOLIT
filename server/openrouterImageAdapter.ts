
import { imageByteLimit, imageMime } from '../src/imageGeneration.ts'

type OpenRouterImageInput = {
  model: string
  prompt: string
  size: string
  reference?: string
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
  if (input.reference) {
    const metadata = await fetch('https://openrouter.ai/api/v1/images/models', { signal, redirect: 'error', cache: 'no-store' })
    if (!metadata.ok) throw new Error('OpenRouter 图片模型能力查询暂时失败，请稍后重试。')
    const catalog = await metadata.json() as { data?: Array<{ id?: string; architecture?: { input_modalities?: string[]; output_modalities?: string[] } }> }
    if (!Array.isArray(catalog.data)) throw new Error('OpenRouter 返回的模型能力目录无效，请稍后重试。')
    const entry = catalog.data?.find(item => item.id === input.model)
    if (entry && !entry.architecture?.input_modalities?.includes('image')) throw new Error(`OpenRouter 的 ${input.model} 支持绘图，但服务商登记它不接收参考图片。请在模型中心选择同时支持图片输入和输出的模型。`)
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
        ...(input.reference ? { input_references: [{ type: 'image_url', image_url: { url: input.reference } }] } : {}),
      }),
      signal,
      redirect: 'error',
    },
  )

  if (!response.ok) {
    throw new Error(
      `OpenRouter 图片请求失败（HTTP ${response.status}）。${input.reference ? '已提交参考图，请核对该模型是否支持图片输入以及账户权限。' : '请核对模型 ID、额度及账户权限。'}`
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
