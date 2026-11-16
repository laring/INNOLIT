
import { imageByteLimit, imageMime } from '../src/imageGeneration.ts'

type OpenRouterImageInput = {
  model: string
  prompt: string
  size: string
  reference?: string
}

export async function generateOpenRouterImage(
  input: OpenRouterImageInput,
  apiKey: string,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (input.reference) {
    const metadata = await fetch('https://openrouter.ai/api/v1/images/models', { headers: { Authorization: `Bearer ${apiKey}` }, signal, redirect: 'error', cache: 'no-store' })
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
        ...(input.reference ? { input_references: [{ type: 'image_url', image_url: { url: input.reference } }] } : {}),
      }),
      signal,
      redirect: 'error',
    },
  )

  if (!response.ok) {
    const failure = await response.json().catch(() => null) as { error?: { message?: unknown; code?: unknown }; message?: unknown } | null
    const detail = typeof failure?.error?.message === 'string' ? failure.error.message : typeof failure?.message === 'string' ? failure.message : ''
    const safe = detail.replaceAll(apiKey, '[密钥已隐藏]').replace(/data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+/giu, '[参考图已隐藏]').replace(/Bearer\s+[!-~]+/giu, 'Bearer [已隐藏]').slice(0, 400)
    throw new Error(`OpenRouter 图片请求失败（HTTP ${response.status}，模型 ${input.model}）。${safe || '服务商未提供具体原因，请核对模型及该模型支持的请求参数。'}${input.reference ? ' 可移除风格参考图后主动选择文生图；本次未自动重试。' : ''}`)
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
