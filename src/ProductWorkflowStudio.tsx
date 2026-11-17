import { FirmwarePanel, CostPanel } from './ProductionWorkflowPanels'
import { PlanningReportPanel } from './PlanningReportPanel'
import { PcbDrawingPanel } from './PcbDrawingPanel'
import { pageLayouts, pageSizeProblem } from './conceptVisuals'
import type { PageLayout } from './visualStudioTypes'
import { productOutputSize, productOutputLayout, productSizePrompt } from './productImageLayout'
import type { ProductOutputSize } from './productImageLayout'
import { useEffect, useState } from 'react'
import type { Concept } from './concepts'
import type { ImageSettings, VisualSource } from './imageGeneration'
import { generateConceptImage, supportsImageReference } from './imageGeneration'
import { hasModelSettings } from './modelGeneration'
import type { ModelSettings } from './modelGeneration'
import { productStages, workflowContext, workflowImagePrompt, workflowOf, printResolution, selectedSketchMatches, heroUsesSketch, activeProductStage, engineeringViews } from './productWorkflow'
import type { ProductAsset, ProductStage, ProductWorkflow, EngineeringView } from './productWorkflow'
import { getVisual, projectVisuals, putVisual } from './visualStore'
import type { SavedVisual } from './visualTypes'
import { downloadBlob } from './conceptBoard'
import { explodedPrint, imageDataUrl, imageDigest, selectedSketch, validateProductImage, sizedProductImage, nativePcbPrint } from './productWorkflowImages'
import { EngineeringPanel, PackagingPanel } from './ProductEngineeringPanels'
import { analyzeEngineering } from './engineeringModel'
import { useModelTask } from './useModelTask'
import './ProductWorkflowStudio.css'

