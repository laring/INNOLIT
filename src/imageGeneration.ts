import type { Concept, ConceptBatch } from './concepts.ts'
import { objectRecord, providerUrl } from './modelGeneration.ts'
import type { ModelSettings } from './modelGeneration.ts'

export const imageGenerationPath = '/api/inno-lit/image'
export const imageByteLimit = 8 * 1024 * 1024
export const imageSizes = ['1024x1024', '1328x1328', '1664x928', '928x1664', '1536x1024', '1024x1536', '1792x1024', '1024x1792'] as const
export type ImageSettings = ModelSettings & {
  protocol: 'siliconflow' | 'images'
  size: typeof imageSizes[number]
}
export type VisualLayout = 'diagram' | 'landscape' | 'portrait'
export type VisualSource = { kind: 'upload' } | { kind: 'model'; model: string; provider: string }

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
    || typeof data.prompt !== 'string' || !data.prompt.trim() || data.prompt.length > 3000
    || !imageSizes.includes(data.size as ImageSettings['size'])
    || (data.protocol !== 'siliconflow' && data.protocol !== 'images')) {
    throw new Error('请填写图片 API 地址、模型、提示词和支持的图片尺寸。')
  }
  const url = providerUrl(data.baseUrl, '/images/generations')
  const size = data.size as string
  return {
    url,
    payload: {
      model: data.model.trim(),
      prompt: data.prompt.trim(),
      ...(data.protocol === 'siliconflow' ? { image_size: size } : { size, n: 1 }),
    },
  }
}

export async function generateConceptImage(settings: ImageSettings, prompt: string, signal: AbortSignal): Promise<Blob> {
  imageRequest({ ...settings, prompt })
  const { apiKey, ...publicSettings } = settings
  const response = await fetch(imageGenerationPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
    credentials: 'omit', redirect: 'error', cache: 'no-store', signal,
    body: JSON.stringify({ ...publicSettings, prompt }),
  })
  if (!response.ok) {
    const data = objectRecord(await response.json().catch(() => null))
    throw new Error(typeof data.error === 'string' ? data.error : '图片生成服务暂不可用。')
  }
  const blob = await response.blob()
  if (blob.size > imageByteLimit || !imageMime(new Uint8Array(await blob.slice(0, 12).arrayBuffer()))) {
    throw new Error('服务未返回可用的 PNG、JPEG 或 WebP 图片。')
  }
  return blob
}
