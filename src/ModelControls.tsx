import { canUseCustomModel, hasModelSettings } from './modelGeneration'
import type { ModelSettings } from './modelGeneration'
import './ModelControls.css'

type ModelControlsProps = {
  settings: ModelSettings
  customModel: boolean
  onModeChange: (custom: boolean) => void
  disabled: boolean
  requestDescription: string
  onOpenModelCenter: () => void
}

export function ModelControls({
  settings,
  customModel,
  onModeChange,
  disabled,
  requestDescription,
  onOpenModelCenter,
}: ModelControlsProps) {
  const available = canUseCustomModel(window.location.hostname)
  const configured = hasModelSettings(settings)

  return (
    <div className="model-controls">
      <div className="model-controls-row">
        <label>
          生成方式
          <select
            value={customModel ? 'api' : 'rules'}
            disabled={disabled}
            onChange={event => onModeChange(event.target.value === 'api')}
          >
            <option value="rules">本地规则（非 AI）</option>
            <option value="api" disabled={!available}>
              AI 模型生成
            </option>
          </select>
        </label>

        <button
          type="button"
          disabled={disabled}
          onClick={onOpenModelCenter}
        >
          配置 AI 模型
        </button>

        {customModel && (
          <span className="model-active" role="status">
            {configured ? settings.model.trim() : '尚未配置模型'}
          </span>
        )}
      </div>

      {customModel && <p>{requestDescription}</p>}

      {customModel && !configured && (
        <p className="studio-hint">
          请在 AI 模型中心配置创意生成模型。
        </p>
      )}

      {!available && (
        <p>请通过 localhost 打开工作台以使用自定义模型服务。</p>
      )}
    </div>
  )
}