type Props = { projectId: string; roundNumber: number; concept: Concept; imageSettings: ImageSettings; modelSettings: ModelSettings; reportSettings?: ModelSettings; onChange: (update: (current: Concept) => Concept) => void }
export function ProductWorkflowStudio({ projectId, roundNumber, concept, imageSettings, modelSettings, reportSettings, onChange }: Props) {
  const data = workflowOf(concept), active = activeProductStage(data.stage)
  const phase = data.designPhase ?? (data.stage === 'render' ? 'render' : 'sketches')
  const outputSize = productOutputSize(concept, active)
  const sizeProblem = pageSizeProblem(outputSize)
  const [records, setRecords] = useState<Record<string, SavedVisual>>({})
  const [history, setHistory] = useState<SavedVisual[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [generationRole, setGenerationRole] = useState<ProductAsset>()
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
  const current = (role: ProductAsset) => Boolean(asset(role) && (role === 'selected' ? selectedSketchMatches(concept, asset(role)!.conceptKey) : asset(role)!.conceptKey === workflowContext(concept, role)))
  const useSketch = heroUsesSketch(concept)
  const visualStep = ['design','structure','drawings','pcb','packaging'].includes(active)
  const needsReference = visualStep && (active === 'design' && phase === 'sketches' ? Boolean(data.assets.style) : active === 'design' && phase === 'render' ? useSketch : true)
  const heroReady = current('hero') && data.confirmedHero === data.assets.hero
  const configured = hasModelSettings(imageSettings), referenceSupported = supportsImageReference(imageSettings)
  const stageIndex = Object.keys(productStages).indexOf(active)
  function edit(update: (current: ProductWorkflow) => ProductWorkflow) { onChange(current => ({ ...current, productWorkflow: update(workflowOf(current)) })) }
  function change(patch: Partial<ProductWorkflow>) { edit(current => ({ ...current, ...patch })) }
  function updateSize(patch: Partial<ProductOutputSize>) { edit(current => ({ ...current, outputSizes: { ...current.outputSizes, [active]: { ...productOutputSize({ ...concept, productWorkflow: current }, active), ...patch } } })) }
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
  function generate(role: 'sheet' | 'hero' | 'pcb' | 'exploded' | 'package' | EngineeringView) {
    setGenerationRole(role)
    void run(async signal => {
      if (!data.productName.trim()) throw new Error('请先填写产品名称。')
      if (!configured) throw new Error('请先在 AI 模型中心配置图片模型。')
      let reference: Blob | undefined
      if (role === 'sheet') reference = asset('style')?.blob
      else if (role === 'hero' && useSketch) {
        if (!current('selected')) throw new Error('请先在第一步点击数字编号选定草图；如果重新生成过十款图，请重新选择一次编号。')
        reference = asset('selected')!.blob
      } else if (role !== 'hero') {
        if (!heroReady) throw new Error('请先在第一步的最终产品效果图中确认外观基准。')
        reference = asset('hero')!.blob
      }
      if (reference && !referenceSupported) throw new Error('当前图片模型不支持参考图输入。请切换支持参考图的模型；生成效果图也可以选择自由生成，不使用草图。')
      const prompt = workflowImagePrompt(concept, role).slice(0, 13400) + '\n' + productSizePrompt(outputSize)
      const blob = await generateConceptImage(imageSettings, prompt, signal, { purpose: imageSettings.protocol === 'openrouter' ? 'master' : 'concept', ...(referenceSupported && reference ? { reference: await imageDataUrl(reference) } : {}) })
      return storeImage(role, blob, { kind: 'model', model: imageSettings.model.trim(), provider: new URL(imageSettings.baseUrl).hostname }, prompt, workflowContext(concept, role), signal)
    }, record => adoptAsset(role, record), '当前步骤的图片已生成并保存，请核对设计与标注。')
  }
  function imageActions(role: 'sheet' | 'hero' | 'pcb' | 'exploded' | 'package' | EngineeringView, label: string, ready = true) {
    return <div className="studio-refinement"><div className="studio-actions">
      <button type="button" className="studio-button primary" disabled={pending || loading || Boolean(sizeProblem)} onClick={() => generate(role)}>{pending && generationRole === role ? '正在生成，请稍候…' : label}</button>
      {role !== 'sheet' && role !== 'hero' && <label className="studio-button visual-upload">上传{role in engineeringViews ? engineeringViews[role as EngineeringView] : role === 'pcb' ? 'PCB 工程参考图' : role === 'exploded' ? '结构爆炸图' : '包装效果图'}<input type="file" aria-label={`上传${role}`} accept="image/png,image/jpeg,image/webp" disabled={pending || loading || !ready} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) upload(role, file) }} /></label>}
    </div><p className="studio-hint" role="status" aria-live="polite">{generationRole === role && (pending || notice) ? pending ? '正在请求图片模型，生成结果会保存在下方。' : notice : !configured ? '请先在 AI 模型中心配置当前图片模型和密钥。' : !ready ? role === 'hero' ? '请先在第一步点击数字编号选款。修改名称、品牌及功能说明不会取消已有选款。' : '请先确认第一步的产品外观。' : role === 'hero' ? useSketch ? '将使用选定草图生成产品效果图，无需上传效果图。' : '当前不使用草图，根据概念和产品说明自由生成效果图。' : ''}</p></div>
  }
  const filename = (record: SavedVisual) => `INNO-LIT-${record.workflowKind ?? '参考图'}.${record.blob.type === 'image/jpeg' ? 'jpg' : record.blob.type === 'image/webp' ? 'webp' : 'png'}`
  function imageDownloads(record: SavedVisual) {
    return (
      <div className="studio-actions"><button type="button" className="studio-button" disabled={pending} onClick={() => downloadBlob(record.blob, filename(record))}>下载原图</button>
      {record.workflowKind !== 'style' && <button type="button" className="studio-button" disabled={pending || Boolean(sizeProblem)} onClick={() => { setGenerationRole(undefined); void run(async () => downloadBlob(await sizedProductImage(record.blob, outputSize), `INNO-LIT-${record.workflowKind ?? '图片'}-${outputSize.width}x${outputSize.height}.png`), () => {}, `已按 ${outputSize.width} × ${outputSize.height} px 导出 PNG，保留完整画面。`) }}>按设定尺寸下载 PNG</button>}</div>
    )
  }
  function imagePreview(role: ProductAsset, label: string) {
    const record = asset(role)
    return record ? <div className="studio-refinement">
      {role !== 'style' && !current(role) && <p className="studio-hint">上游选择或产品资料已变化，这张图是先前版本，请重新生成或上传。</p>}
      <ProductImage key={record.id} record={record} label={label} />
      {imageDownloads(record)}
      {role === 'hero' && <PcbPrint record={record} widthMm={data.printWidth} fresh={current(role)} disabled={pending}/>}
    </div> : <p className="workflow-empty">{label}将在这里显示。可调用自己的图片模型，或上传已有图片。</p>
  }
  return <section className="studio-surface studio-refinement product-workflow">
    <header><h2>概念图与展板 · 七步产品设计</h2><p>工业设计 → 爆炸图 → 五张结构图 → PCB → 嵌入式软件 → 包装与成本 → 推广与合规。确认一次产品外观，后续步骤沿用同一产品。</p></header>
    <nav className="product-step-nav" aria-label="产品设计步骤">{(Object.keys(productStages) as ProductStage[]).map((stage, index) => <button type="button" key={stage} className="studio-button" disabled={pending} aria-pressed={active === stage} onClick={() => change({ stage })}><span>{index + 1}</span>{productStages[stage].title}</button>)}</nav>
    {active === 'design' && <div className="studio-actions"><button className="studio-button" disabled={pending} aria-pressed={phase==='sketches'} onClick={()=>change({designPhase:'sketches'})}>1A 十款概念草图</button><button className="studio-button" disabled={pending} aria-pressed={phase==='render'} onClick={()=>change({designPhase:'render'})}>1B 最终产品效果图</button><p>工业设计版面不绘制 Logo；草图可选，也可直接自由生成效果图。</p></div>}
    <div className="workflow-role"><span>步骤 {stageIndex + 1}</span><h3>{productStages[active].title}</h3><p>角色：{productStages[active].role}</p></div>
    {visualStep && <><div className="visual-layout-controls">
      <label className="studio-field">版式<select value={outputSize.layout} disabled={pending} onChange={event => updateSize(productOutputLayout(outputSize, event.target.value as PageLayout))}>{Object.entries(pageLayouts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="studio-field">宽度（px）<input type="number" min={320} max={6000} step={1} value={outputSize.width || ''} disabled={pending} onChange={event => updateSize({ layout: 'custom', width: event.target.valueAsNumber || 0 })} /></label>
      <label className="studio-field">高度（px）<input type="number" min={320} max={6000} step={1} value={outputSize.height || ''} disabled={pending} onChange={event => updateSize({ layout: 'custom', height: event.target.valueAsNumber || 0 })} /></label>
    </div>
    <p className="studio-hint" role="status">{sizeProblem || `当前步骤独立保存：${outputSize.width} × ${outputSize.height} px。生成时参考此画幅；“按设定尺寸下载 PNG”保证输出尺寸，等比适配并补白，不裁切或拉伸。放大不增加原图细节。`}</p></>}
    {active === 'structure' && <p className="studio-hint">像素尺寸用于示意图片；模具工程附件仍保留原始格式、实际尺寸及工程比例。</p>}
    {(active === 'design' || active === 'drawings' || active === 'structure') && <label className="studio-field">图片印刷宽度（mm）<input type="number" min={1} max={2000} value={data.printWidth || ''} disabled={pending} onChange={event=>change({printWidth:event.target.valueAsNumber||0})}/></label>}
    <details open={active === 'design' && phase === 'sketches' || active === 'design' && phase === 'render'}><summary>统一产品与品牌资料</summary><fieldset className="development-fields studio-refinement" disabled={pending}>
      <div className="workflow-parameter-grid"><label className="studio-field">产品名称<input maxLength={100} value={data.productName} onChange={event => change({ productName: event.target.value })} /></label><label className="studio-field">品牌／Logo 文字<input maxLength={100} value={data.brand} onChange={event => change({ brand: event.target.value })} /></label><label className="studio-field">品牌主色<input type="color" value={data.brandColor} onChange={event => change({ brandColor: event.target.value })} /></label></div>
      <label className="studio-field">实际功能与关键交互<textarea rows={3} maxLength={2000} value={data.functions} onChange={event => change({ functions: event.target.value })} /></label>
      <label className="studio-field">设计方向与价值目标<textarea rows={3} maxLength={2000} value={data.direction} onChange={event => change({ direction: event.target.value })} /></label>
    </fieldset></details>
    {configured && !referenceSupported && needsReference && <p className="studio-hint" role="alert">当前配置的图片模型不支持参考图输入，不能读取上传图片。请在 AI 模型中心切换支持参考图的模型；本页面不会忽略参考图或自动改用其他模型。</p>}
    <p className="studio-hint" role="status">{notice || loadError || (!visualStep ? `当前文字模型：${(active === 'compliance' ? reportSettings?.model : modelSettings.model) || '未配置'}` : configured ? `图片模型：${imageSettings.model}；工程文字模型：${modelSettings.model || '未配置'}` : '请在顶部 AI 模型中心配置图片模型，或上传已有图片。')}</p>
    {pending && <button type="button" className="studio-button" onClick={cancel}>取消当前操作</button>}
    {active === 'design' && phase === 'sketches' && <>
      <p>AI 生成 10 款不同的产品草图。风格参考图可自由选择：不选图时根据设计简报生成；选图时参考该图的画风。生成后只需选择数字编号。</p>
      <label className="studio-button visual-upload">上传风格参考图（可选）<input type="file" aria-label="上传风格参考图" accept="image/png,image/jpeg,image/webp" disabled={pending || loading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) upload('style', file) }} /></label>
      {asset('style') && imagePreview('style', '风格参考图')}
      {data.assets.style && <button type="button" className="studio-button" disabled={pending} onClick={() => edit(current => ({ ...current, assets: { ...current.assets, style: undefined } }))}>不使用参考图</button>}
      {!asset('style') && <p className="studio-hint">当前不使用参考图，可直接点击生成。</p>}
      {imageActions('sheet', 'AI 生成 10 款设计草图')}
      {asset('sheet') ? <><ProductImage key={asset('sheet')!.id} record={asset('sheet')!} label="十款设计草图" />{imageDownloads(asset('sheet')!)}<PcbPrint record={asset('sheet')!} widthMm={data.printWidth} fresh={current('sheet')} disabled={pending}/>
      {!current('sheet') && <p className="studio-hint">参考图或产品资料已改变，请重新生成当前十款草图后选款。</p>}
      <fieldset className="workflow-number-choice" disabled={pending || !current('sheet')}><legend>选择草图编号</legend><div className="workflow-number-buttons">{Array.from({ length: 10 }, (_, index) => <button type="button" className="studio-button" key={index} aria-label={`选择草图 ${String(index + 1).padStart(2, '0')}`} aria-pressed={data.selection === index} onClick={() => {
        const selectedConcept = { ...concept, productWorkflow: { ...data, selection: index } }
        void run(async signal => storeImage('selected', await selectedSketch(asset('sheet')!.blob, index), { kind: 'upload' }, `从十款图中提取 ${index + 1}`, workflowContext(selectedConcept, 'selected'), signal), record => adoptAsset('selected', record, index), `已选草图 ${String(index + 1).padStart(2, '0')}。可进入第二步。`)
      }}>{String(index + 1).padStart(2, '0')}</button>)}</div></fieldset>
      <p className="studio-hint">点击编号即自动提取对应草图，供第二步生成效果图。</p></> : <p className="workflow-empty">AI 生成的 10 款产品草图将在这里显示。</p>}
      {asset('selected') && imagePreview('selected', '选定的草图')}
    </>}
    {active === 'design' && phase === 'render' && <><p>可沿用选定草图，也可跳过草图，根据概念、产品功能与设计方向自由生成合适的产品效果图。功能、绿色制造和原创性仍是待验证的设计目标。</p>
      <label className="studio-field">效果图生成方式<select value={useSketch ? 'sketch' : 'free'} disabled={pending} onChange={event => change({ heroMode: event.target.value as 'free' | 'sketch' })}><option value="free">自由生成（不使用草图）</option><option value="sketch">使用选定草图</option></select></label>
      <button type="button" className="studio-button" disabled={pending || !hasModelSettings(modelSettings)} onClick={() => void run(signal => analyzeEngineering(concept, 'industrial', modelSettings, signal), renderNotes => change({ renderNotes: `模型建议（${modelSettings.model}，基于文字，待人工核对）：\n${renderNotes}` }), '功能与 CMF 建议已保存，可修正后用于效果图。')}>AI 功能与 CMF 深化建议</button>
      <label className="studio-field">效果图深化说明<textarea rows={5} maxLength={8000} value={data.renderNotes} disabled={pending} onChange={event => change({ renderNotes: event.target.value })} /></label>
      {useSketch && imagePreview('selected', '选定的草图')}{imageActions('hero', useSketch ? '生成选定产品效果图' : '自由生成产品效果图', !useSketch || current('selected'))}{imagePreview('hero', '产品效果图')}<button type="button" className="studio-button primary" disabled={pending || !current('hero')} onClick={() => change({ confirmedHero: data.assets.hero })}>{heroReady ? '当前产品外观已确认为统一基准' : '确认此产品外观，供后续步骤使用'}</button><p className="studio-hint">核对造型、比例、材质、配色、交互、产品名称及 Logo。产品资料或上游选款改变后，旧图会标为待更新。</p></>}
    {active === 'pcb' && <><p>资深电子工程师视角：以第一步已确认的产品为外观与装配参考，生成二维 PCB 顶视工程示意，保持产品名称和接口约束一致。仅黑白线框，禁止三维效果、光影和照片质感。</p>
      {!heroReady && <p className="studio-hint">请先在第一步最终效果图中确认当前产品外观。外观图片不能提供真实电气连接或内部尺寸。</p>}
      <label className="studio-field">PCB 图纸印刷宽度（mm）<input type="number" min={1} max={2000} value={data.pcbPrintWidth || 80} disabled={pending} onChange={event=>change({pcbPrintWidth:event.target.valueAsNumber||0})}/></label>
      <PcbDrawingPanel concept={concept} settings={modelSettings} outputSize={outputSize} disabled={pending} heroReady={heroReady} onEdit={onChange}/>
      {imageActions('pcb', 'AI 生成二维 PCB 工程示意图', heroReady)}{imagePreview('pcb', '二维 PCB 工程示意图')}
      {asset('pcb') && <PcbPrint record={asset('pcb')!} widthMm={data.pcbPrintWidth || 80} fresh={current('pcb') && heroReady} disabled={pending}/>}
    </>}
    {active === 'structure' && <><p>沿用第二步产品外观，制作带编号的详细结构爆炸示意。内部结构、连接和尺寸需工程核对；模型图片不作为加工图。</p>
      <label className="studio-field">编号、组件、材料与连接说明<textarea rows={7} maxLength={8000} value={data.components} disabled={pending} placeholder="01 | 上壳 | 材料牌号待定 | 连接方式待工程确认" onChange={event => change({ components: event.target.value })} /></label>
      <button type="button" className="studio-button" disabled={pending || !hasModelSettings(modelSettings)} onClick={() => void run(signal => analyzeEngineering(concept, 'structure', modelSettings, signal), components => change({ components: `模型结构建议（${modelSettings.model}，待人工核对）：\n${components}` }), '结构建议已保存，请核对组件与编号。')}>AI 组件与装配建议</button>
      {!heroReady && <p className="studio-hint">请先完成第一步的效果图，并确认当前产品外观。</p>}{imageActions('exploded', '生成详细结构爆炸图', heroReady)}{imagePreview('exploded', '结构爆炸图')}
      {asset('exploded') && <PrintExport key={asset('exploded')!.id} record={asset('exploded')!} data={data} fresh={current('exploded') && heroReady} disabled={pending} onWidth={printWidth => change({ printWidth })} />}
    </>}
    {active === 'structure' && <details><summary>模具 DFM 与已有工程附件</summary><EngineeringPanel concept={concept} settings={modelSettings} projectId={projectId} heroReady={heroReady} hero={asset('hero')} onEdit={edit} /></details>}
    {active === 'drawings' && <><p>五张图分别生成和保存，不拼接成一幅：三视图、轴测图、装配结构图、局部剖视图、关键连接详图。黑白单色，保持同一产品，未知尺寸不编造。</p><label className="studio-field">真实尺寸、材料、公差与制图补充<textarea rows={5} maxLength={8000} disabled={pending} value={data.drawingNotes??''} onChange={event=>change({drawingNotes:event.target.value})}/></label><button className="studio-button primary" disabled={pending||loading||!heroReady||Boolean(sizeProblem)} onClick={()=>void run(async signal=>{for(const role of Object.keys(engineeringViews) as EngineeringView[]){setGenerationRole(role);const reference=asset('hero');if(!reference||!heroReady)throw new Error('请确认产品外观基准。');if(!referenceSupported)throw new Error('当前模型不支持产品参考图。');const prompt=workflowImagePrompt(concept,role)+'\n'+productSizePrompt(outputSize);const blob=await generateConceptImage(imageSettings,prompt,signal,{purpose:'master',reference:await imageDataUrl(reference.blob)});const record=await storeImage(role,blob,{kind:'model',model:imageSettings.model,provider:new URL(imageSettings.baseUrl).hostname},prompt,workflowContext(concept,role),signal);adoptAsset(role,record)}},()=>{},'五张独立工程图已生成，尺寸和结构仍需工程核对。')}>依次生成五张独立结构图</button>{(Object.keys(engineeringViews) as EngineeringView[]).map(role=><section key={role}><h4>{engineeringViews[role]}</h4>{imageActions(role,`单独生成${engineeringViews[role]}`,heroReady)}{imagePreview(role,engineeringViews[role])}{asset(role)&&<PcbPrint record={asset(role)!} widthMm={data.printWidth} fresh={current(role)&&heroReady} disabled={pending}/>}</section>)}<label className="studio-field">结构图印刷宽度（mm）<input type="number" value={data.printWidth} onChange={event=>change({printWidth:event.target.valueAsNumber||0})}/></label></>}
    {active === 'firmware' && <FirmwarePanel concept={concept} settings={modelSettings} onChange={onChange}/>}
    {active === 'compliance' && <PlanningReportPanel concept={concept} settings={reportSettings ?? modelSettings} onChange={onChange} initialKind="compliance" onlyKind/>}
    {active === 'packaging' && <CostPanel concept={concept} onChange={onChange}/>}
    {active === 'packaging' && <>{imageActions('package', '生成外包装效果预览', heroReady)}{asset('package') && imagePreview('package', '外包装效果预览')}<PackagingPanel concept={concept} settings={modelSettings} projectId={projectId} heroReady={heroReady} hero={asset('hero')} onEdit={edit} /></>}
    <div className="studio-actions workflow-step-footer">{stageIndex > 0 && <button type="button" className="studio-button" disabled={pending} onClick={() => change({ stage: (Object.keys(productStages) as ProductStage[])[stageIndex - 1] })}>上一步</button>}{stageIndex < Object.keys(productStages).length - 1 && <button type="button" className="studio-button" disabled={pending} onClick={() => change({ stage: (Object.keys(productStages) as ProductStage[])[stageIndex + 1] })}>下一步 · {productStages[(Object.keys(productStages) as ProductStage[])[stageIndex + 1]].title}</button>}</div>
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


