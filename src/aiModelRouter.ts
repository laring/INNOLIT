
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

export const workflowTasks = {
  home: '首页 · 创意对话',
  conceptStudio: 'Concept Studio · 概念生成',
  notes: '深化笔记',
  feasibility: '可行性验证',
  originality: '原创性检索',
  optimization: '方案优化与定稿',
  visual: '概念图与展板',
  engineering: '六步产品设计 · 工程文字模型',
  report: '设计报告',
} as const

export type WorkflowTask = keyof typeof workflowTasks




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






export type WorkflowModelRouting = {
  home: ModelSettings | null
  conceptStudio: ModelSettings | null
  notes: ModelSettings | null
  feasibility: ModelSettings | null
  originality: ModelSettings | null
  optimization: ModelSettings | null
  visual: ImageSettings | null
  engineering: ModelSettings | null
  report: ModelSettings | null
}

export function createEmptyWorkflowRouting(): WorkflowModelRouting {
  return {
    home: null,
    conceptStudio: null,
    notes: null,
    feasibility: null,
    originality: null,
    optimization: null,
    visual: null,
    engineering: null,
    report: null,
  }
}

export function resolveWorkflowTextModel(
  task: Exclude<WorkflowTask, 'visual'>,
  routing: WorkflowModelRouting,
  fallback: ModelSettings,
): ModelSettings {
  return routing[task] ?? fallback
}

export function resolveWorkflowImageModel(
  routing: WorkflowModelRouting,
  fallback: ImageSettings,
): ImageSettings {
  return routing.visual ?? fallback
}

export function resolveWorkflowModels(workflow: WorkflowModelRouting, legacy: AIModelRouting, text: ModelSettings, image: ImageSettings) {
  const creative = resolveTextModel('concept', legacy, text)
  const refinement = resolveTextModel('refinement', legacy, text)
  return {
    home: resolveWorkflowTextModel('home', workflow, creative),
    conceptStudio: resolveWorkflowTextModel('conceptStudio', workflow, creative),
    notes: resolveWorkflowTextModel('notes', workflow, refinement),
    feasibility: resolveWorkflowTextModel('feasibility', workflow, refinement),
    originality: resolveWorkflowTextModel('originality', workflow, refinement),
    optimization: resolveWorkflowTextModel('optimization', workflow, refinement),
    report: resolveWorkflowTextModel('report', workflow, refinement),
    visual: resolveWorkflowImageModel(workflow, resolveImageModel(legacy, image)),
    engineering: resolveWorkflowTextModel('engineering', workflow, resolveTextModel('translation', legacy, text)),
    translation: resolveWorkflowTextModel('engineering', workflow, resolveTextModel('translation', legacy, text)),
  }
}
