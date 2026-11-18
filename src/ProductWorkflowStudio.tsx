import { SketchRegionEditor } from './SketchRegionEditor'
import { FirmwarePanel, CostPanel } from './ProductionWorkflowPanels'
import { PlanningReportPanel } from './PlanningReportPanel'
import { PcbDrawingPanel } from './PcbDrawingPanel'
import { pageLayouts, pageSizeProblem } from './conceptVisuals'
import type { PageLayout } from './visualStudioTypes'
import { productOutputSize, productOutputLayout, productSizePrompt } from './productImageLayout'
import type { ProductOutputSize } from './productImageLayout'
import { useEffect, useRef, useState } from 'react'
import type { Concept } from './concepts'
import type { ImageSettings, VisualSource } from './imageGeneration'
import { generateConceptImage, supportsImageReference } from './imageGeneration'
import { hasModelSettings } from './modelGeneration'
import type { ModelSettings } from './modelGeneration'
import { productStages, workflowContext, workflowImagePrompt, workflowOf, selectedSketchMatches, heroUsesSketch, activeProductStage, engineeringViews, englishPromptSource, fillEnglishPrompt } from './productWorkflow'
import type { ProductAsset, ProductStage, ProductWorkflow, EngineeringView, SketchArea } from './productWorkflow'
import { getVisual, projectVisuals, putVisual } from './visualStore'
import type { SavedVisual } from './visualTypes'
import { downloadBlob } from './conceptBoard'
import { imageDataUrl, imageDigest, selectedSketch, validateProductImage, sizedProductImage } from './productWorkflowImages'
import { EngineeringPanel, PackagingPanel } from './ProductEngineeringPanels'
import { analyzeEngineering, translateImagePrompt } from './engineeringModel'
import { useModelTask } from './useModelTask'
import './ProductWorkflowStudio.css'

const stepLabels: Record<ProductStage, string> = { design: '外观设计', structure: '结构爆炸图', drawings: '结构工程图', pcb: 'PCB 图纸', firmware: '软件与文档', packaging: '包装与成本', compliance: '推广与合规' }

