
import { useRef, useState } from 'react'
import {
  canUseCustomModel,
  hasModelSettings,
} from './modelGeneration'
import type { ModelSettings } from './modelGeneration'
import './ModelControls.css'

type ModelControlsProps = {
  settings: ModelSettings
  onSettingsChange: (change: Partial<ModelSettings>) => void
  customModel: boolean
  onModeChange: (custom: boolean) => void
  disabled: boolean
  requestDescription: string
  settingsOnly?: boolean
}

type ProviderPreset = {
  id: string
  name: string
  baseUrl: string
  models: string[]
}

const providers: ProviderPreset[] = [
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
    name: '自定义 OpenAI 兼容接口',
    baseUrl: '',
    models: [],
  },
]

function findProvider(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '')
  const found = providers.find(
    provider =>
      provider.id !== 'custom' &&
      provider.baseUrl === normalized,
  )
  return found?.id ?? 'custom'
}

export function ModelControls({
  settings,
  onSettingsChange,
  customModel,
  onModeChange,
  disabled,
  requestDescription,
  settingsOnly = false,
}: ModelControlsProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [showKey, setShowKey] = useState(false)

  const available = canUseCustomModel(
    window.location.hostname,
  )
  const configured = hasModelSettings(settings)

  const providerId = findProvider(settings.baseUrl)
  const provider =
    providers.find(item => item.id === providerId) ??
    providers[providers.length - 1]

  function chooseProvider(id: string) {
    const selected = providers.find(item => item.id === id)
    if (!selected) return

    if (selected.id === 'custom') {
      onSettingsChange({
        baseUrl: '',
        model: '',
      })
      return
    }

    onSettingsChange({
      baseUrl: selected.baseUrl,
      model: selected.models[0] ?? '',
    })
  }

  function openSettings() {
    if (!disabled) dialog.current?.showModal()
  }

  return (
    <div className="model-controls">
      <div className="model-controls-row">
        {!settingsOnly && (
          <label>
            生成方式
            <select
              value={customModel ? 'api' : 'rules'}
              disabled={disabled}
              onChange={event => {
                const custom = event.target.value === 'api'
                onModeChange(custom)

                if (custom && !configured) {
                  dialog.current?.showModal()
                }
              }}
            >
              <option value="rules">
                本地规则（非 AI）
              </option>
              <option value="api" disabled={!available}>
                AI 模型生成
              </option>
            </select>
          </label>
        )}

        {(customModel || settingsOnly) && (
          <button
            type="button"
            disabled={disabled}
            onClick={openSettings}
          >
            AI 模型中心
          </button>
        )}

        {customModel && configured && (
          <span className="model-active">
            {settings.model.trim()}
          </span>
        )}
      </div>

      {customModel && <p>{requestDescription}</p>}

      {!available && (
        <p>
          请通过 localhost 打开工作台以使用自定义模型服务。
        </p>
      )}

      <dialog
        ref={dialog}
        className="model-dialog"
        aria-label="AI 模型中心"
      >
        <h2>AI 模型中心</h2>

        <p>
          统一配置创意生成、方案深化和语言转译所用的
          文本模型。图像模型将在下一阶段接入。
        </p>

        <div className="model-settings">
          <label>
            模型服务商
            <select
              value={providerId}
              disabled={disabled}
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
              inputMode="url"
              maxLength={1000}
              disabled={disabled}
              value={settings.baseUrl}
              onChange={event =>
                onSettingsChange({
                  baseUrl: event.target.value,
                })
              }
              placeholder="https://api.example.com/v1"
            />
          </label>

          <label>
            模型 ID
            {provider.models.length > 0 && (
              <select
                value={
                  provider.models.includes(settings.model)
                    ? settings.model
                    : ''
                }
                disabled={disabled}
                onChange={event => {
                  if (event.target.value) {
                    onSettingsChange({
                      model: event.target.value,
                    })
                  }
                }}
              >
                <option value="">
                  自定义模型 ID
                </option>
                {provider.models.map(model => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            )}

            <input
              maxLength={200}
              disabled={disabled}
              value={settings.model}
              onChange={event =>
                onSettingsChange({
                  model: event.target.value,
                })
              }
              placeholder="输入服务商支持的模型 ID"
            />
          </label>

          <label>
            API 密钥
            <input
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              maxLength={2048}
              disabled={disabled}
              value={settings.apiKey}
              onChange={event =>
                onSettingsChange({
                  apiKey: event.target.value,
                })
              }
              placeholder="输入自己的 API Key"
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={showKey}
              onChange={event =>
                setShowKey(event.target.checked)
              }
            />
            显示密钥
          </label>

          <p>
            可选择预设服务商，也可以填写自定义 API
            地址和模型 ID。预设模型仅为示例，
            实际可用性取决于服务商及账户权限。
          </p>

          <p>
            当前配置在创意对话与 Concept Studio
            间共用，刷新页面后清除。
            API 调用费用由服务商收取。
          </p>

          <div className="model-controls-row">
            <span
              className="model-active"
              role="status"
            >
              {configured
                ? `已填写配置：${settings.model}`
                : '尚未完成模型配置'}
            </span>

            <button
              type="button"
              className="model-done"
              onClick={() => dialog.current?.close()}
            >
              完成
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
