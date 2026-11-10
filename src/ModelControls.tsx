import { useRef } from 'react'
import { canUseCustomModel, hasModelSettings } from './modelGeneration'
import type { ModelSettings } from './modelGeneration'
import './ModelControls.css'

type ModelControlsProps = {
  settings: ModelSettings
  onSettingsChange: (change: Partial<ModelSettings>) => void
  customModel: boolean
  onModeChange: (custom: boolean) => void
  disabled: boolean
  requestDescription: string
}

export function ModelControls({
  settings, onSettingsChange, customModel, onModeChange, disabled, requestDescription,
}: ModelControlsProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const available = canUseCustomModel(window.location.hostname)
  const configured = hasModelSettings(settings)

  return (
    <div className="model-controls">
      <div className="model-controls-row">
        <label>
          生成方式
          <select value={customModel ? 'api' : 'rules'} disabled={disabled} onChange={event => {
            const custom = event.target.value === 'api'
            onModeChange(custom)
            if (custom && !configured) dialog.current?.showModal()
          }}>
            <option value="rules">本地规则（非 AI）</option>
            <option value="api" disabled={!available}>自配 API 模型</option>
          </select>
        </label>
        {customModel && (
          <button type="button" disabled={disabled} onClick={() => dialog.current?.showModal()}>API 设置</button>
        )}
        {customModel && configured && <span className="model-active">{settings.model.trim()}</span>}
      </div>
      {customModel && <p>{requestDescription}</p>}
      {!available && <p>请通过 localhost 打开工作台以使用自配 API 模型。</p>}
      <dialog
        ref={dialog}
        className="model-dialog"
        aria-label="模型 API 设置"
        onKeyDown={event => {
          if (event.key === 'Enter' && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) {
            event.preventDefault()
            dialog.current?.close()
          }
        }}
      >
        <h2>模型 API 设置</h2>
        <div className="model-settings">
          <label>
            API 地址
            <input inputMode="url" maxLength={1000} value={settings.baseUrl}
              onChange={event => onSettingsChange({ baseUrl: event.target.value })} placeholder="https://api.deepseek.com" />
          </label>
          <label>
            模型 ID
            <input maxLength={200} value={settings.model}
              onChange={event => onSettingsChange({ model: event.target.value })} placeholder="deepseek-flash" />
          </label>
          <label>
            API 密钥
            <input type="password" autoComplete="off" maxLength={2048} value={settings.apiKey}
              onChange={event => onSettingsChange({ apiKey: event.target.value })} />
          </label>
          <p>设置在创意对话与 Concept Studio 间共用，刷新页面后清除。API 用量由服务商账户计费。</p>
          <div className="model-controls-row">
            <button type="button" onClick={() => onSettingsChange({
              baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash',
            })}>
              填入 DeepSeek 示例
            </button>
            <button type="button" className="model-done" onClick={() => dialog.current?.close()}>完成</button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
