import { formatPlanningReports } from './planningReport'
import { PlanningReportPanel } from './PlanningReportPanel'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Download } from 'lucide-react'
import type { Concept, ConceptBatch } from './concepts'
import {
  buildDesignReport, emptyValidation, formatDesignReport, updateValidation, validationFields, validationOutcomes,
} from './designWork'
import type { ResearchLog, ValidationOutcome, ValidationPlan } from './designWork'
import { EvidencePanel } from './EvidencePanel'
import type { ImageSettings } from './imageGeneration'
import { VisualStudio } from './VisualStudio'
import { DevelopmentAssistant } from './DevelopmentAssistant'
import { ConceptFreezePanel } from './ConceptFreezePanel'
import { developmentOf } from './conceptDevelopment'
import type { ModelSettings } from './modelGeneration'
import { hasModelSettings } from './modelGeneration'
import type { resolveWorkflowModels } from './aiModelRouter'
import { draftDesignReport, reportContext } from './reportModel'
import { modelSourceLabel } from './concepts'
import { useModelTask } from './useModelTask'



const stages = {
  notes: '深化笔记',
  validation: '可行性验证',
  research: '原创性检索',
  optimize: '方案优化与定稿',
  visuals: '概念图与展板',
  report: '设计报告',
} as const

type Stage = keyof typeof stages
const stageNames = Object.keys(stages) as Stage[]
const fields = Object.keys(validationFields) as (keyof typeof validationFields)[]
const emptyResearch: ResearchLog = { keywords: '', evidence: [] }

type RefinementProps = {
  projectId: string
  projectName: string
  round: ConceptBatch
  roundNumber: number
  concept: Concept
  onChange: (update: (current: Concept) => Concept) => void
  children: ReactNode





  engineeringSettings: ModelSettings
  imageSettings: ImageSettings

  settings: ModelSettings
  workflowSettings: ReturnType<typeof resolveWorkflowModels>
  imageConfiguration: string

}

