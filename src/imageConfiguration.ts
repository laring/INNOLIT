import { resolveWorkflowImageModel, resolveImageModel } from './aiModelRouter.ts'
import type { AIModelRouting, WorkflowModelRouting } from './aiModelRouter.ts'
import type { ImageSettings } from './imageGeneration.ts'

export function imageConfigurationLabel(workflow: WorkflowModelRouting, legacy: AIModelRouting, defaults: ImageSettings) {
  const settings = resolveWorkflowImageModel(workflow, resolveImageModel(legacy, defaults))
  const source = workflow.visual ? '概念图与展板独立配置' : legacy.image ? '原有图像生成配置' : '默认图像模型'
  let address = '地址未填写'
  try { const url = new URL(settings.baseUrl); address = url.origin + url.pathname } catch { /* Keep the incomplete configuration visible. */ }
  const protocol = { siliconflow: 'SiliconFlow', images: 'Images 兼容', openai: 'OpenAI', openrouter: 'OpenRouter' }[settings.protocol] ?? settings.protocol
  return `${source} · ${settings.model.trim() || '模型未填写'} · ${protocol} · ${address} · ${settings.apiKey.trim() ? '密钥已填写' : '密钥未填写'}`
}
