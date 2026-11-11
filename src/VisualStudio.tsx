import { useEffect, useState } from 'react'
import type { Concept, ConceptBatch } from './concepts'
import { developmentOf } from './conceptDevelopment'
import { consistencyChecks, entryRoles, entryVisualKey, visualProblems } from './entryVisuals'
import type { EntryRole } from './entryVisuals'
import { imageSizes } from './imageGeneration'
import type { ImageSettings } from './imageGeneration'
import { getVisual, visualKey } from './visualStore'
import type { SavedVisual } from './visualStore'
import { downloadBlob } from './conceptBoard'
import { EntryImageEditor } from './EntryImageEditor'
import './VisualStudio.css'

type VisualProps = {
  projectId: string; projectName: string; round: ConceptBatch; roundNumber: number; concept: Concept
  imageSettings: ImageSettings
  onImageSettingsChange: (change: Partial<ImageSettings>) => void
  onChange: (update: (current: Concept) => Concept) => void
}
const roles = Object.keys(entryRoles) as EntryRole[]

export function VisualStudio({ projectId, roundNumber, concept, imageSettings, onImageSettingsChange, onChange }: VisualProps) {
  const development = developmentOf(concept)
  const versions = [...(development.frozen ? [development.frozen] : []), ...development.history.slice().reverse()]
  const [selectedVersion, setSelectedVersion] = useState(versions[0]?.id ?? '')
  const frozen = versions.find(item => item.id === selectedVersion)
  const [role, setRole] = useState<EntryRole>(concept.visualEntry ?? 'master')
  const [records, setRecords] = useState<Partial<Record<EntryRole, SavedVisual>>>({})
  const [legacy, setLegacy] = useState<SavedVisual>()
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [imageBusy, setImageBusy] = useState(false)
  const frozenId = frozen?.id
  useEffect(() => {
    let active = true
    getVisual(visualKey(projectId, roundNumber, concept.id)).then(item => { if (active) setLegacy(item) }).catch(() => {})
    return () => { active = false }
  }, [projectId, roundNumber, concept.id])
  useEffect(() => {
    if (!frozenId) return
    let active = true
    Promise.all(roles.map(role => getVisual(entryVisualKey(projectId, roundNumber, concept.id, frozenId, role)))).then(items => {
      if (active) { setRecords(Object.fromEntries(roles.map((role, index) => [role, items[index]]))); setLoading(false); setLoadError('') }
    }).catch(() => { if (active) { setLoadError('图片存储读取失败，请检查浏览器存储权限。'); setLoading(false) } })
    return () => { active = false }
  }, [projectId, roundNumber, concept.id, frozenId])
  const locked = development.frozen?.id !== frozenId
  const directionKey = `${frozenId}:${role}`
  const complete = frozen && (['landscape', 'portrait', 'poster'] as const).every(role => !visualProblems(frozen, role, records[role], records.master, records).length)
  return <section className="studio-surface studio-refinement visual-studio">
    <h2>概念图与展板 · 同一冻结产品的三个信息入口</h2>
    <p>母版统一产品设计，三张图分别承担 WHY / WHAT、HOW 和完整设计叙事。独立构图，逐项审核后才能导出。</p>
    {legacy && <p className="studio-hint">旧版概念图仍保留。<button type="button" className="studio-button" onClick={() => downloadBlob(legacy.blob, 'INNO-LIT-旧版概念图.' + (legacy.blob.type === 'image/jpeg' ? 'jpg' : legacy.blob.type === 'image/webp' ? 'webp' : 'png'))}>下载旧图留存</button></p>}
    {!frozen ? <p>请先在「完善与冻结」完成 AI 深化、人工确认和概念冻结。</p> : <>
      <label className="studio-field">展示版本<select disabled={imageBusy} value={selectedVersion} onChange={event => { setSelectedVersion(event.target.value); setRecords({}); setLoading(true) }}>
        {versions.map(item => <option key={item.id} value={item.id}>V{item.revision} · {item.design.title}{development.frozen?.id === item.id ? '（当前冻结版）' : '（历史只读）'}</option>)}
      </select></label>
      <p className="studio-badge">{complete ? '三张入口均已审核完成' : '展示制作进行中'} · 冻结 V{frozen.revision} · {frozen.id}</p>
      <details><summary>固定产品规范</summary><dl>{Object.entries(consistencyChecks).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{frozen.identity[key as keyof typeof frozen.identity]}</dd></div>)}</dl></details>
      <details className="visual-api-settings"><summary>图片模型 API 设置</summary>
        <p>产品母版可用 Kolors；延展图片必须传入母版参考。参考图和提示词会发送给你配置的服务。</p>
        <div className="studio-validation-fields">
          <label className="studio-field">图片 API 地址<input value={imageSettings.baseUrl} maxLength={1000} onChange={event => onImageSettingsChange({ baseUrl: event.target.value })} /></label>
          <label className="studio-field">图片模型 ID<input value={imageSettings.model} maxLength={200} onChange={event => onImageSettingsChange({ model: event.target.value })} /></label>
          <label className="studio-field">图片 API 密钥<input type="password" autoComplete="off" value={imageSettings.apiKey} maxLength={2048} onChange={event => onImageSettingsChange({ apiKey: event.target.value })} /></label>
          <label className="studio-field">图片接口格式<select value={imageSettings.protocol} onChange={event => onImageSettingsChange({ protocol: event.target.value as ImageSettings['protocol'] })}><option value="siliconflow">SiliconFlow</option><option value="images">Images 兼容接口（母版）</option></select></label>
          <label className="studio-field">母版图片尺寸<select value={imageSettings.size} onChange={event => onImageSettingsChange({ size: event.target.value as ImageSettings['size'] })}>{imageSizes.map(size => <option key={size}>{size}</option>)}</select></label>
        </div>
        <div className="studio-actions">
          <button type="button" className="studio-button" onClick={() => onImageSettingsChange({ baseUrl: 'https://api.siliconflow.cn/v1', model: 'Kwai-Kolors/Kolors', protocol: 'siliconflow', size: '1024x1024' })}>填入 Kolors 母版示例</button>
          <button type="button" className="studio-button" onClick={() => onImageSettingsChange({ baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen-Image-Edit-2509', protocol: 'siliconflow' })}>填入参考图编辑示例</button>
        </div><p className="studio-hint">示例不包含密钥，费用按所选服务规则计算。参考图编辑不发送 image_size，输出构图需人工核对。设置刷新后清除。</p>
      </details>
      <nav className="studio-refinement-nav" aria-label="展示入口">{roles.map(key => <button type="button" key={key} disabled={imageBusy} className="studio-button" aria-pressed={role === key} onClick={() => { setRole(key); onChange(current => ({ ...current, visualEntry: key })) }}>{entryRoles[key]}</button>)}</nav>
      {loadError ? <p role="alert">{loadError}</p> : loading ? <p>正在读取当前冻结版本的图片…</p> : <EntryImageEditor key={`${frozen.id}:${role}`} frozen={frozen} projectId={projectId}
        id={entryVisualKey(projectId, roundNumber, concept.id, frozen.id, role)} role={role} record={records[role]} master={records.master} records={records}
        settings={imageSettings} direction={concept.visualDirections?.[directionKey] ?? ''} locked={locked}
        onDirection={value => onChange(current => ({ ...current, visualDirections: { ...current.visualDirections, [directionKey]: value } }))}
        onSaved={visual => setRecords(current => ({ ...current, [role]: visual }))} onBusy={setImageBusy} />}
    </>}
  </section>
}
