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
import { ModelControls } from './ModelControls'
import type { ModelSettings } from './modelGeneration'

const stages = {
  notes: '深化笔记',
  validation: '可行性验证',
  research: '原创性检索',
  optimize: '完善与冻结',
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
  imageSettings: ImageSettings
  onImageSettingsChange: (change: Partial<ImageSettings>) => void
  settings: ModelSettings
  onSettingsChange: (change: Partial<ModelSettings>) => void
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

function ReportPanel({ projectName, round, roundNumber, concept }: Pick<RefinementProps, 'projectName' | 'round' | 'roundNumber' | 'concept'>) {
  const report = buildDesignReport(projectName, round, roundNumber, concept)

  function download() {
    const file = new Blob([formatDesignReport(report)], { type: 'text/markdown;charset=utf-8' })
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

export function RefinementWorkspace({ projectId, projectName, round, roundNumber, concept, onChange, children, imageSettings, onImageSettingsChange, settings, onSettingsChange }: RefinementProps) {
  const [stage, setStage] = useState<Stage>('notes')
  const locked = Boolean(developmentOf(concept).frozen)
  function edit(update: (current: Concept) => Concept) {
    onChange(current => developmentOf(current).frozen ? current : update(current))
  }

  return (
    <>
      <details className="studio-surface development-model-settings">
        <summary>深化 AI 模型设置</summary>
        <ModelControls settings={settings} onSettingsChange={onSettingsChange} settingsOnly customModel onModeChange={() => {}} disabled={false}
          requestDescription="深化分析、检索比较和完善总结共用此文字模型。模型建议由你修正与确认。" />
      </details>
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
        <DevelopmentAssistant step="notes" concept={concept} settings={settings} onChange={edit}>
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
      {stage === 'validation' && <DevelopmentAssistant step="validation" concept={concept} settings={settings} onChange={edit}>
        <ValidationPanel concept={concept} onChange={edit} />
      </DevelopmentAssistant>}
      {stage === 'research' && (
        <DevelopmentAssistant step="research" concept={concept} settings={settings} onChange={edit}>
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
      {stage === 'optimize' && <ConceptFreezePanel concept={concept} settings={settings} onChange={onChange} onFrozen={() => setStage('visuals')} />}
      {stage === 'report' && <ReportPanel projectName={projectName} round={round} roundNumber={roundNumber} concept={concept} />}
      {stage === 'visuals' && <VisualStudio key={`${roundNumber}:${concept.id}`} projectId={projectId}
        projectName={projectName} round={round} roundNumber={roundNumber} concept={concept} onChange={onChange}
        imageSettings={imageSettings} onImageSettingsChange={onImageSettingsChange} />}
    </>
  )
}
