
import type { ModelSettings } from './modelGeneration'
import type { ImageSettings } from './imageGeneration'
import { imageSizes } from './imageGeneration'
import { workflowTasks, resolveWorkflowModels, isWorkflowImageTask } from './aiModelRouter'
import { imageConfigurationLabel } from './imageConfiguration'
import type {
  AIModelRouting,
  WorkflowModelRouting,
  WorkflowTask,
} from './aiModelRouter'

type Props = {
  remember: boolean
  onRememberChange: (remember: boolean) => void
  onForget: () => void
  saveNotice: string
  onSave: () => Promise<boolean>
  routing: AIModelRouting
  defaultText: ModelSettings
  defaultImage: ImageSettings
  onDefaultTextChange: (change: Partial<ModelSettings>) => void
  onDefaultImageChange: (change: Partial<ImageSettings>) => void
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
    name: 'OpenAI（官方 API）',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4.1', 'gpt-4.1-mini'],
  },
  {
    id: 'custom',
    name: 'OpenAI 兼容接口（自定义文字服务）',
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
    name: 'OpenAI（官方 API）',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-image-1.5'],
  },

  {
    id: 'custom',
    name: 'OpenAI 兼容接口（自定义图片服务）',
    baseUrl: '',
    models: [],
  },
]


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
  const provider = image && (settings as ImageSettings).protocol === 'images'
    ? providers.find(item => item.id === 'custom')!
    : findProvider(settings.baseUrl, providers)

  const knownModel = provider.models.includes(settings.model)

  function chooseProvider(id: string) {
    const selected = providers.find(item => item.id === id)

    if (!selected) return

    if (selected.id === 'custom') {
      // Preserve the current model ID and API Key.
      // Only switch the endpoint to custom mode.
      onChange(image ? { protocol: 'images' as const } : { baseUrl: '' })
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
            OpenAI 兼容 Images API
          </option>

          <option value="openai">
            OpenAI Images API
          </option>
        </select>
      </label>

      <label>
        模型原图尺寸
        <select
          value={settings.size}
          disabled={settings.protocol === 'openrouter'}
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
      {settings.protocol === 'images' && <p className="studio-hint">填写兼容服务的地址、模型和密钥，文生图通过 /images/generations 调用。参考图编辑需要服务专用适配，不能仅凭兼容名称保证支持。</p>}
      {settings.protocol === 'openrouter' && <p className="studio-hint">OpenRouter 使用所选模型的默认原图尺寸，避免附加不兼容的尺寸参数。导出尺寸在七步设计的各步骤中设置。</p>}
    </>
  )
}

export function TaskModelCenter({
  remember, onRememberChange, onForget, saveNotice, onSave,
  routing,
  defaultText,
  defaultImage,
  onDefaultTextChange,
  onDefaultImageChange,
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
        各设计环节可独立配置；未单独配置时继承默认模型。
        OpenAI 官方 API 为官方地址预设；其他兼容服务使用各自的地址、模型和密钥。
      </p>

      <section className="studio-refinement" aria-label="配置保存设置">
        <label className="model-memory-toggle"><input type="checkbox" checked={remember} onChange={event=>onRememberChange(event.target.checked)}/> 记住配置与 API Key（仅此浏览器）</label>
        <p className="studio-hint">开启后自动加密保存，刷新或重新打开后恢复。建议仅在自己的电脑开启；清理浏览器数据会丢失配置。不同浏览器或访问地址各自保存。</p>
        <div className="studio-actions"><button type="button" className="studio-button" onClick={()=>void onSave()}>保存配置</button><button type="button" className="studio-button" onClick={onForget}>清除已保存配置</button></div>
        <p className="studio-hint" role="status">{saveNotice}</p>
      </section>
      <fieldset className="global-model-defaults">
        <legend>
          <strong>默认文本模型</strong>
        </legend>

        <p className="studio-hint">
          创意对话、概念生成、方案深化及七步工程分析，
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
        const image = isWorkflowImageTask(task)
        const dedicated = Boolean(workflowRouting[task])
        const active = models[task]
        return <fieldset key={task} className="global-model-defaults">
          <legend><strong>{workflowTasks[task]}</strong></legend>
          <label>配置方式<select aria-label={`${workflowTasks[task]} 配置方式`} value={dedicated ? 'dedicated' : 'fallback'} onChange={event => {
            if (event.target.value === 'fallback') onWorkflowReset(task)
            else onWorkflowChange(task, { ...active })
          }}><option value="fallback">继承默认配置</option><option value="dedicated">独立模型</option></select></label>
          {dedicated && <>
            <CommonModelFields settings={active} image={image} onChange={change => onWorkflowChange(task, change)} />
            {image && <ImageExtraFields settings={active as ImageSettings} onChange={change => onWorkflowChange(task, change)} />}
          </>}
          <p className="studio-hint">当前模型：{active.model || '未配置'}{dedicated ? '（独立配置）' : '（继承配置）'}</p>
          {task === 'visual' && <p className="studio-hint">作为各绘图步骤的默认模型；1A、1B、1C 可以分别覆盖。</p>}
          {task === 'stepParameters' && <p className="studio-hint">请选择支持图片输入的模型。未单独配置时沿用工程文字模型。</p>}
          {task === 'engineering' && <p className="studio-hint">用于七步设计中的功能与 CMF、PCB、结构、DFM 和包装文字分析，不用于图片生成。</p>}
        </fieldset>
      })}

      <p className="studio-hint">
        当前仅支持现有后端兼容的云端接口。
        Ollama、Gemini、Claude 等非兼容接口需要额外适配。
        服务商和模型预设不代表已通过连接测试。
      </p>
    </div>
  )
}
