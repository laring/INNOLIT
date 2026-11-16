import type { Concept, ConceptBatch } from './concepts.ts'
import { objectRecord, providerUrl } from './modelGeneration.ts'
import type { ModelSettings } from './modelGeneration.ts'

export const imageGenerationPath = '/api/inno-lit/image'
export const imageByteLimit = 8 * 1024 * 1024
export const imageSizes = ['1024x1024', '1328x1328', '1664x928', '928x1664', '1536x1024', '1024x1536', '1792x1024', '1024x1792'] as const
export type ImageSettings = ModelSettings & {
  protocol: 'siliconflow' | 'images'| 'openai'| 'openrouter'
  size: typeof imageSizes[number]
}
export type VisualLayout = 'diagram' | 'landscape' | 'portrait'
export type VisualSource = { kind: 'local' } | { kind: 'upload' } | { kind: 'model'; model: string; provider: string }

export function supportsImageReference(
  settings: Pick<ImageSettings, 'protocol' | 'model'>,
) : boolean {
  if (settings.protocol === 'openai') {
    return true
  }

  return (
    settings.protocol === 'siliconflow' &&
    /^Qwen\/Qwen-Image-Edit(?:-\d{4})?$/u.test(
      settings.model.trim(),
    )
  )
}

export function imageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return 'image/png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}

export function defaultImagePrompt(round: ConceptBatch, concept: Concept): string {
  return [
    '产品概念设计效果图，清晰展示形态、核心机制和一次使用动作。工业设计原型质感，柔和光线，简洁背景。',
    `方案：${concept.title}；形态：${concept.format}。`,
    `核心构想：${concept.sentences.idea}`,
    `使用方式：${concept.sentences.interaction}`,
    `目标用户：${round.brief.audience}；场景：${round.brief.scenario}。`,
    '以画面表现方案，让产品主体完整进入画面。',
  ].join('\n').slice(0, 3000)
}

export function imageRequest(input: unknown) {
  const data = objectRecord(input)
  if (typeof data.baseUrl !== 'string' || data.baseUrl.length > 1000
    || typeof data.model !== 'string' || !data.model.trim() || data.model.length > 200
    || typeof data.prompt !== 'string' || !data.prompt.trim() || data.prompt.length > 14000
    || !imageSizes.includes(data.size as ImageSettings['size'])
    || !['siliconflow', 'images', 'openai', 'openrouter'].includes(
  data.protocol as string
)) {
    throw new Error('请填写图片 API 地址、模型、提示词和支持的图片尺寸。')
  }


if (data.protocol === 'openrouter') {
  if (data.baseUrl !== 'https://openrouter.ai/api/v1') {
    throw new Error('OpenRouter API 地址不正确。')
  }

  if (data.reference) {
    throw new Error(
      '当前 Recraft 模型不支持参考图编辑，请使用文生图创建母版。'
    )
  }

  if (data.purpose && data.purpose !== 'master') {
    throw new Error(
      '当前 Recraft 模型仅用于生成产品母版。'
    )
  }
}



  const url =
  data.protocol === 'openai'
    ? new URL('https://api.openai.com/v1/images/generations')
    : providerUrl(data.baseUrl, '/images/generations')
  if (data.protocol === 'openai' && providerUrl(data.baseUrl, '/images/generations').href !== url.href) throw new Error('OpenAI 协议请使用官方 API 地址；自定义服务请选择 Images 兼容接口。')

  const size = data.size as string
  const purpose = data.purpose ?? 'master'
  if (!['master', 'landscape', 'portrait', 'poster', 'concept'].includes(purpose as string)) throw new Error('未知的展示入口。')
  const reference = data.reference
  if (purpose !== 'master' && purpose !== 'concept' && !reference) throw new Error('三张展示入口必须携带产品母版参考图。')
  if (reference !== undefined && (typeof reference !== 'string' || reference.length > imageByteLimit * 1.4
    || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/u.test(reference))) throw new Error('产品母版参考图格式无效。')
  if (reference && !supportsImageReference({ protocol: data.protocol as ImageSettings['protocol'], model: data.model })) {
    throw new Error('延展图片需使用支持母版参考的 Qwen Image Edit 接口；Kolors 可用于制作产品母版。')
  }

  const requiresReference =
    data.protocol === 'siliconflow' &&
    supportsImageReference({
      protocol: data.protocol,
      model: data.model,
    })

  if (!reference && requiresReference) {
    throw new Error(
      '当前图像编辑模型需要参考图，请先建立产品母版。',
    )
  }
  return {
    url,
    payload: {
      model: data.model.trim(),
      prompt: data.prompt.trim(),
      ...(reference ? { image: reference } : data.protocol === 'siliconflow' ? { image_size: size } : { size, n: 1 }),
    },
  }
}


export async function generateConceptImage(
  settings: ImageSettings,
  prompt: string,
  signal: AbortSignal,
  options: {
    reference?: string
    purpose?: string
  } = {},
): Promise<Blob> {

  // 1. 验证图像生成参数
  imageRequest({
    ...settings,
    prompt,
    ...options,
  })

  // 2. 分离 API Key，避免写入请求体
  const { apiKey, ...publicSettings } = settings

  // 3. 构造请求头
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (!/^[!-~]{1,2048}$/u.test(apiKey.trim())) throw new Error('请在 AI 模型中心为当前图片配置填写有效的 API 密钥。')
  headers.Authorization = `Bearer ${apiKey.trim()}`

  // 4. 调用 INNO LIT 本地服务端
  const response = await fetch(imageGenerationPath, {
    method: 'POST',
    headers,
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    signal,
    body: JSON.stringify({
      ...publicSettings,
      prompt,
      ...options,
    }),
  })

  // 5. 处理服务端错误
  if (!response.ok) {
    const data = objectRecord(
      await response.json().catch(() => null),
    )

    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : '图片生成服务暂不可用。',
    )
  }

  // 6. 接收图片
  const blob = await response.blob()

  // 7. 检查图片大小和格式
  if (
    blob.size > imageByteLimit ||
    !imageMime(
      new Uint8Array(
        await blob.slice(0, 12).arrayBuffer(),
      ),
    )
  ) {
    throw new Error(
      '服务未返回可用的 PNG、JPEG 或 WebP 图片。',
    )
  }

  // 8. 返回图片，供预览、保存及导出
  return blob
}
