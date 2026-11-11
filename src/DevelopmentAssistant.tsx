import type { ReactNode } from 'react'
import type { Concept } from './concepts'
import { modelSourceLabel } from './concepts'
import { confirmStep, developmentOf, developmentSteps, stepConfirmed, stepReady } from './conceptDevelopment'
import type { DevelopmentStep } from './conceptDevelopment'
import { assistDevelopment } from './developmentModel'
import { emptyValidation, updateValidation } from './designWork'
import { hasModelSettings } from './modelGeneration'
import type { ModelSettings } from './modelGeneration'
import { searchPapers } from './paperSearch'
import { useModelTask } from './useModelTask'

type Props = { step: DevelopmentStep; concept: Concept; settings: ModelSettings; onChange: (update: (current: Concept) => Concept) => void; children: ReactNode }

export function DevelopmentAssistant({ step, concept, settings, onChange, children }: Props) {
  const { pending, notice, run, cancel } = useModelTask()
  const development = developmentOf(concept)
  const advice = development.advice[step]
  const locked = Boolean(development.frozen)
  const confirmed = stepConfirmed(concept, step)

  function analyze(search = false) {
    void run(async signal => {
      const query = (concept.research?.keywords || `${concept.title} ${concept.sentences.problem}`).slice(0, 200)
      const papers = search ? await searchPapers(query, signal) : []
      return assistDevelopment(concept, step, settings, signal, papers.map((paper, index) => ({ ...paper, id: `lookup-${index}`, source: 'paper', comparison: '' })))
    }, result => onChange(current => ({ ...current, development: {
      ...developmentOf(current), advice: { ...developmentOf(current).advice, [step]: result },
    } })), 'AI 分析已保存。请核对、修正并确认本步骤。')
  }

  function adopt() {
    if (!advice) return
    onChange(current => {
      const data = developmentOf(current)
      if (step === 'notes') return { ...current, notes: advice.draft }
      if (step === 'validation') return {
        ...current, validation: updateValidation(current.validation ?? emptyValidation, advice.validation ?? {}),
        development: { ...data, feasibilityConclusion: advice.draft },
      }
      return { ...current, research: { ...(current.research ?? { evidence: [] }), keywords: advice.keywords || current.research?.keywords || '' },
        development: { ...data, researchConclusion: advice.draft } }
    })
  }

  return <div className="development-step">
    <section className="studio-surface studio-refinement">
      <h2>{developmentSteps[step]} · AI 协作</h2>
      <p>先让模型参与思考，再修正下面的人工记录，最后确认本步骤。修改记录后需要重新确认。</p>
      <div className="studio-actions">
        <button type="button" className="studio-button primary" disabled={locked || pending || !hasModelSettings(settings)} onClick={() => analyze()}>AI 分析与建议</button>
        {step === 'research' && <button type="button" className="studio-button" disabled={locked || pending || !hasModelSettings(settings)} onClick={() => analyze(true)}>检索论文并由 AI 比较</button>}
        {pending && <button type="button" className="studio-button" onClick={cancel}>取消分析</button>}
      </div>
      {!hasModelSettings(settings) && <p className="studio-hint">请在上方「深化 AI 模型设置」中填写自己的文字模型 API。</p>}
      <p className="studio-hint" role="status">{notice || (confirmed ? '人工已确认当前记录。' : '等待 AI 参与与人工确认。')}</p>
      {advice && <div className="development-advice">
        <p className="studio-badge">{modelSourceLabel(advice.source)}</p>
        <h3>模型分析</h3><p>{advice.analysis}</p>
        <details><summary>查看 AI 草稿</summary><p>{advice.draft}</p>
          {advice.validation && <dl>{Object.entries(advice.validation).map(([key, value]) => <div key={key}><dt>{key === 'prototype' ? '原型' : key === 'method' ? '步骤' : '标准'}</dt><dd>{value}</dd></div>)}</dl>}
        </details>
        <button type="button" className="studio-button" disabled={locked || pending} onClick={adopt}>采用 AI 草稿后修正</button>
        {step === 'research' && <>
          <p className="studio-hint">模型只接收来源标题、链接和已有比较记录；请阅读原文核对，当前分析不代表完成全文或全面专利检索。</p>
          <ul className="studio-evidence-list">{advice.references.map(item => <li key={item.id}>
            <div><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a><p>{item.comparison}</p></div>
            <button type="button" className="studio-button" disabled={locked || pending || concept.research?.evidence.some(entry => entry.url === item.url)} onClick={() => onChange(current => ({
              ...current, research: { keywords: current.research?.keywords ?? advice.keywords, evidence: [...(current.research?.evidence ?? []), { ...item, id: crypto.randomUUID(), comparison: `AI 初步比较（需核对）：${item.comparison}` }] },
            }))}>录入后核对</button>
          </li>)}</ul>
        </>}
      </div>}
    </section>
    <fieldset className="development-fields" disabled={locked || pending}>{children}</fieldset>
    <div className="studio-actions">
      <button type="button" className="studio-button primary" disabled={locked || pending || !stepReady(concept, step) || confirmed} onClick={() => onChange(current => confirmStep(current, step))}>
        {confirmed ? '当前记录已人工确认' : `确认${developmentSteps[step]}记录`}
      </button>
      {!stepReady(concept, step) && <p className="studio-hint">{step === 'notes' ? '需要 AI 建议和你的深化笔记。' : step === 'validation' ? '需要 AI 建议、原型、测试步骤、通过标准和人工分析结论。实测记录按实际情况填写。' : '需要 AI 建议、至少一条含比较记录的来源和人工检索结论。'}</p>}
    </div>
  </div>
}
