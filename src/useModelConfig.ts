import { useCallback, useEffect, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import { emptyModelConfig, loadModelConfig, saveModelConfig, forgetModelConfig } from './modelConfigStore'
import type { ModelCenterConfig } from './modelConfigStore'

const rememberKey = 'inno-lit-model-remember-v1'
function rememberPreference() {
  try { return localStorage.getItem(rememberKey) !== 'false' } catch { return false }
}
export function useModelConfig() {
  const [config, setConfig] = useState(emptyModelConfig)
  const [ready, setReady] = useState(() => !rememberPreference())
  const [remember, setRemember] = useState(rememberPreference)
  const [notice, setNotice] = useState(() => rememberPreference() ? '正在读取上次配置…' : '当前仅在本次页面会话使用模型配置。')
  const saving = useRef<AbortController | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadFailed = useRef(false)

  useEffect(() => {
    let live = true
    if (!rememberPreference()) {
      return () => { live = false }
    }
    void loadModelConfig().then(saved => {
      if (!live) return
      if (saved) setConfig(saved)
      setNotice(saved ? '已恢复上次保存的模型配置。' : '配置将记住在此浏览器中。')
    }).catch(() => {
      if (!live) return
      loadFailed.current = true
      setNotice('上次配置无法读取，自动保存已暂停。可重新填写并点击保存，或清除已保存配置。')
    }).finally(() => { if (live) setReady(true) })
    return () => { live = false }
  }, [])

  const saveNow = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saving.current?.abort()
    const controller = new AbortController()
    saving.current = controller
    try {
      if (!remember) {
        localStorage.setItem(rememberKey, 'false')
        forgetModelConfig()
        loadFailed.current = false
        setNotice('仅在本次页面会话使用，已清除保存的配置。')
        return true
      }
      localStorage.setItem(rememberKey, 'true')
      await saveModelConfig(config, undefined, undefined, controller.signal)
      if (!controller.signal.aborted) {
        loadFailed.current = false
        setNotice('模型、地址、协议及 API Key 已加密保存到此浏览器。')
      }
      return !controller.signal.aborted
    } catch {
      if (!controller.signal.aborted) setNotice('配置保存失败，当前只能在本次页面会话使用。请检查浏览器存储权限。')
      return false
    }
  }, [config, remember])

  useEffect(() => {
    // Hydration must finish before any write. Failed loads stay intact until an explicit save or clear.
    if (!ready || loadFailed.current) return
    const timer = setTimeout(() => { void saveNow() }, 500)
    saveTimer.current = timer
    return () => { clearTimeout(timer); saving.current?.abort() }
  }, [saveNow, ready])

  function forget() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saving.current?.abort()
    setRemember(false)
    try {
      localStorage.setItem(rememberKey, 'false')
      forgetModelConfig()
      loadFailed.current = false
      setNotice('已清除保存的配置，当前填写内容仍可在本次会话使用。')
    } catch { setNotice('无法清除保存的配置，请检查浏览器存储权限。') }
  }
  function update<K extends keyof ModelCenterConfig>(key: K, value: SetStateAction<ModelCenterConfig[K]>) {
    setConfig(current => ({ ...current, [key]: typeof value === 'function'
      ? (value as (previous: ModelCenterConfig[K]) => ModelCenterConfig[K])(current[key]) : value }))
  }
  return {
    modelSettings: config.text, imageSettings: config.image, workflowRouting: config.workflow,
    setModelSettings: (value: SetStateAction<ModelCenterConfig['text']>) => update('text', value),
    setImageSettings: (value: SetStateAction<ModelCenterConfig['image']>) => update('image', value),
    setWorkflowRouting: (value: SetStateAction<ModelCenterConfig['workflow']>) => update('workflow', value),
    ready, remember, notice, saveNow, forget,
    setRemember: (value: boolean) => {
      if (!value) forget()
      else {
        setRemember(true)
        try { localStorage.setItem(rememberKey, 'true') } catch { setNotice('浏览器无法保存记住配置的设置。') }
      }
    },
  }
}
