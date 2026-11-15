import { useEffect, useState } from 'react'
import type { Concept } from './concepts'
import { canvasBlob } from './conceptBoard'
import { developmentOf } from './conceptDevelopment'
import { pageLayouts, pageSizeProblem, setPageLayout, simpleVisualKey, visualImagePrompt, visualPageRoles, visualPages, visualSettingsOf, visualSubjectOf } from './conceptVisuals'
import type { PageLayout, VisualPageRole, VisualPageSettings, VisualStudioSettings } from './visualStudioTypes'
import { generateConceptImage, imageByteLimit, imageMime, supportsImageReference } from './imageGeneration'
import type { ImageSettings, VisualSource } from './imageGeneration'
import { hasModelSettings } from './modelGeneration'
import { getVisual, putVisual, visualKey } from './visualStore'
import type { SavedVisual } from './visualTypes'
import { renderVisualPage } from './visualIllustration'
import { VisualPagePreview, VisualThumbnail } from './VisualPagePreview'
import { VisualHistory } from './VisualHistory'
import { useModelTask } from './useModelTask'
import { entryVisualKey } from './entryVisuals'
import './VisualStudio.css'

type VisualProps = {
  projectId: string; roundNumber: number; concept: Concept
  imageSettings: ImageSettings
  onChange: (update: (current: Concept) => Concept) => void
}

async function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('参考图片无法读取。'))
    reader.readAsDataURL(blob)
  })
}