function ValidationPanel({ concept, onChange }: Pick<RefinementProps, 'concept' | 'onChange'>) {
  const plan = concept.validation ?? emptyValidation
  const ready = Boolean(plan.criteria.trim() && plan.observations.trim())

  function save(change: Partial<ValidationPlan>) {
    onChange(current => ({
      ...current,
      validation: updateValidation(current.validation ?? emptyValidation, change),
    }))
  }

  return (
    <section className="studio-surface studio-refinement" aria-labelledby="validation-heading">
      <div>
        <h2 id="validation-heading">可行性验证</h2>
        <p><strong>关键风险</strong>　{concept.sentences.risk}</p>
        <p><strong>建议验证方式</strong>　{concept.sentences.test}</p>
      </div>
      <div className="studio-validation-fields">
        {fields.map(key => (
          <label className="studio-field" key={key}>
            {validationFields[key].label}
            <textarea
              rows={3}
              maxLength={3000}
              value={plan[key]}
              placeholder={validationFields[key].hint}
              onChange={event => save({ [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      <label className="studio-field studio-validation-outcome">
        人工判断
        <select
          value={plan.outcome}
          disabled={!ready}
          aria-describedby="validation-help"
          onChange={event => save({ outcome: event.target.value as ValidationOutcome })}
        >
          {Object.entries(validationOutcomes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <p id="validation-help" className="studio-hint">
        {ready ? '对照通过标准和实测记录，由你填写验证结果。' : '填写通过标准与实测记录后，可给出验证结果。'}
      </p>
      <label className="studio-field">人工可行性分析结论
        <textarea rows={4} maxLength={4000} value={developmentOf(concept).feasibilityConclusion} placeholder="修正 AI 分析，区分可行条件、剩余风险与未实测事项。"
          onChange={event => {
            const feasibilityConclusion = event.target.value
            onChange(current => ({ ...current, development: { ...developmentOf(current), feasibilityConclusion } }))
          }} />
      </label>
      <p className="studio-hint">AI 只提出分析和测试方案，不会填写实测记录或替你判定达到标准。概念冻结不代表实测通过。</p>
    </section>
  )
}

function ReportPanel({ projectName, round, roundNumber, concept, settings, onChange }: Pick<RefinementProps, 'projectName' | 'round' | 'roundNumber' | 'concept' | 'settings' | 'onChange'>) {
  const { pending, notice, run, cancel } = useModelTask()
  const report = buildDesignReport(projectName, round, roundNumber, concept)
  const stale = Boolean(concept.aiReport && concept.aiReport.contextKey !== reportContext(concept))

  function download() {
    const appendix = concept.aiReport ? `\n\n## AI 协作报告（可经人工修正${stale ? '，依据已更新，请复核' : ''}）\n\n${modelSourceLabel(concept.aiReport.source)}\n\n${concept.aiReport.text}\n` : ''
    const file = new Blob([formatDesignReport(report) + appendix + formatPlanningReports(concept.planningReport)], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `INNO-LIT-第${roundNumber}轮-设计报告.md`
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section className="studio-surface studio-refinement" aria-labelledby="report-heading">
      <header className="studio-report-header">
        <div>
          <h2 id="report-heading">设计报告</h2>
          <p>报告使用当前轮次和选定方案的最新记录。</p>
        </div>
        <button type="button" className="studio-button primary" onClick={download}>
          <Download size={16} aria-hidden="true" /> 下载 Markdown
        </button>
      </header>
      <div className="studio-actions"><button type="button" className="studio-button primary" disabled={pending || !hasModelSettings(settings)} onClick={() => {
        void run(signal => draftDesignReport(projectName, round, roundNumber, concept, settings, signal), aiReport => onChange(current => reportContext(current) === aiReport.contextKey ? { ...current, aiReport } : current), 'AI 报告草稿已保存，请核对并修正。')
      }}>AI 整理设计报告</button>{pending && <button type="button" className="studio-button" onClick={cancel}>取消整理</button>}</div>
      <p className="studio-hint" role="status">{notice || 'AI 根据已有记录整理报告，人工核对后可修改并导出。'}</p>
      {stale && <p className="studio-hint">概念或分析记录已变化，请重新整理或复核报告草稿。</p>}
      {concept.aiReport && <label className="studio-field">AI 报告草稿 · {modelSourceLabel(concept.aiReport.source)}<textarea rows={14} maxLength={16000} disabled={pending} value={concept.aiReport.text} onChange={event => {
        const text = event.target.value; onChange(current => current.aiReport ? { ...current, aiReport: { ...current.aiReport, text } } : current)
      }} /></label>}
      <PlanningReportPanel concept={concept} settings={settings} onChange={onChange} />
      {report.sections.map(section => (
        <section className="studio-report-section" key={section.heading}>
          <h3>{section.heading}</h3>
          <dl>
            {section.entries.map(entry => (
              <div key={entry.url ?? entry.label}>
                <dt>{entry.label}</dt>
                <dd>{entry.value.trim() || '未填写'}</dd>
                {entry.url && <dd><a href={entry.url} target="_blank" rel="noreferrer">查看来源</a></dd>}
              </div>
            ))}
          </dl>
        </section>
      ))}
    </section>
  )
}

export function RefinementWorkspace({ projectId, projectName, round, roundNumber, concept, onChange, children, imageSettings, settings, engineeringSettings, workflowSettings, imageConfiguration }: RefinementProps) {
  const [stage, setStage] = useState<Stage>('notes')
  const locked = Boolean(developmentOf(concept).frozen)
  const currentModel = stage === 'notes' ? workflowSettings.notes : stage === 'validation' ? workflowSettings.feasibility : stage === 'research' ? workflowSettings.originality : stage === 'optimize' ? workflowSettings.optimization : stage === 'report' ? workflowSettings.report : settings
  function edit(update: (current: Concept) => Concept) {
    onChange(current => developmentOf(current).frozen ? current : update(current))
  }

  return (
    <>
      {stage !== 'visuals' && <p className="studio-hint">
        当前环节模型：{currentModel.model.trim() || '未配置'}
        （在全局 AI 模型中心管理）
      </p>}
      {locked && <p className="studio-badge">冻结 V{developmentOf(concept).frozen!.revision} · 设计内容已锁定，展示制作引用此版本</p>}
      <nav className="studio-refinement-nav" aria-label="深化工作区">
        {stageNames.map(key => (
          <button
            type="button"
            key={key}
            className="studio-button"
            aria-pressed={stage === key}
            onClick={() => setStage(key)}
          >
            {stages[key]}
          </button>
        ))}
      </nav>
      {stage === 'notes' && (
        <DevelopmentAssistant step="notes" concept={concept} settings={workflowSettings.notes} onChange={edit}>
        <section className="studio-surface studio-refinement" aria-labelledby="notes-heading">
          <div>
            <h2 id="notes-heading">首轮验证建议</h2>
            <p><strong>关键风险</strong>　{concept.sentences.risk}</p>
            <p><strong>验证方式</strong>　{concept.sentences.test}</p>
          </div>
          <label className="studio-field">
            深化笔记
            <textarea
              rows={5}
              maxLength={4000}
              value={concept.notes}
              onChange={event => {
                const notes = event.target.value
                edit(current => ({ ...current, notes }))
              }}
              placeholder="记录方案调整、待解决的问题与下一步"
            />
          </label>
          {children}
        </section>
        </DevelopmentAssistant>
      )}
      {stage === 'validation' && <DevelopmentAssistant step="validation" concept={concept} settings={workflowSettings.feasibility} onChange={edit}>
        <ValidationPanel concept={concept} onChange={edit} />
      </DevelopmentAssistant>}
      {stage === 'research' && (
        <DevelopmentAssistant step="research" concept={concept} settings={workflowSettings.originality} onChange={edit}>
        <EvidencePanel
          research={concept.research ?? emptyResearch}
          onChange={update => edit(current => ({ ...current, research: update(current.research ?? emptyResearch) }))}
        />
        <section className="studio-surface studio-refinement"><label className="studio-field">人工检索比较结论
          <textarea rows={4} maxLength={4000} value={developmentOf(concept).researchConclusion} placeholder="阅读来源后修正相似与差异、检索范围和仍需调查的部分。"
            onChange={event => { const researchConclusion = event.target.value; edit(current => ({ ...current, development: { ...developmentOf(current), researchConclusion } })) }} />
        </label></section>
        </DevelopmentAssistant>
      )}
      {stage === 'optimize' && <ConceptFreezePanel concept={concept} settings={workflowSettings.optimization} onChange={onChange} onFrozen={() => setStage('visuals')} />}
      {stage === 'report' && <ReportPanel projectName={projectName} round={round} roundNumber={roundNumber} concept={concept} settings={workflowSettings.report} onChange={onChange} />}
      {stage === 'visuals' && <VisualStudio key={`${roundNumber}:${concept.id}`} projectId={projectId}
        projectName={projectName} round={round} roundNumber={roundNumber} concept={concept} onChange={onChange}
        imageSettings={imageSettings}
        imageConfiguration={imageConfiguration}
        reportSettings={workflowSettings.report}
        modelSettings={engineeringSettings}
         />}
    </>
  )
}
