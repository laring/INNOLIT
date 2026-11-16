
import type { ModelSettings } from './modelGeneration'
import type { ImageSettings } from './imageGeneration'
import { imageSizes } from './imageGeneration'
import { aiTasks, workflowTasks, resolveWorkflowModels } from './aiModelRouter'
import { imageConfigurationLabel } from './imageConfiguration'
import type {
  AIModelRouting,
  AITask,
  WorkflowModelRouting,
  WorkflowTask,
} from './aiModelRouter'

type Props = {
  routing: AIModelRouting
  defaultText: ModelSettings
  defaultImage: ImageSettings
  onDefaultTextChange: (change: Partial<ModelSettings>) => void
  onDefaultImageChange: (change: Partial<ImageSettings>) => void
  onChange: (
    task: AITask,
    change: Partial<ModelSettings> | Partial<ImageSettings>,
  ) => void
  onReset: (task: AITask) => void

  workflowRouting: WorkflowModelRouting
  onWorkflowChange: (
    task: WorkflowTask,
    change: Partial<ModelSettings> | Partial<ImageSettings>,
  ) => void
  onWorkflowReset: (task: WorkflowTask) => void

}

type ProviderPreset = {
  id: string
  name: string
  baseUrl: string
  models: string[]
}

const textProviders: ProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: ['Qwen/Qwen3-8B'],
  },
  {
    id: 'bailian',
    name: '阿里云百炼',
    baseUrl:
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-max'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4.1', 'gpt-4.1-mini'],
  },
  {
    id: 'custom',
    name: ' OpenAI 兼容接口',
    baseUrl: '',
    models: [],
  },
]

const imageProviders: ProviderPreset[] = [
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: ['Kwai-Kolors/Kolors', 'Qwen/Qwen-Image-Edit-2509'],
  },


  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['recraft/recraft-v4.1-flash-v2:free'],
  },


  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-image-1.5'],
  },

  {
    id: 'custom',
    name: '自定义图像接口',
    baseUrl: '',
    models: [],
  },
]

const tasks = Object.keys(aiTasks) as AITask[]

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function findProvider(
  baseUrl: string,
  providers: ProviderPreset[],
): ProviderPreset {
  const normalized = normalizeUrl(baseUrl)

  return (
    providers.find(
      provider =>
        provider.id !== 'custom' &&
        normalizeUrl(provider.baseUrl) === normalized,
    ) ??
    providers.find(provider => provider.id === 'custom')!
  )
}

type CommonFieldsProps = {
  settings: ModelSettings | ImageSettings
  onChange: (
    change: Partial<ModelSettings> | Partial<ImageSettings>,
  ) => void
  image?: boolean
}

