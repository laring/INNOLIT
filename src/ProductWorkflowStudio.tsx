import { useEffect, useState } from 'react'
import type { Concept } from './concepts'
import type { ImageSettings, VisualSource } from './imageGeneration'
import { generateConceptImage, supportsImageReference } from './imageGeneration'
import { hasModelSettings } from './modelGeneration'
import type { ModelSettings } from './modelGeneration'
import { productStages, styleDirections, workflowContext, workflowImagePrompt, workflowOf, printResolution } from './productWorkflow'
import type { ProductAsset, ProductStage, ProductWorkflow, StyleDirection } from './productWorkflow'
import { getVisual, projectVisuals, putVisual } from './visualStore'
import type { SavedVisual } from './visualTypes'
import { downloadBlob } from './conceptBoard'
import { explodedPrint, imageDataUrl, imageDigest, presetStyleImage, selectedSketch, validateProductImage } from './productWorkflowImages'
import { EngineeringPanel, PackagingPanel } from './ProductEngineeringPanels'
import { analyzeEngineering } from './engineeringModel'
import { useModelTask } from './useModelTask'
import './ProductWorkflowStudio.css'

type Props = { projectId: string; roundNumber: number; concept: Concept; imageSettings: ImageSettings; modelSettings: ModelSettings; onChange: (update: (current: Concept) => Concept) => void }
export function ProductWorkflowStudio({ projectId, roundNumber, concept, imageSettings, modelSettings, onChange }: Props) {
  const data = workflowOf(concept), active = productStages[data.stage] ? data.stage : 'sketches'
  const [records, setRecords] = useState<Record<string, SavedVisual>>({})
  const [history, setHistory] = useState<SavedVisual[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const { pending, notice, run, cancel } = useModelTask(300000)
  const ids = JSON.stringify(data.assets)
  useEffect(() => {
    let live = true
    const values = Object.values(JSON.parse(ids) as ProductWorkflow['assets']).filter((id): id is string => Boolean(id))
    void Promise.all(values.map(getVisual)).then(items => {
      if (live) { setRecords(Object.fromEntries(items.filter((item): item is SavedVisual => Boolean(item)).map(item => [item.id, item]))); setLoading(false); setLoadError('') }
    }).catch(() => { if (live) { setLoading(false); setLoadError('图片存储暂时无法读取，请检查浏览器存储权限。') } })
    return () => { live = false }
  }, [ids, projectId, roundNumber, concept.id])
  const asset = (role: ProductAsset) => data.assets[role] ? records[data.assets[role]!] : undefined
  const current = (role: ProductAsset) => Boolean(asset(role) && asset(role)!.conceptKey === workflowContext(concept, role))
  const heroReady = current('hero') && data.confirmedHero === data.assets.hero
  const configured = hasModelSettings(imageSettings), referenceSupported = supportsImageReference(imageSettings)
  const stageIndex = Object.keys(productStages).indexOf(active)
  function edit(update: (current: ProductWorkflow) => ProductWorkflow) { onChange(current => ({ ...current, productWorkflow: update(workflowOf(current)) })) }
  function change(patch: Partial<ProductWorkflow>) { edit(current => ({ ...current, ...patch })) }
  async function storeImage(role: ProductAsset, blob: Blob, source: VisualSource, prompt: string, context: string, signal: AbortSignal) {
    const checked = await validateProductImage(blob), digest = await imageDigest(checked)
    const record = await putVisual({ id: JSON.stringify([projectId, roundNumber, concept.id, 'product-workflow', role, crypto.randomUUID()]), projectId, blob: checked, source, prompt, digest, conceptKey: context, workflowKind: role }, signal)
    signal.throwIfAborted()
    setRecords(current => ({ ...current, [record.id]: record }))
    return record
  }
  function adoptAsset(role: ProductAsset, record: SavedVisual, selection?: number) {
    edit(current => ({ ...current, ...(selection === undefined ? {} : { selection }), assets: { ...current.assets, [role]: record.id } }))
  }
  function upload(role: ProductAsset, file: File) {
    void run(signal => storeImage(role, file, { kind: 'upload' }, '用户上传', workflowContext(concept, role), signal), record => adoptAsset(role, record), '图片已保存。后续步骤会使用当前图片。')
  }
  function generate(role: 'sheet' | 'hero' | 'exploded' | 'package') {
    void run(async signal => {
      if (!data.productName.trim()) throw new Error('请先填写产品名称。')
      if (!configured) throw new Error('请先在 AI 模型中心配置图片模型。')
      if (!referenceSupported && (role !== 'sheet' || asset('style'))) throw new Error('这一步需要参考图编辑能力。请在 AI 模型中心使用已支持的参考图模型，或上传你在外部制作的图片。')
      let reference: Blob | undefined
      if (role === 'sheet') reference = asset('style')?.blob ?? await presetStyleImage(data.style)
      else if (role === 'hero') {
        if (!current('selected')) throw new Error('请先选定当前草图。')
        reference = asset('selected')!.blob
      } else {
        if (!heroReady) throw new Error('请先在第二步确认当前产品外观基准。')
        reference = asset('hero')!.blob
      }
      const prompt = workflowImagePrompt(concept, role)
      const blob = await generateConceptImage(imageSettings, prompt, signal, { purpose: imageSettings.protocol === 'openrouter' ? 'master' : 'concept', ...(referenceSupported && reference ? { reference: await imageDataUrl(reference) } : {}) })
      return storeImage(role, blob, { kind: 'model', model: imageSettings.model.trim(), provider: new URL(imageSettings.baseUrl).hostname }, prompt, workflowContext(concept, role), signal)
    }, record => adoptAsset(role, record), '当前步骤的图片已生成并保存，请核对设计与标注。')
  }
  function imageActions(role: 'sheet' | 'hero' | 'exploded' | 'package', label: string, ready = true) {
    return <div className="studio-actions">
      <button type="button" className="studio-button primary" disabled={pending || loading || !ready || !configured || !referenceSupported && !(role === 'sheet' && !data.assets.style)} onClick={() => generate(role)}>{label}</button>
      {role !== 'sheet' && <label className="studio-button visual-upload">上传{role === 'hero' ? '产品效果图' : role === 'exploded' ? '结构爆炸图' : '包装效果图'}<input type="file" aria-label={`上传${role}`} accept="image/png,image/jpeg,image/webp" disabled={pending || loading || !ready} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) upload(role, file) }} /></label>}
    </div>
  }
  const filename = (record: SavedVisual) => `INNO-LIT-${record.workflowKind ?? '参考图'}.${record.blob.type === 'image/jpeg' ? 'jpg' : record.blob.type === 'image/webp' ? 'webp' : 'png'}`
  function imagePreview(role: ProductAsset, label: string) {
    const record = asset(role)
    return record ? <div className="studio-refinement">
      {role !== 'style' && !current(role) && <p className="studio-hint">上游选择或产品资料已变化，这张图是先前版本，请重新生成或上传。</p>}
      <ProductImage key={record.id} record={record} label={label} />
      <button type="button" className="studio-button" disabled={pending} onClick={() => downloadBlob(record.blob, filename(record))}>下载原图</button>
    </div> : <p className="workflow-empty">{label}将在这里显示。可调用自己的图片模型，或上传已有图片。</p>
  }
  return <section className="studio-surface studio-refinement product-workflow">
    <header><h2>概念图与展板 · 五步产品设计</h2><p>十款草图 → 选款效果图 → 结构爆炸图 → 模具 DFM → 品牌包装。确认一次产品外观，后续步骤沿用同一产品。</p></header>
    <nav className="product-step-nav" aria-label="产品设计步骤">{(Object.keys(productStages) as ProductStage[]).map((stage, index) => <button type="button" key={stage} className="studio-button" disabled={pending} aria-pressed={active === stage} onClick={() => change({ stage })}><span>{index + 1}</span>{productStages[stage].title}</button>)}</nav>
    <div className="workflow-role"><span>步骤 {stageIndex + 1}</span><h3>{productStages[active].title}</h3><p>角色：{productStages[active].role}</p></div>
    <details open={active === 'sketches' || active === 'render'}><summary>统一产品与品牌资料</summary><fieldset className="development-fields studio-refinement" disabled={pending}>
      <div className="workflow-parameter-grid"><label className="studio-field">产品名称<input maxLength={100} value={data.productName} onChange={event => change({ productName: event.target.value })} /></label><label className="studio-field">品牌／Logo 文字<input maxLength={100} value={data.brand} onChange={event => change({ brand: event.target.value })} /></label><label className="studio-field">品牌主色<input type="color" value={data.brandColor} onChange={event => change({ brandColor: event.target.value })} /></label></div>
      <label className="studio-field">实际功能与关键交互<textarea rows={3} maxLength={2000} value={data.functions} onChange={event => change({ functions: event.target.value })} /></label>
      <label className="studio-field">设计方向与价值目标<textarea rows={3} maxLength={2000} value={data.direction} onChange={event => change({ direction: event.target.value })} /></label>
    </fieldset></details>
    {!referenceSupported && <p className="studio-hint">当前图片模型按内置风格描述生成十款草图，不能读取上传的风格图。第二步起若要自动沿用选款与外观，请在模型中心切换支持参考图的模型；也可逐步上传外部完成的图片。</p>}
    <p className="studio-hint" role="status">{notice || loadError || (configured ? `图片模型：${imageSettings.model}；工程文字模型：${modelSettings.model || '未配置'}` : '请在顶部 AI 模型中心配置图片模型，或上传已有图片。')}</p>
    {pending && <button type="button" className="studio-button" onClick={cancel}>取消当前操作</button>}
    {active === 'sketches' && <>
      <p>由 AI 自动生成 10 款不同的产品设计草图，再从中选择一款深化。选择下方内置风格即可生成，无需上传草图；你也可以额外上传 1 张风格参考图，仅用于参考画风。</p>
      <div className="workflow-style-grid">{(Object.keys(styleDirections) as StyleDirection[]).map(style => <button type="button" key={style} className="workflow-style-card" aria-pressed={data.style === style && !data.assets.style} disabled={pending} onClick={() => edit(current => ({ ...current, style, assets: { ...current.assets, style: undefined } }))}><svg viewBox="0 0 200 100" aria-hidden="true"><rect width="200" height="100" fill="#f4f5f0"/><path d={style === 'organic' ? 'M40 70Q5 20 100 20T150 70Q100 100 40 70' : 'M35 75L55 25L150 20L165 65Z'} fill={styleDirections[style].color + '35'} stroke={styleDirections[style].color} strokeWidth={style === 'minimal' ? 1 : 3}/><path d="M25 85L175 75" stroke={styleDirections[style].color}/></svg><span>{styleDirections[style].name}</span></button>)}</div>
      <details><summary>使用自己的风格参考图（可选，1 张）</summary><p className="studio-hint">这张图只作为画风参考。10 款产品草图仍由 AI 生成；使用内置风格时无需上传任何图片。</p><label className="studio-button visual-upload">上传 1 张风格参考图<input type="file" aria-label="上传风格参考图" accept="image/png,image/jpeg,image/webp" disabled={pending} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) upload('style', file) }} /></label>
      {asset('style') && imagePreview('style', '风格参考图')}
      {data.assets.style && <button type="button" className="studio-button" disabled={pending} onClick={() => edit(current => ({ ...current, assets: { ...current.assets, style: undefined } }))}>取消参考图，使用内置风格</button>}</details>
      {imageActions('sheet', 'AI 生成 10 款设计草图')}
      <p className="studio-hint">生成结果按 2×5 汇总展示，点击 01–10 选定其中一款。</p>
      {asset('sheet') ? <><div className="workflow-sketch-sheet"><ProductImage key={asset('sheet')!.id} record={asset('sheet')!} label="十款设计草图" /><div className="workflow-sketch-grid">{Array.from({ length: 10 }, (_, index) => <button type="button" key={index} disabled={pending || !current('sheet')} aria-label={`选择草图 ${String(index + 1).padStart(2, '0')}`} aria-pressed={data.selection === index} onClick={() => {
        const selectedConcept = { ...concept, productWorkflow: { ...data, selection: index } }
        void run(async signal => storeImage('selected', await selectedSketch(asset('sheet')!.blob, index), { kind: 'upload' }, `从十款图中提取 ${index + 1}`, workflowContext(selectedConcept, 'selected'), signal), record => adoptAsset('selected', record, index), `已选草图 ${String(index + 1).padStart(2, '0')}。可进入第二步。`)
      }}><span>{String(index + 1).padStart(2, '0')}</span></button>)}</div></div><p className="studio-hint">按 2×5 网格点击选款。若模型未严格分格，可上传已单独截取的草图替换。</p></> : imagePreview('sheet', '十款草图')}
      <details><summary>手动替换选定草图（可选）</summary><label className="studio-button visual-upload">上传单款草图<input type="file" aria-label="上传单款草图" accept="image/png,image/jpeg,image/webp" disabled={pending} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) upload('selected', file) }} /></label></details>
      {asset('selected') && imagePreview('selected', '选定的草图')}
    </>}
    {active === 'render' && <><p>只深化选定草图，强调前沿风格、轻盈造型、人文与情感价值。功能、绿色制造和原创性是待验证的设计目标；不能自动变成产品声明。</p>
      <button type="button" className="studio-button" disabled={pending || !hasModelSettings(modelSettings)} onClick={() => void run(signal => analyzeEngineering(concept, 'industrial', modelSettings, signal), renderNotes => change({ renderNotes: `模型建议（${modelSettings.model}，基于文字，待人工核对）：\n${renderNotes}` }), '功能与 CMF 建议已保存，可修正后用于效果图。')}>AI 功能与 CMF 深化建议</button>
      <label className="studio-field">效果图深化说明<textarea rows={5} maxLength={8000} value={data.renderNotes} disabled={pending} onChange={event => change({ renderNotes: event.target.value })} /></label>
      {imagePreview('selected', '选定的草图')}{imageActions('hero', '生成选定产品效果图', current('selected'))}{imagePreview('hero', '产品效果图')}<button type="button" className="studio-button primary" disabled={pending || !current('hero')} onClick={() => change({ confirmedHero: data.assets.hero })}>{heroReady ? '当前产品外观已确认为统一基准' : '确认此产品外观，供后续步骤使用'}</button><p className="studio-hint">核对造型、比例、材质、配色、交互、产品名称及 Logo。产品资料或上游选款改变后，旧图会标为待更新。</p></>}
    {active === 'structure' && <><p>沿用第二步产品外观，制作带编号的详细结构爆炸示意。内部结构、连接和尺寸需工程核对；模型图片不作为加工图。</p>
      <label className="studio-field">编号、组件、材料与连接说明<textarea rows={7} maxLength={8000} value={data.components} disabled={pending} placeholder="01 | 上壳 | 材料牌号待定 | 连接方式待工程确认" onChange={event => change({ components: event.target.value })} /></label>
      <button type="button" className="studio-button" disabled={pending || !hasModelSettings(modelSettings)} onClick={() => void run(signal => analyzeEngineering(concept, 'structure', modelSettings, signal), components => change({ components: `模型结构建议（${modelSettings.model}，待人工核对）：\n${components}` }), '结构建议已保存，请核对组件与编号。')}>AI 组件与装配建议</button>
      {!heroReady && <p className="studio-hint">请先完成第二步，并确认当前产品外观。</p>}{imageActions('exploded', '生成详细结构爆炸图', heroReady)}{imagePreview('exploded', '结构爆炸图')}
      {asset('exploded') && <PrintExport key={asset('exploded')!.id} record={asset('exploded')!} data={data} fresh={current('exploded') && heroReady} disabled={pending} onWidth={printWidth => change({ printWidth })} />}
    </>}
    {active === 'tooling' && <EngineeringPanel concept={concept} settings={modelSettings} projectId={projectId} heroReady={heroReady} hero={asset('hero')} onEdit={edit} />}
    {active === 'packaging' && <>{imageActions('package', '生成外包装效果预览', heroReady)}{asset('package') && imagePreview('package', '外包装效果预览')}<PackagingPanel concept={concept} settings={modelSettings} projectId={projectId} heroReady={heroReady} hero={asset('hero')} onEdit={edit} /></>}
    <div className="studio-actions workflow-step-footer">{stageIndex > 0 && <button type="button" className="studio-button" disabled={pending} onClick={() => change({ stage: (Object.keys(productStages) as ProductStage[])[stageIndex - 1] })}>上一步</button>}{stageIndex < 4 && <button type="button" className="studio-button" disabled={pending} onClick={() => change({ stage: (Object.keys(productStages) as ProductStage[])[stageIndex + 1] })}>下一步 · {productStages[(Object.keys(productStages) as ProductStage[])[stageIndex + 1]].title}</button>}</div>
    <details onToggle={event => { if (event.currentTarget.open) void projectVisuals(projectId).then(items => setHistory(items.filter(item => item.id.includes('"product-workflow"') && JSON.parse(item.id)[1] === roundNumber && JSON.parse(item.id)[2] === concept.id))).catch(() => setLoadError('历史图片暂时无法读取。')) }}><summary>本流程已保存的图片与历史版本</summary><ul className="studio-evidence-list">{history.map(record => <li key={record.id}><span>{record.workflowKind} · {record.source.kind === 'model' ? record.source.model : '上传／提取'}</span><button type="button" className="studio-button" onClick={() => downloadBlob(record.blob, filename(record))}>下载图片</button></li>)}</ul></details>
  </section>
}
function ProductImage({ record, label }: { record: SavedVisual; label: string }) {
  const [url] = useState(() => URL.createObjectURL(record.blob))
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return <img className="workflow-product-image" src={url} alt={label} />
}
function PrintExport({ record, data, fresh, disabled, onWidth }: { record: SavedVisual; data: ProductWorkflow; fresh: boolean; disabled: boolean; onWidth: (value: number) => void }) {
  const [width, setWidth] = useState(0)
  const { pending, notice, run } = useModelTask()
  useEffect(() => { let active = true; void createImageBitmap(record.blob).then(bitmap => { if (active) setWidth(bitmap.width); bitmap.close() }).catch(() => setWidth(0)); return () => { active = false } }, [record.blob])
  const dpi = width && data.printWidth > 0 ? printResolution(width, data.printWidth) : 0
  return <div className="studio-surface studio-refinement"><label className="studio-field">印刷宽度（mm）<input type="number" min={1} max={2000} value={data.printWidth || ''} disabled={disabled || pending} onChange={event => onWidth(event.target.valueAsNumber || 0)} /></label><p className="studio-hint">原图宽 {width} px；当前有效分辨率 {dpi.toFixed(1)} dpi。300 dpi 的最大印刷宽度 {(width * 25.4 / 300).toFixed(1)} mm，不放大补像素。</p><button type="button" className="studio-button primary" disabled={disabled || pending || !fresh || dpi < 300} onClick={() => void run(async () => downloadBlob(await explodedPrint(record.blob, data.printWidth, data.productName, data.components), 'INNO-LIT-结构爆炸图-300dpi以上.png'), () => {}, '已按原生像素和实际印刷尺寸导出。')}>导出带标注 PNG（≥300 dpi）</button><p role="status" className="studio-hint">{notice || (dpi < 300 ? '当前原图不足 300 dpi，请缩小印刷宽度或换用更高分辨率原图。' : '文件写入实际印刷分辨率，结构与标注仍需工程核对。')}</p></div>
}