function SimpleVisualWorkspace({ projectId, roundNumber, concept, imageSettings, onChange }: VisualProps) {
  const prefs = visualSettingsOf(concept)
  const subject = visualSubjectOf(concept)
  const version = developmentOf(concept).frozen?.id ?? 'draft'
  const conceptKey = JSON.stringify(subject)
  const pages = visualPageRoles.slice(0, prefs.count)
  const active = pages.includes(prefs.active) ? prefs.active : pages[0]
  const page = prefs.pages[active]
  const [records, setRecords] = useState<Partial<Record<VisualPageRole, SavedVisual>>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [progress, setProgress] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const { pending, notice, run, cancel } = useModelTask(390000)
  const configured = hasModelSettings(imageSettings)
  const problems = pages.map(role => pageSizeProblem(prefs.pages[role])).filter(Boolean)
  const record = records[active]

  useEffect(() => {
    let live = true
    async function load() {
      const items = await Promise.all(visualPageRoles.map(role => getVisual(simpleVisualKey(projectId, roundNumber, concept.id, version, role))))
      const legacy = await getVisual(visualKey(projectId, roundNumber, concept.id))
      if (version !== 'draft') {
        const oldRoles = ['landscape', 'portrait', 'poster'] as const
        const old = await Promise.all(oldRoles.map(role => getVisual(entryVisualKey(projectId, roundNumber, concept.id, version, role))))
        old.forEach((item, index) => { items[index] ??= item })
      }
      items[0] ??= legacy
      if (live) { setRecords(Object.fromEntries(visualPageRoles.map((role, index) => [role, items[index]]))); setLoading(false) }
    }
    void load().catch(() => { if (live) { setLoading(false); setLoadError('暂时无法读取旧图片，本地示意仍可预览和导出。') } })
    return () => { live = false }
  }, [projectId, roundNumber, concept.id, version])

  function update(change: Partial<VisualStudioSettings>) {
    onChange(current => ({ ...current, visualStudio: { ...visualSettingsOf(current), ...change } }))
  }
  function updatePage(change: Partial<VisualPageSettings>) {
    onChange(current => {
      const settings = visualSettingsOf(current)
      return { ...current, visualStudio: { ...settings, pages: { ...settings.pages, [active]: { ...settings.pages[active], ...change } } } }
    })
  }
  async function save(blob: Blob, role: VisualPageRole, source: VisualSource, prompt: string, signal: AbortSignal) {
    const mime = imageMime(new Uint8Array(await blob.slice(0, 12).arrayBuffer()))
    if (!mime || blob.size > imageByteLimit) throw new Error('请使用 8 MB 以内的 PNG、JPEG 或 WebP 图片。')
    const decoded = await createImageBitmap(blob).catch(() => { throw new Error('图片内容无法读取。') })
    const oversized = decoded.width > 8192 || decoded.height > 8192
    decoded.close()
    if (oversized) throw new Error('图片边长不能超过 8192 像素。')
    signal.throwIfAborted()
    const visual = await putVisual({ id: simpleVisualKey(projectId, roundNumber, concept.id, version, role), projectId,
      blob: new Blob([blob], { type: mime }), source, prompt, pageRole: role, conceptKey }, signal)
    if (!signal.aborted) setRecords(current => ({ ...current, [role]: visual }))
    return visual
  }
  function generate(selected = pages) {
    void run(async signal => {
      try {
        const referenceImage = records.overview?.source.kind !== 'local' && records.overview
          || visualPageRoles.map(role => records[role]).find(item => item && item.source.kind !== 'local')
        const reference = prefs.mode === 'api' && supportsImageReference(imageSettings)
          ? referenceImage ? await dataUrl(referenceImage.blob) : undefined : undefined
        if (prefs.mode === 'api' && imageSettings.protocol === 'siliconflow' && supportsImageReference(imageSettings) && !reference) throw new Error('这个模型需要参考图。先上传一张产品图片，或选择 Kolors 等文生图模型。')
        for (let index = 0; index < selected.length; index++) {
          signal.throwIfAborted()
          const role = selected[index]
          setProgress(`正在生成 ${index + 1} / ${selected.length}：${visualPages[role]}`)
          const page = prefs.pages[role]
          const problem = pageSizeProblem(page)
          if (problem) throw new Error(problem)
          if (prefs.mode === 'local') {
            const canvas = document.createElement('canvas')
            renderVisualPage(canvas, subject, role, page, undefined, { kind: 'local' })
            await save(await canvasBlob(canvas), role, { kind: 'local' }, page.description, signal)
          } else {
            const prompt = visualImagePrompt(subject, role, page.description, Boolean(reference))
            const purpose = ['openrouter'].includes(imageSettings.protocol) ? 'master' : 'concept'
            const blob = await generateConceptImage(imageSettings, prompt, signal, { purpose, ...(reference ? { reference } : {}) })
            await save(blob, role, { kind: 'model', model: imageSettings.model.trim(), provider: new URL(imageSettings.baseUrl).hostname }, prompt, signal)
          }
        }
      } finally { setProgress('') }
    }, () => {}, '概念图已保存。可逐张调整版式、尺寸并导出。')
  }

  return <section className="studio-surface studio-refinement visual-studio">
    <div><h2>概念图与展板</h2><p>用图表达概念。默认三张，也可以减少张数，自由选择版式和导出尺寸。</p></div>
    <div className="visual-simple-options">
      <label className="studio-field">生成方式<select value={prefs.mode} disabled={pending} onChange={event => update({ mode: event.target.value as VisualStudioSettings['mode'] })}><option value="local">本地概念示意（非 AI）</option><option value="api">自配图片 API</option></select></label>
      <label className="studio-field">图片数量<select value={prefs.count} disabled={pending} onChange={event => {
        const count = Number(event.target.value) as VisualStudioSettings['count']; update({ count, active: visualPageRoles.slice(0, count).includes(active) ? active : 'overview' })
      }}><option value={1}>1 张</option><option value={2}>2 张</option><option value={3}>3 张</option></select></label>
    </div>
    {prefs.mode === 'api' && <p className="studio-hint">{configured ? `使用 AI 模型中心的图片模型：${imageSettings.model}` : '请先在顶部 AI 模型中心配置图片模型。'}</p>}
    <div className="studio-actions">
      <button type="button" className="studio-button primary" disabled={pending || loading || problems.length > 0 || prefs.mode === 'api' && !configured} onClick={() => generate()}>生成 {prefs.count} 张概念图</button>
      <button type="button" className="studio-button" disabled={pending || loading || Boolean(pageSizeProblem(page)) || prefs.mode === 'api' && !configured} onClick={() => generate([active])}>只生成当前图</button>
      <label className="studio-button visual-upload">上传当前图<input aria-label="上传当前图" type="file" accept="image/png,image/jpeg,image/webp" disabled={pending || loading} onChange={event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
        void run(signal => save(file, active, { kind: 'upload' }, page.description, signal), () => {}, '图片已保存，可调整版式和尺寸。')
      }} /></label>
      {pending && <button type="button" className="studio-button" onClick={() => { cancel(); setProgress('') }}>取消生成</button>}
    </div>
    <p className="studio-hint" role="status">{progress || notice.replace('已取消模型请求。', '已取消生成，已保存的图片会保留。') || loadError || (prefs.mode === 'local' ? '本地按概念内容绘制场景和交互示意，无需 API。' : '三图共用概念描述，可分别重生成或上传替换。')} · {subject.version}</p>
    <nav className="visual-page-tabs" aria-label="概念图片">{pages.map((role, index) => <button key={role} type="button" className="visual-page-tab" aria-pressed={active === role} disabled={pending} onClick={() => update({ active: role })}>
      <VisualThumbnail key={records[role]?.id ?? role} record={records[role]} /><span>第 {index + 1} 张 · {visualPages[role]}</span>
    </button>)}</nav>
    <div className="visual-layout-controls">
      <label className="studio-field">版式<select value={page.layout} disabled={pending} onChange={event => updatePage(setPageLayout(page, event.target.value as PageLayout))}>{Object.entries(pageLayouts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="studio-field">宽度（px）<input type="number" min={320} max={6000} step={1} disabled={pending} value={page.width || ''} onChange={event => updatePage({ layout: 'custom', width: event.target.valueAsNumber || 0 })} /></label>
      <label className="studio-field">高度（px）<input type="number" min={320} max={6000} step={1} disabled={pending} value={page.height || ''} onChange={event => updatePage({ layout: 'custom', height: event.target.valueAsNumber || 0 })} /></label>
    </div>
    {record?.conceptKey && record.conceptKey !== conceptKey && <p className="studio-hint">概念内容已更新，可以重新生成图片。</p>}
    <VisualPagePreview key={`${version}:${active}:${record?.source.kind ?? 'local'}`} subject={subject} role={active} page={page} record={record} pending={pending} />
    <details><summary>{prefs.mode === 'api' ? '补充画面描述' : '补充图片说明'}（可选）</summary><label className="studio-field">{prefs.mode === 'api' ? '画面描述' : '图片说明'}<textarea rows={3} maxLength={1500} disabled={pending} value={page.description} onChange={event => updatePage({ description: event.target.value })} /></label></details>
    <details onToggle={event => { if (event.currentTarget.open) setHistoryOpen(true) }}><summary>之前保存的图片</summary>{historyOpen && <VisualHistory projectId={projectId} roundNumber={roundNumber} concept={concept} />}</details>
  </section>
}

export function ConceptVisualWorkspace(props: VisualProps) {
  const version = developmentOf(props.concept).frozen?.id ?? 'draft'
  return <SimpleVisualWorkspace key={`${props.projectId}:${props.roundNumber}:${props.concept.id}:${version}`} {...props} />
}
