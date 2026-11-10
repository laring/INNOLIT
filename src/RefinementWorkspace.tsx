import { useState } from 'react'
import type { ReactNode } from 'react'
import { Download } from 'lucide-react'
import type { Concept, ConceptBatch } from './concepts'
import {
  buildDesignReport, emptyValidation, formatDesignReport, updateValidation, validationFields, validationOutcomes,
} from './designWork'
import type { ResearchLog, ValidationOutcome, ValidationPlan } from './designWork'
import { EvidencePanel } from './EvidencePanel'

const stages = {
  notes: '深化笔记',
  validation: '可行性验证',
  research: '原创性检索',
  report: '设计报告',
} as const

type Stage = keyof typeof stages
const stageNames = Object.keys(stages) as Stage[]
const fields = Object.keys(validationFields) as (keyof typeof validationFields)[]
const emptyResearch: ResearchLog = { keywords: '', evidence: [] }

type RefinementProps = {
  projectName: string
  round: ConceptBatch
  roundNumber: number
  concept: Concept
  onChange: (update: (current: Concept) => Concept) => void
  children: ReactNode
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
    </section>
  )
}

function ReportPanel({ projectName, round, roundNumber, concept }: Omit<RefinementProps, 'onChange' | 'children'>) {
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

export function RefinementWorkspace({ projectName, round, roundNumber, concept, onChange, children }: RefinementProps) {
  const [stage, setStage] = useState<Stage>('notes')

  return (
    <>
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
                onChange(current => ({ ...current, notes }))
              }}
              placeholder="记录方案调整、待解决的问题与下一步"
            />
          </label>
          {children}
        </section>
      )}
      {stage === 'validation' && <ValidationPanel concept={concept} onChange={onChange} />}
      {stage === 'research' && (
        <EvidencePanel
          research={concept.research ?? emptyResearch}
          onChange={update => onChange(current => ({ ...current, research: update(current.research ?? emptyResearch) }))}
        />
      )}
      {stage === 'report' && <ReportPanel projectName={projectName} round={round} roundNumber={roundNumber} concept={concept} />}
    </>
  )
}