function CommonModelFields({
  settings,
  onChange,
  image = false,
}: CommonFieldsProps) {
  const providers = image ? imageProviders : textProviders
  const provider = findProvider(settings.baseUrl, providers)

  const knownModel = provider.models.includes(settings.model)

  function chooseProvider(id: string) {
    const selected = providers.find(item => item.id === id)

    if (!selected) return

    if (selected.id === 'custom') {
      // Preserve the current model ID and API Key.
      // Only switch the endpoint to custom mode.
      onChange({ baseUrl: '', ...(image ? { protocol: 'images' as const } : {}) })
      return
    }

      onChange({
        baseUrl: selected.baseUrl,
        model: selected.models[0] ?? settings.model,
        ...(image
          ? {
              protocol: selected.id === 'openai'
                ? 'openai'
                : selected.id === 'openrouter'
                  ? 'openrouter'
                  : 'siliconflow',
            }
          : {}),
      })
  }
  return (
    <>
      <label>
        模型服务商
        <select
          value={provider.id}
          onChange={event =>
            chooseProvider(event.target.value)
          }
        >
          {providers.map(item => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        API 地址
        <input
          value={settings.baseUrl}
          placeholder="https://api.example.com/v1"
          onChange={event =>
            onChange({ baseUrl: event.target.value })
          }
        />
      </label>

      {provider.models.length > 0 && (
        <label>
          选择模型
          <select
            value={knownModel ? settings.model : '__custom__'}
            onChange={event => {
              if (event.target.value !== '__custom__') {
                onChange({ model: event.target.value })
              }
            }}
          >
            {provider.models.map(model => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
            <option value="__custom__">
              自定义模型 ID
            </option>
          </select>
        </label>
      )}

      <label>
        模型 ID（可手动填写）
        <input
          value={settings.model}
          maxLength={200}
          placeholder={
            image
              ? '输入图像模型 ID'
              : '输入模型 ID'
          }
          onChange={event =>
            onChange({ model: event.target.value })
          }
        />
      </label>

      {(
        <label>
          API Key
          <input
            type="password"
            autoComplete="off"
            value={settings.apiKey}
            placeholder="输入服务商 API Key"
            onChange={event =>
              onChange({ apiKey: event.target.value })
            }
          />
        </label>
      )}

    </>
  )
}


type ImageFieldsProps = {
  settings: ImageSettings
  onChange: (change: Partial<ImageSettings>) => void
}

function ImageExtraFields({
  settings,
  onChange,
}: ImageFieldsProps) {
  return (
    <>
      <label>
        图像接口协议
        <select
          value={settings.protocol}
          onChange={event =>
            onChange({
              protocol: event.target
                .value as ImageSettings['protocol'],
            })
          }
        >
          <option value="siliconflow">
            SiliconFlow
          </option>

          <option value="openrouter">
            OpenRouter Images API
          </option>


          <option value="images">
            Images 兼容接口
          </option>

          <option value="openai">
            OpenAI Images API
          </option>
        </select>
      </label>

      <label>
        母版尺寸
        <select
          value={settings.size}
          onChange={event =>
            onChange({
              size: event.target
                .value as ImageSettings['size'],
            })
          }
        >
          {imageSizes.map(size => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}

export function TaskModelCenter({
  routing,
  defaultText,
  defaultImage,
  onDefaultTextChange,
  onDefaultImageChange,
  onChange,
  onReset,
  workflowRouting,
  onWorkflowChange,
  onWorkflowReset,
}: Props) {
  const models = resolveWorkflowModels(workflowRouting, routing, defaultText, defaultImage)
  return (
    <div className="model-settings">
      <p className="studio-hint" role="status">当前实际图片配置：{imageConfigurationLabel(workflowRouting, routing, defaultImage)}</p>
      <p>
        在此统一管理 AI 模型。
        八个设计环节可独立配置；未单独配置时继承原有任务或默认模型。
        API Key 只保留在本次页面会话中。
      </p>

      <fieldset className="global-model-defaults">
        <legend>
          <strong>默认文本模型</strong>
        </legend>

        <p className="studio-hint">
          创意生成、方案深化和视觉提示词生成，
          默认继承此处的文本模型。
        </p>

        <CommonModelFields
          settings={defaultText}
          onChange={onDefaultTextChange}
        />
      </fieldset>

      <fieldset className="global-model-defaults">
        <legend>
          <strong>默认图像模型</strong>
        </legend>

        <p className="studio-hint">
          图像生成任务未独立配置时继承此模型。
        </p>

        <CommonModelFields
          settings={defaultImage}
          onChange={onDefaultImageChange}
          image
        />

        <ImageExtraFields
          settings={defaultImage}
          onChange={onDefaultImageChange}
        />
      </fieldset>

      {(Object.keys(workflowTasks) as WorkflowTask[]).map(task => {
        const image = task === 'visual'
        const dedicated = workflowRouting[task] !== null
        const active = models[task]
        return <fieldset key={task} className="global-model-defaults">
          <legend><strong>{workflowTasks[task]}</strong></legend>
          <label>配置方式<select aria-label={`${workflowTasks[task]} 配置方式`} value={dedicated ? 'dedicated' : 'fallback'} onChange={event => {
            if (event.target.value === 'fallback') onWorkflowReset(task)
            else onWorkflowChange(task, { ...active })
          }}><option value="fallback">继承原有或默认配置</option><option value="dedicated">独立模型</option></select></label>
          {dedicated && <>
            <CommonModelFields settings={active} image={image} onChange={change => onWorkflowChange(task, change)} />
            {image && <ImageExtraFields settings={active as ImageSettings} onChange={change => onWorkflowChange(task, change)} />}
          </>}
          <p className="studio-hint">当前模型：{active.model || '未配置'}{dedicated ? '（独立配置）' : '（继承配置）'}</p>
          {image && <p className="studio-hint">专业流程的视觉转译文字模型在下方原有任务配置中管理。</p>}
        </fieldset>
      })}
      <details><summary>原有四类任务与视觉转译配置</summary>
      {tasks.map(task => {
        const isImage = task === 'image'
        const dedicated = routing[task] !== null

        const fallback = isImage
          ? defaultImage
          : defaultText

        const active = routing[task] ?? fallback

        return (
          <fieldset
            key={task}
            style={{
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <legend>
              <strong>{aiTasks[task]}</strong>
            </legend>

            <label>
              配置方式
              <select
                value={
                  dedicated ? 'dedicated' : 'fallback'
                }
                onChange={event => {
                  if (
                    event.target.value === 'fallback'
                  ) {
                    onReset(task)
                  } else {
                    onChange(task, { ...fallback })
                  }
                }}
              >
                <option value="fallback">
                  继承默认配置
                </option>
                <option value="dedicated">
                  独立模型
                </option>
              </select>
            </label>

            {dedicated && (
              <>
                <CommonModelFields
                  settings={active}
                  image={isImage}
                  onChange={change =>
                    onChange(task, change)
                  }
                />

                {isImage && (
                  <ImageExtraFields
                    settings={active as ImageSettings}
                    onChange={change =>
                      onChange(task, change)
                    }
                  />
                )}
              </>
            )}

            <p className="studio-hint">
              当前模型：
              {active.model || '未配置'}
              {dedicated
                ? '（独立配置）'
                : '（继承默认配置）'}
            </p>
          </fieldset>
        )
      })}
      </details>

      <p className="studio-hint">
        当前仅支持现有后端兼容的云端接口。
        Ollama、Gemini、Claude 等非兼容接口需要额外适配。
        服务商和模型预设不代表已通过连接测试。
      </p>
    </div>
  )
}
