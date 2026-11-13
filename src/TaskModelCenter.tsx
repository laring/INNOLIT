import type { ModelSettings } from './modelGeneration'
import type { ImageSettings } from './imageGeneration'
import { imageSizes } from './imageGeneration'
import { aiTasks } from './aiModelRouter'
import type { AIModelRouting, AITask } from './aiModelRouter'

type Props = {
  routing: AIModelRouting
  defaultText: ModelSettings
  defaultImage: ImageSettings
  onChange: (task: AITask, change: Partial<ModelSettings> | Partial<ImageSettings>) => void
  onReset: (task: AITask) => void
}
const presets = [
  { label: 'DeepSeek', url: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { label: '硅基流动', url: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen3-8B' },
  { label: '阿里云百炼', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { label: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' },
] as const
const tasks = Object.keys(aiTasks) as AITask[]
export function TaskModelCenter({ routing, defaultText, defaultImage, onChange, onReset }: Props) {
  return (
    <div className="model-settings">
      <p>四类任务可独立配置。未单独配置时继承默认模型。API Key 只保留在本次页面会话中。</p>
      {tasks.map(task => {
        const image = task === 'image'
        const fallback = image ? defaultImage : defaultText
        const active = routing[task] ?? fallback
        return (
          <fieldset key={task} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <legend><strong>{aiTasks[task]}</strong></legend>
            <label>
              配置方式
              <select value={routing[task] ? 'dedicated' : 'fallback'} onChange={event => {
                if (event.target.value === 'fallback') onReset(task)
                else onChange(task, { ...fallback })
              }}>
                <option value="fallback">继承默认配置</option>
                <option value="dedicated">独立模型</option>
              </select>
            </label>
            {routing[task] && (
              <>
                <label>服务商预设
                  <select value="" onChange={event => {
                    const preset = presets.find(item => item.label === event.target.value)
                    if (preset) onChange(task, { baseUrl: preset.url, model: preset.model })
                  }}>
                    <option value="">选择预设或手动填写</option>
                    {(image ? presets.filter(item => item.label === '硅基流动') : presets).map(item => <option key={item.label} value={item.label}>{item.label}</option>)}
                  </select>
                </label>
                <label>API 地址
                  <input value={active.baseUrl} onChange={event => onChange(task, { baseUrl: event.target.value })} placeholder="https://api.example.com/v1" />
                </label>
                <label>模型 ID
                  <input value={active.model} onChange={event => onChange(task, { model: event.target.value })} />
                </label>
                <label>API Key
                  <input type="password" autoComplete="off" value={active.apiKey} onChange={event => onChange(task, { apiKey: event.target.value })} />
                </label>
                {image && (
                  <>
                    <label>图像接口协议
                      <select value={(active as ImageSettings).protocol} onChange={event => onChange(task, { protocol: event.target.value as ImageSettings['protocol'] })}>
                        <option value="siliconflow">SiliconFlow</option>
                        <option value="images">Images 兼容接口</option>
                      </select>
                    </label>
                    <label>母版尺寸
                      <select value={(active as ImageSettings).size} onChange={event => onChange(task, { size: event.target.value as ImageSettings['size'] })}>
                        {imageSizes.map(size => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </label>
                  </>
                )}
              </>
            )}
            <p className="studio-hint">当前模型：{active.model || '未配置'}{routing[task] ? '（独立）' : '（继承）'}</p>
          </fieldset>
        )
      })}
      <p className="studio-hint">当前仅支持现有后端兼容的云端接口。Ollama、Gemini、Claude 等非兼容接口需后端适配；模型预设不代表已通过连接测试。</p>
    </div>
  )
}