type Props = { projectId: string; roundNumber: number; concept: Concept; imageSettings: ImageSettings; modelSettings: ModelSettings; reportSettings?: ModelSettings; onChange: (update: (current: Concept) => Concept) => void }
export function ProductWorkflowStudio({ projectId, roundNumber, concept, imageSettings, modelSettings, reportSettings, onChange }: Props) {
  const data = workflowOf(concept), active = activeProductStage(data.stage)
  const heroSection = useRef<HTMLElement | null>(null)
  function showFinalRender() { heroSection.current?.scrollIntoView({behavior:'smooth',block:'start'}) }
  const outputSize = productOutputSize(concept, active)
  const sizeProblem = pageSizeProblem(outputSize)
  const [records, setRecords] = useState<Record<string, SavedVisual>>({})
  const [history, setHistory] = useState<SavedVisual[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [generationRole, setGenerationRole] = useState<ProductAsset>()
  const { pending, notice, run, cancel } = useModelTask(300000)
  const [promptStatus,setPromptStatus]=useState('')
  const [autoPromptPending,setAutoPromptPending]=useState(false)
  const promptAttempts=useRef(new Set<string>())
  const promptSource=englishPromptSource(concept)
  useEffect(()=>{
    if(active!=='design'||data.useEnglishPrompt===false||data.englishPrompt?.trim()||!hasModelSettings(modelSettings))return
    const attemptKey=JSON.stringify([projectId,concept.id,promptSource,modelSettings.baseUrl,modelSettings.model])
    if(promptAttempts.current.has(attemptKey))return
    const attempts=promptAttempts.current
    const controller=new AbortController()
    const timer=setTimeout(()=>{
      attempts.add(attemptKey)
      setAutoPromptPending(true);setPromptStatus('AI 正在转译专业英文 Prompt…')
      void translateImagePrompt(concept,modelSettings,controller.signal).then(englishPrompt=>{
        if(controller.signal.aborted)return
        onChange(current=>fillEnglishPrompt(current,promptSource,englishPrompt))
        setPromptStatus('英文 Prompt 已填入，可直接修改。')
      }).catch(error=>{if(!controller.signal.aborted)setPromptStatus(error instanceof Error?error.message:'自动转译失败，可点击重新翻译。')}).finally(()=>{setAutoPromptPending(false)})
    },1200)
    return()=>{clearTimeout(timer);controller.abort();attempts.delete(attemptKey);}
  },[active,projectId,concept,promptSource,data.englishPrompt,data.useEnglishPrompt,modelSettings,onChange])
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
  const needsReference = visualStep && (active === 'design' ? false : true)
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
  function adoptAsset(role: ProductAsset, record: SavedVisual, selection?: number, selectionArea?: SketchArea) {
    edit(current => ({ ...current, ...(selection === undefined ? {} : { selection, selectionArea, heroMode: 'sketch' }), assets: { ...current.assets, [role]: record.id } }))
  }
  function chooseSketch(index: number, area?: SketchArea) {
    const sheet=asset('sheet'); if(!sheet)return
    const selectedConcept={...concept,productWorkflow:{...data,selection:index,selectionArea:area}}
    void run(async signal=>storeImage('selected',await selectedSketch(sheet.blob,index,area),{kind:'upload'},`草图 ${index+1}`,workflowContext(selectedConcept,'selected'),signal),record=>{adoptAsset('selected',record,index,area);showFinalRender()},'选款已保存，请核对完整性后生成效果图。')
  }
  function upload(role: ProductAsset, file: File) {
    void run(signal => storeImage(role, file, { kind: 'upload' }, '用户上传', workflowContext(concept, role), signal), record => adoptAsset(role, record), '图片已保存。后续步骤会使用当前图片。')
  }
  function requestSettings() {
    if(imageSettings.protocol !== 'openai')return imageSettings
    const ratio=outputSize.width/outputSize.height
    return {...imageSettings,size:(ratio>1.15?'1536x1024':ratio<0.87?'1024x1536':'1024x1024') as ImageSettings['size']}
  }
  function generate(role: 'sheet' | 'hero' | 'presentation' | 'pcb' | 'exploded' | 'package' | EngineeringView) {
    setGenerationRole(role)
    void run(async signal => {
      if (!data.productName.trim()) throw new Error('请先填写产品名称。')
      if (!configured) throw new Error('请先在 AI 模型中心配置图片模型。')
      let reference: Blob | undefined
      if (role === 'sheet') reference = asset('style')?.blob
      else if (role === 'hero' && useSketch) {
        if (!current('selected')) throw new Error('请先框选方案，或切换为自由生成。')
        reference = asset('selected')!.blob
      } else if (role !== 'hero') {
        if (!heroReady) throw new Error('请先在第一步的最终产品效果图中确认外观基准。')
        reference = asset('hero')!.blob
      }
      if (reference && !referenceSupported) throw new Error('当前图片模型不支持参考图输入。请切换支持参考图的模型；生成效果图也可以选择自由生成，不使用草图。')
      let prepared=concept
      let promptUpdate: Partial<ProductWorkflow>={}
      if((role==='sheet'||role==='hero')&&data.useEnglishPrompt!==false&&!data.englishPrompt?.trim()){
        if(!hasModelSettings(modelSettings))throw new Error('自动翻译英文 Prompt 需要在 AI 模型中心配置工程文字模型，或手动填写英文 Prompt。')
        promptUpdate={englishPrompt:await translateImagePrompt(concept,modelSettings,signal),englishPromptSource:englishPromptSource(concept)}
        change(promptUpdate)
        prepared={...concept,productWorkflow:{...data,...promptUpdate}}
      }
      const prompt = workflowImagePrompt(prepared, role).slice(0, 13400) + '\n' + productSizePrompt(outputSize)
      const blob = await generateConceptImage(requestSettings(), prompt, signal, { purpose: imageSettings.protocol === 'openrouter' ? 'master' : 'concept', ...(referenceSupported && reference ? { reference: await imageDataUrl(reference) } : {}) })
      const record=await storeImage(role, blob, { kind: 'model', model: imageSettings.model.trim(), provider: new URL(imageSettings.baseUrl).hostname }, prompt, workflowContext(prepared, role), signal)
      return {record,promptUpdate}
    }, ({record,promptUpdate}) => edit(current=>({...current,...promptUpdate,assets:{...current.assets,[role]:record.id}})), '当前步骤的图片已生成并保存，请核对设计与标注。')
  }
  function imageActions(role: 'sheet' | 'hero' | 'presentation' | 'pcb' | 'exploded' | 'package' | EngineeringView, label: string, ready = true) {
    return <div className="studio-refinement"><div className="studio-actions">
      <button type="button" className="studio-button primary" disabled={pending || autoPromptPending || loading || !ready || Boolean(sizeProblem)} onClick={() => generate(role)}>{pending && generationRole === role ? '正在生成…' : label}</button>
      {role !== 'sheet' && role !== 'hero' && role !== 'presentation' && <label className="studio-button visual-upload">上传{role in engineeringViews ? engineeringViews[role as EngineeringView] : role === 'pcb' ? 'PCB 工程参考图' : role === 'exploded' ? '结构爆炸图' : '包装效果图'}<input type="file" aria-label={`上传${role}`} accept="image/png,image/jpeg,image/webp" disabled={pending || loading || !ready} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) upload(role, file) }} /></label>}
    </div>{!ready && role === 'hero' && <p className="studio-hint">请先框选方案，或切换为自由生成。</p>}</div>
  }
  const filename = (record: SavedVisual) => `INNO-LIT-${record.workflowKind ?? '参考图'}.${record.blob.type === 'image/jpeg' ? 'jpg' : record.blob.type === 'image/webp' ? 'webp' : 'png'}`
  function imageDownloads(record: SavedVisual) {
    return (
      <div className="studio-actions"><button type="button" className="studio-button" disabled={pending} onClick={() => downloadBlob(record.blob, filename(record))}>下载原图</button>
      {record.workflowKind !== 'style' && <details className="workflow-download-options"><summary>更多下载</summary><button type="button" className="studio-button" disabled={pending || Boolean(sizeProblem)} onClick={() => { setGenerationRole(undefined); void run(async () => downloadBlob(await sizedProductImage(record.blob, outputSize), `INNO-LIT-${record.workflowKind ?? '图片'}-${outputSize.width}x${outputSize.height}.png`), () => {}, `已按 ${outputSize.width} × ${outputSize.height} px 导出 PNG，保留完整画面。`) }}>下载设定尺寸 PNG</button></details>}</div>
    )
  }
  function imagePreview(role: ProductAsset, label: string) {
    const record = asset(role)
    return record ? <div className="studio-refinement">
      {role !== 'style' && !current(role) && <p className="studio-hint">此图待更新，请重新生成或上传。</p>}
      <ProductImage key={record.id} record={record} label={label} />
      {imageDownloads(record)}
    </div> : <p className="workflow-empty">尚未生成{label}</p>
  }
  return <section className="studio-surface studio-refinement product-workflow">
    <header><h2>七步产品设计</h2></header>
    <nav className="product-step-nav" aria-label="产品设计步骤">{(Object.keys(productStages) as ProductStage[]).map((stage, index) => <button type="button" key={stage} className="studio-button" disabled={pending} aria-pressed={active === stage} onClick={() => change({ stage })}><span>{index + 1}</span>{stepLabels[stage]}</button>)}</nav>
    {active === 'design' && <div className="workflow-progress" aria-label="第一步交付进度"><span>草图 {current('sheet')?'✓':'待生成'}</span><span>效果图 {current('hero')?'✓':'待生成'}</span><span>外观 {heroReady?'已确认':'待确认'}</span><button className="studio-button" onClick={showFinalRender}>前往效果图 ↓</button></div>}

    <div className="workflow-role"><span>步骤 {stageIndex + 1}</span><h3>{productStages[active].title}</h3><p>{productStages[active].role}</p></div>
    {visualStep && <details className="workflow-options"><summary>画幅设置 · {outputSize.width} × {outputSize.height} px</summary><div className="visual-layout-controls">
      <label className="studio-field">版式<select value={outputSize.layout} disabled={pending} onChange={event => updateSize(productOutputLayout(outputSize, event.target.value as PageLayout))}>{Object.entries(pageLayouts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="studio-field">宽度（px）<input type="number" min={320} max={6000} step={1} value={outputSize.width || ''} disabled={pending} onChange={event => updateSize({ layout: 'custom', width: event.target.valueAsNumber || 0 })} /></label>
      <label className="studio-field">高度（px）<input type="number" min={320} max={6000} step={1} value={outputSize.height || ''} disabled={pending} onChange={event => updateSize({ layout: 'custom', height: event.target.valueAsNumber || 0 })} /></label>
    </div>
    <p className="studio-hint">{sizeProblem || '下载时等比补白；放大不增加细节。'}</p>
    </details>}
    {sizeProblem && visualStep && <p role="alert">{sizeProblem}</p>}
    <details open={active === 'design'}><summary>产品资料</summary><fieldset className="development-fields studio-refinement" disabled={pending}>
      <div className="workflow-parameter-grid"><label className="studio-field">产品名称<input maxLength={100} value={data.productName} onChange={event => change({ productName: event.target.value })} /></label><label className="studio-field">品牌／Logo 文字<input maxLength={100} value={data.brand} onChange={event => change({ brand: event.target.value })} /></label><label className="studio-field">品牌主色<input type="color" value={data.brandColor} onChange={event => change({ brandColor: event.target.value })} /></label></div>
      <label className="studio-field">实际功能与关键交互<textarea rows={3} maxLength={2000} value={data.functions} onChange={event => change({ functions: event.target.value })} /></label>
      <label className="studio-field">设计方向与价值目标<textarea rows={3} maxLength={2000} value={data.direction} onChange={event => change({ direction: event.target.value })} /></label>
      <label className="studio-field">专业英文 Prompt<textarea rows={6} maxLength={6000} placeholder="AI 将自动转译并填入，可直接修改或自行填写。" value={data.englishPrompt??''} onChange={event=>change({englishPrompt:event.target.value,englishPromptSource:englishPromptSource(concept)})}/></label>
      <label><input type="checkbox" checked={data.useEnglishPrompt!==false} onChange={event=>change({useEnglishPrompt:event.target.checked})}/> 默认使用英文 Prompt</label>
      <button type="button" className="studio-button" disabled={pending||autoPromptPending||!hasModelSettings(modelSettings)} onClick={()=>void run(signal=>translateImagePrompt(concept,modelSettings,signal),englishPrompt=>change({englishPrompt,englishPromptSource:englishPromptSource(concept)}),'英文 Prompt 已更新。')}>{autoPromptPending?'正在自动转译…':'重新翻译并优化 Prompt'}</button>
      <p className="studio-hint" role="status">{promptStatus||(!hasModelSettings(modelSettings)?'请配置工程文字模型以自动转译，也可手动填写。':'')}</p>
      {data.englishPrompt&&data.englishPromptSource!==englishPromptSource(concept)&&<p className="studio-hint">设计依据已变化，已保留当前 Prompt；如需更新，请点击重新翻译。</p>}
    </fieldset></details>
    {configured && !referenceSupported && needsReference && <p className="studio-hint" role="alert">后续制图需要支持参考图的图片模型，请在 AI 模型中心切换。</p>}
    <p className="studio-hint" role="status">{notice || loadError || (needsReference && !heroReady ? '请先在第一步确认外观。' : !visualStep ? `当前文字模型：${(active === 'compliance' ? (reportSettings ?? modelSettings).model : modelSettings.model) || '未配置'}` : configured ? `图片模型：${imageSettings.model}` : '请在 AI 模型中心配置图片模型。')}</p>
    {pending && <button type="button" className="studio-button" onClick={cancel}>取消当前操作</button>}
    {active === 'design' && <section className="studio-refinement" aria-labelledby="sketch-deliverable"><h3 id="sketch-deliverable">1A · 10款草图</h3>
      <p>生成后直接框选方案。草图与效果图均不含 Logo。</p>
      <label className="studio-button visual-upload">上传风格参考图（可选）<input type="file" aria-label="上传风格参考图" accept="image/png,image/jpeg,image/webp" disabled={pending || loading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) upload('style', file) }} /></label>
      {asset('style') && <details><summary>查看风格参考图</summary>{imagePreview('style', '风格参考图')}</details>}
      {data.assets.style && <button type="button" className="studio-button" disabled={pending} onClick={() => edit(current => ({ ...current, assets: { ...current.assets, style: undefined } }))}>不使用参考图</button>}
      {imageActions('sheet', '生成10款草图')}
      {asset('sheet') ? <><SketchRegionEditor key={data.assets.sheet} blob={asset('sheet')!.blob} area={data.selectionArea} disabled={pending} onApply={area=>chooseSketch(0,area)}/>{imageDownloads(asset('sheet')!)}
      {!current('sheet') && <p className="studio-hint">草图依据已变化，可重新生成或框选现有方案。</p>}
</> : <p className="workflow-empty">AI 生成的 10 款产品草图将在这里显示。</p>}
    </section>}
    {active === 'design' && <section ref={heroSection} className="studio-refinement" aria-labelledby="hero-deliverable"><h3 id="hero-deliverable">1B · 最终高清效果图</h3><p>选款生成或自由生成，完成后确认外观。</p>
      <label className="studio-field">效果图生成方式<select value={useSketch ? 'sketch' : 'free'} disabled={pending} onChange={event => change({ heroMode: event.target.value as 'free' | 'sketch' })}><option value="free">自由生成（不使用草图）</option><option value="sketch">使用选定草图</option></select></label>
      <details><summary>深化效果图（可选）</summary><button type="button" className="studio-button" disabled={pending || !hasModelSettings(modelSettings)} onClick={() => void run(signal => analyzeEngineering(concept, 'industrial', modelSettings, signal), renderNotes => change({ renderNotes: `模型建议（${modelSettings.model}，基于文字，待人工核对）：\n${renderNotes}` }), '功能与 CMF 建议已保存，可修正后用于效果图。')}>AI 功能与材质建议</button>
      <label className="studio-field">效果图深化说明<textarea rows={5} maxLength={8000} value={data.renderNotes} disabled={pending} onChange={event => change({ renderNotes: event.target.value })} /></label></details>
      {imageActions('hero', useSketch ? '生成选定产品高清效果图' : '自由生成产品高清效果图', !useSketch || current('selected'))}{useSketch && <details><summary>查看选定的草图</summary>{imagePreview('selected', '选定的草图')}</details>}{imagePreview('hero', '产品效果图')}<button type="button" className="studio-button primary" disabled={pending || !current('hero')} onClick={() => change({ confirmedHero: data.assets.hero })}>{heroReady ? '外观已确认 ✓' : '确认外观'}</button><p className="studio-hint">后续步骤沿用此造型；产品资料变化后需更新。</p></section>}
    {active === 'design' && <section className="studio-refinement"><h3>1C · 产品概念展示图</h3><p>现代简洁排版，沿用已确认的产品外观。</p>{!heroReady&&<p className="studio-hint">请先确认上方产品效果图。</p>}{imageActions('presentation','生成产品概念展示图',heroReady)}{imagePreview('presentation','产品概念展示图')}</section>}
    {active === 'pcb' && <><p>生成黑白二维 PCB 示意，精确图纸可按真实数据绘制。</p>
      <details><summary>PCB 参数与精确矢量绘制</summary><PcbDrawingPanel concept={concept} settings={modelSettings} outputSize={outputSize} disabled={pending} heroReady={heroReady} onEdit={onChange}/></details>
      {imageActions('pcb', '生成 PCB 示意图', heroReady)}{imagePreview('pcb', '二维 PCB 工程示意图')}
    </>}
    {active === 'structure' && <><p>沿用已确认外观，生成带组件编号的爆炸示意。</p>
      <label className="studio-field">编号、组件、材料与连接说明<textarea rows={4} maxLength={8000} value={data.components} disabled={pending} placeholder="01 | 上壳 | 材料牌号待定 | 连接方式待工程确认" onChange={event => change({ components: event.target.value })} /></label>
      <button type="button" className="studio-button" disabled={pending || !hasModelSettings(modelSettings)} onClick={() => void run(signal => analyzeEngineering(concept, 'structure', modelSettings, signal), components => change({ components: `模型结构建议（${modelSettings.model}，待人工核对）：\n${components}` }), '结构建议已保存，请核对组件与编号。')}>AI 补充组件建议</button>
      {imageActions('exploded', '生成结构爆炸图', heroReady)}{imagePreview('exploded', '结构爆炸图')}
    </>}
    {active === 'structure' && <details><summary>模具 DFM 与已有工程附件</summary><EngineeringPanel concept={concept} settings={modelSettings} projectId={projectId} heroReady={heroReady} hero={asset('hero')} onEdit={edit} /></details>}
    {active === 'drawings' && <><p>一键生成五张独立图，也可展开单张操作。尺寸与结构需工程核对。</p><label className="studio-field">真实尺寸、材料、公差与制图补充<textarea rows={3} maxLength={8000} disabled={pending} value={data.drawingNotes??''} onChange={event=>change({drawingNotes:event.target.value})}/></label><button className="studio-button primary" disabled={pending||loading||!heroReady||!configured||!referenceSupported||Boolean(sizeProblem)} onClick={()=>void run(async signal=>{for(const role of Object.keys(engineeringViews) as EngineeringView[]){setGenerationRole(role);const reference=asset('hero');if(!reference||!heroReady)throw new Error('请确认产品外观基准。');if(!referenceSupported)throw new Error('当前模型不支持产品参考图。');const prompt=workflowImagePrompt(concept,role)+'\n'+productSizePrompt(outputSize);const blob=await generateConceptImage(requestSettings(),prompt,signal,{purpose:'master',reference:await imageDataUrl(reference.blob)});const record=await storeImage(role,blob,{kind:'model',model:imageSettings.model,provider:new URL(imageSettings.baseUrl).hostname},prompt,workflowContext(concept,role),signal);adoptAsset(role,record)}},()=>{},'五张独立工程图已生成，尺寸和结构仍需工程核对。')}>生成全部五张图</button>{(Object.keys(engineeringViews) as EngineeringView[]).map(role=><details key={role}><summary>{engineeringViews[role]} · {current(role)?'已生成':asset(role)?'待更新':'待生成'}</summary>{imageActions(role,`生成${engineeringViews[role]}`,heroReady)}{imagePreview(role,engineeringViews[role])}</details>)}</>}
    {active === 'firmware' && <FirmwarePanel concept={concept} settings={modelSettings} onChange={onChange}/>}
    {active === 'compliance' && <PlanningReportPanel concept={concept} settings={reportSettings ?? modelSettings} onChange={onChange} initialKind="compliance" onlyKind/>}
    {active === 'packaging' && <><h4>包装设计</h4>{imageActions('package', '生成外包装效果预览', heroReady)}{asset('package') && imagePreview('package', '外包装效果预览')}<details><summary>包装展开稿与打样文件</summary><PackagingPanel concept={concept} settings={modelSettings} projectId={projectId} heroReady={heroReady} hero={asset('hero')} onEdit={edit} /></details><details><summary>量产成本与评审 PPT</summary><CostPanel concept={concept} onChange={onChange}/></details></>}
    <div className="studio-actions workflow-step-footer">{stageIndex > 0 && <button type="button" className="studio-button" disabled={pending} onClick={() => change({ stage: (Object.keys(productStages) as ProductStage[])[stageIndex - 1] })}>上一步</button>}{stageIndex < Object.keys(productStages).length - 1 && <button type="button" className="studio-button" disabled={pending} onClick={() => change({ stage: (Object.keys(productStages) as ProductStage[])[stageIndex + 1] })}>下一步 · {productStages[(Object.keys(productStages) as ProductStage[])[stageIndex + 1]].title}</button>}</div>
    <details onToggle={event => { if (event.currentTarget.open) void projectVisuals(projectId).then(items => setHistory(items.filter(item => item.id.includes('"product-workflow"') && JSON.parse(item.id)[1] === roundNumber && JSON.parse(item.id)[2] === concept.id))).catch(() => setLoadError('历史图片暂时无法读取。')) }}><summary>图片历史</summary><ul className="studio-evidence-list">{history.map(record => <li key={record.id}><span>{record.workflowKind} · {record.source.kind === 'model' ? record.source.model : '上传／提取'}</span><button type="button" className="studio-button" onClick={() => downloadBlob(record.blob, filename(record))}>下载图片</button></li>)}</ul></details>
  </section>
}
function ProductImage({ record, label }: { record: SavedVisual; label: string }) {
  const imageRef=useRef<HTMLImageElement>(null)
  useEffect(() => {const value=URL.createObjectURL(record.blob);if(imageRef.current)imageRef.current.src=value;return()=>URL.revokeObjectURL(value)}, [record.blob])
  return <img className="workflow-product-image" ref={imageRef} alt={label} />
}
