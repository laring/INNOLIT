
import type { ModelSettings } from './modelGeneration'
import type { ImageSettings } from './imageGeneration'

export const aiTasks = {
  concept: '创意生成',
  refinement: '方案深化',
  translation: '视觉提示词生成',
  image: '图像生成',
} as const

export type AITask = keyof typeof aiTasks
export type TextTask = Exclude<AITask, 'image'>

export type AIModelRouting = {
  concept: ModelSettings | null
  refinement: ModelSettings | null
  translation: ModelSettings | null
  image: ImageSettings | null
}

export type ResolvedAIModel = {
  task: AITask
  source: 'dedicated' | 'fallback'
  settings: ModelSettings | ImageSettings
}

export function createEmptyRouting(): AIModelRouting {
  return {
    concept: null,
    refinement: null,
    translation: null,
    image: null,
  }
}

export function resolveTextModel(
  task: TextTask,
  routing: AIModelRouting,
  fallback: ModelSettings,
): ModelSettings {
  return routing[task] ?? fallback
}

export function resolveImageModel(
  routing: AIModelRouting,
  fallback: ImageSettings,
): ImageSettings {
  return routing.image ?? fallback
}

export function resolveAIModel(
  task: AITask,
  routing: AIModelRouting,
  fallbackText: ModelSettings,
  fallbackImage: ImageSettings,
): ResolvedAIModel {
  if (task === 'image') {
    return {
      task,
      source: routing.image ? 'dedicated' : 'fallback',
      settings: resolveImageModel(routing, fallbackImage),
    }
  }

  return {
    task,
    source: routing[task] ? 'dedicated' : 'fallback',
    settings: resolveTextModel(task, routing, fallbackText),
  }
}

export function updateTaskModel<T extends AITask>(
  routing: AIModelRouting,
  task: T,
  settings: AIModelRouting[T],
): AIModelRouting {
  return {
    ...routing,
    [task]: settings,
  }
}

export function clearTaskModel(
  routing: AIModelRouting,
  task: AITask,
): AIModelRouting {
  return {
    ...routing,
    [task]: null,
  }
}

export function taskModelLabel(
  task: AITask,
  routing: AIModelRouting,
  fallbackText: ModelSettings,
  fallbackImage: ImageSettings,
): string {
  const resolved = resolveAIModel(
    task,
    routing,
    fallbackText,
    fallbackImage,
  )

  const model = resolved.settings.model.trim() || '未配置'
  const suffix =
    resolved.source === 'fallback' ? '（默认配置）' : ''

  return `${model}${suffix}`
}