function PcbPrint({record,widthMm,fresh,disabled}:{record:SavedVisual;widthMm:number;fresh:boolean;disabled:boolean}){
  const [pixels,setPixels]=useState(0)
  const task=useModelTask()
  useEffect(()=>{let live=true;void createImageBitmap(record.blob).then(bitmap=>{if(live)setPixels(bitmap.width);bitmap.close()}).catch(()=>setPixels(0));return()=>{live=false}},[record.blob])
  const dpi=pixels&&widthMm>0?printResolution(pixels,widthMm):0
  return <div className="studio-refinement"><p className="studio-hint">原图宽 {pixels} px，按此印刷宽度为 {dpi.toFixed(1)} dpi；放大补像素不计作真实清晰度。</p><button type="button" className="studio-button" disabled={disabled||task.pending||!fresh||dpi<300} onClick={()=>void task.run(async()=>downloadBlob(await nativePcbPrint(record.blob,widthMm),`INNO-LIT-${record.workflowKind ?? '工程图'}-300dpi以上.png`),()=>{},'已按原图像素写入有效印刷分辨率。')}>导出 原图 PNG（≥300 dpi）</button><p role="status" className="studio-hint">{task.notice||(dpi<300?'请缩小印刷宽度，或使用更高原生分辨率图片。':'图像与标注仍须相关工程师逐项核对。')}</p></div>
}
