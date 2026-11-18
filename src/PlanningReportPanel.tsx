import { useState } from 'react'
import type { Concept } from './concepts'
import type { ModelSettings } from './modelGeneration'
import { hasModelSettings } from './modelGeneration'
import { emptyPlanningInputs, planningFields, planningTitles, planningContext, planningTemplate, generatePlanning, officialReferences } from './planningReport'
import type { PlanningKind, PlanningDraft } from './planningReport'
import { buildPlanningPptx, planningSlides } from './planningPptx'
import type { ReportPicture } from './planningPptx'
import { getVisual } from './visualStore'
import { workflowOf, workflowContext } from './productWorkflow'
import { useModelTask } from './useModelTask'

export function PlanningReportPanel({ concept, settings, onChange, initialKind = 'product', onlyKind = false }: { initialKind?: PlanningKind; onlyKind?: boolean; concept: Concept; settings: ModelSettings; onChange: (update: (current: Concept) => Concept) => void }) {
  const [kind, setKind] = useState<PlanningKind>(initialKind)
  const [exportNotice, setExportNotice] = useState('')
  const [exporting, setExporting] = useState(false)
  const task = useModelTask()
  const state = concept.planningReport ?? { inputs: { ...emptyPlanningInputs } }
  const inputs = { ...emptyPlanningInputs, ...state.inputs }
  const draft = state[kind]
  const contextKey = planningContext(concept, inputs)
  const stale = Boolean(draft && draft.contextKey !== contextKey)
  function saveDraft(result: PlanningDraft) {
    onChange(current => planningContext(current, { ...emptyPlanningInputs, ...current.planningReport?.inputs }) === result.contextKey
      ? { ...current, planningReport: { ...(current.planningReport ?? { inputs }), [kind]: result } } : current)
  }
  function renderFields(keys: string[]) {return (
<div className="studio-validation-fields">{Object.entries(planningFields).filter(([key])=>keys.includes(key)).map(([key, label]) => <label className="studio-field" key={key}>{label}<textarea rows={2} maxLength={4000} disabled={task.pending} value={inputs[key as keyof typeof inputs]} placeholder="未确定的内容可留空，报告会列为待确认。" onChange={event => {
      const value = event.target.value
      onChange(current => ({ ...current, planningReport: { ...current.planningReport, inputs: { ...emptyPlanningInputs, ...current.planningReport?.inputs, [key]: value } } }))
    }} /></label>)}</div> )}
  async function exportPptx() {
    if (!draft || exporting) return
    setExporting(true); setExportNotice('正在整理报告与已保存的产品图…')
    try {
      const workflow = workflowOf(concept)
      const pictures: ReportPicture[] = []
      const ids = [workflow.confirmedHero || workflow.assets.hero, workflow.assets.exploded]
      let missing = 0
      for (const [index, id] of ids.entries()) {
        if (!id) continue
        const saved = await getVisual(id)
        if (!saved) { missing++; continue }
        const bitmap = await createImageBitmap(saved.blob)
        try {
          const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height))
          const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
          const context = canvas.getContext('2d'); if (!context) throw new Error('无法读取产品图，请重试。')
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
          const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('产品图处理失败。')), 'image/png'))
          const role = index === 0 ? 'hero' : 'exploded'
          const staleImage = saved.conceptKey !== workflowContext(concept, role)
          const title = (index === 0 ? '产品效果与概念表达' : '结构设计参考图') + (staleImage ? '（依据已变化，待更新）' : index === 0 && workflow.confirmedHero !== id ? '（外观待确认）' : '')
          pictures.push({ title, data: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height })
        } finally { bitmap.close() }
      }
      const slides = planningSlides(kind, draft, inputs, pictures, stale)
      const bytes = buildPlanningPptx(slides)
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }))
      const link = document.createElement('a'); link.href = url; link.download = `INNO-LIT-${planningTitles[kind]}.pptx`; document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      setExportNotice(`已导出 ${slides.length} 页可编辑 PPTX，含 ${pictures.length} 张产品图。${missing ? `${missing} 张已保存配图缺失，请检查。` : ''}${!pictures.length ? '当前无产品图，使用可编辑的流程与架构示意。' : ''}`)
    } catch (error) { setExportNotice(error instanceof Error ? error.message : 'PPT 导出失败，请重试。') }
    finally { setExporting(false) }
  }
  return <section aria-labelledby="planning-report-heading" className="studio-report-section">
    <h3 id="planning-report-heading">{onlyKind ? planningTitles[kind] : '产品策划与市场合规报告'}</h3>
    <p>填写产品与目标地区，生成后可逐章修改。未确定的内容可留空。</p>
    <div className="report-step"><h4>1 · 填写报告资料</h4>{renderFields(['product','markets','audience'])}<details><summary>补充技术、商业与证据资料（可选）</summary>{renderFields(['hardware','positioning','manufacturing','evidence'])}</details></div>
    <div className="report-step"><h4>2 · 选择报告并生成</h4>
    {!onlyKind && <div className="studio-actions">{(['product', 'compliance'] as const).filter(value => !onlyKind || value === initialKind).map(value => <button type="button" className="studio-button" aria-pressed={kind === value} disabled={task.pending || exporting} key={value} onClick={() => { setKind(value); setExportNotice('') }}>{planningTitles[value]}</button>)}</div>}
    <div className="studio-actions">
      <button type="button" className="studio-button primary" disabled={task.pending || !hasModelSettings(settings)} onClick={() => void task.run(signal => generatePlanning(kind, concept, inputs, settings, signal), saveDraft, '报告已生成，请核对章节后导出。')}>{draft ? '重新生成报告' : 'AI 生成报告'}</button>
      {!draft && <button type="button" className="studio-button" disabled={task.pending} onClick={() => saveDraft(planningTemplate(kind, contextKey))}>手动填写提纲</button>}
      {task.pending && <button type="button" className="studio-button" onClick={task.cancel}>取消</button>}
    </div>
    {!hasModelSettings(settings) && <p className="studio-hint">请在 AI 模型中心配置设计报告模型，或先建立本地提纲并人工填写。</p>}
    {draft && <details><summary>来源与保存信息</summary><p>{draft.source} · {new Date(draft.updatedAt).toLocaleString()}。重新生成会覆盖本稿，请先导出修改。</p></details>}
    {stale && <p role="status">产品、概念或分析依据已变化，请复核或重新生成。导出也会标注此状态。</p>}
    <p role="status" className="studio-hint">{task.notice || exportNotice}</p>
    </div>
    {draft && <div className="report-step"><h4>3 · 核对章节并导出</h4><p className="studio-hint">展开章节即可修改；未确认内容请保留待核实标记。</p>
    {(kind==='product'?[{title:'定位与市场',start:0,end:4},{title:'产品与体验',start:4,end:7},{title:'商业与落地',start:7,end:12}]:[{title:'市场推广',start:0,end:4},{title:'标准与风险',start:4,end:10},{title:'执行与应急',start:10,end:12}]).map(group=><section className="report-chapter-group" key={group.title}><h5>{group.title}</h5>{draft.sections.slice(group.start,group.end).map((section, offset) => {const index=group.start+offset;return <details key={section.title}><summary>{index + 1}. {section.title}</summary><label className="studio-field">内容<textarea rows={7} maxLength={1600} disabled={task.pending} value={section.body} onChange={event => {
      const body = event.target.value
      onChange(current => {
        const previous = current.planningReport?.[kind]
        if (!previous || !current.planningReport) return current
        return { ...current, planningReport: { ...current.planningReport, [kind]: { ...previous, updatedAt: new Date().toISOString(), sections: previous.sections.map((item, i) => i === index ? { ...item, body } : item) } } }
      })
    }} /></label></details>})}</section>)}
    <button type="button" className="studio-button primary" disabled={task.pending||exporting} onClick={()=>void exportPptx()}>{exporting?'正在导出…':'导出图文 PPTX'}</button></div>}
    <details><summary>官方法规核查入口与报告边界</summary><p>未进行实时法规检索。CCC、CE、FCC 等是否适用，应按产品类别、供电、无线能力与目标市场确认。限值、标准版本、豁免和认证费用须有原文或询价依据。AI 不能代替测试与法律审查。</p>{officialReferences.map(item => <p key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></p>)}</details>
  </section>
}
