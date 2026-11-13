import { useState } from 'react'
import type { FormEvent } from 'react'
import { briefSentences, maxRoundConcepts, modelSourceLabel, normalizeDraft, sentenceLabels } from './concepts'
import type { ChatIdea, ConceptCandidate, ConceptDraft, ConceptStudioState, ModelSource } from './concepts'
import { canUseCustomModel, conceptContentFields, hasModelSettings } from './modelGeneration'
import type { ModelSettings } from './modelGeneration'
import { extractWithModel } from './modelStudio'
import { useModelTask } from './useModelTask'

type ImportProps = {
  idea: ChatIdea
  state: ConceptStudioState
  settings: ModelSettings
  onSave: (destination: number | null, brief: ConceptDraft, candidate: ConceptCandidate, useAsDraft: boolean) => void
  onDismiss: () => void
}

const empty = {
  title: '', format: '对话构想', idea: '', interaction: '', difference: '', value: '', risk: '', test: '',
}

export function ChatConceptImport({ idea, state, settings, onSave, onDismiss }: ImportProps) {
  const { pending, notice, run, cancel } = useModelTask()
  const [destination, setDestination] = useState<number | null>(() => {
    const round = state.rounds[state.activeRound]
    return round && round.concepts.length < maxRoundConcepts ? state.activeRound : null
  })
  const [draft, setDraft] = useState<ConceptDraft>(() => ({
    problem: idea.question || state.draft.problem,
    audience: state.draft.audience,
    scenario: state.draft.scenario,
    count: state.draft.count,
  }))
  const [fields, setFields] = useState(empty)
  const [organizedBy, setOrganizedBy] = useState<ModelSource>()
  const target = destination === null ? undefined : state.rounds[destination]
  const brief = normalizeDraft(draft)
  const complete = Boolean(brief.problem && brief.audience && brief.scenario)
  const room = destination === null || Boolean(target && target.concepts.length < maxRoundConcepts)
  const canExtract = canUseCustomModel(window.location.hostname) && hasModelSettings(settings)
  const canSave = Boolean(brief.problem && fields.title.trim() && fields.idea.trim() && room && !pending)

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const useAsDraft = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') !== 'add-only'
    if (!canSave || (!useAsDraft && !complete && !target)) return
    const details = Object.fromEntries(
      conceptContentFields.map(key => [key, fields[key].trim() || '待补充。']),
    ) as Pick<ConceptCandidate['sentences'], typeof conceptContentFields[number]>
    onSave(destination, brief, {
      id: crypto.randomUUID(),
      title: fields.title.trim(),
      format: fields.format.trim() || '对话构想',
      sentences: { ...briefSentences(brief), ...details },
      chatOrigin: { messageId: idea.messageId, source: idea.source, organizedBy },
    }, useAsDraft)
  }

  function extract() {
    if (!canExtract) return
    void run(
      signal => extractWithModel(brief, idea.reply, fields.idea, settings, signal),
      ({ brief: organizedBrief, candidate, source }) => {
        const { title, format, sentences: { idea, interaction, difference, value, risk, test } } = candidate
        setFields({ title, format, idea, interaction, difference, value, risk, test })
        setDraft(organizedBrief)
        setOrganizedBy(source)
      },
      '已整理概念卡和简报。请核对已填写的内容，并补充缺失信息。',
    )
  }

  return (
    <form className="studio-surface studio-brief studio-chat-import" onSubmit={save} aria-labelledby="chat-import-heading">
      <h2 id="chat-import-heading">从对话导入创意</h2>
      <p className="studio-hint">先用 AI 整理对话，再核对概念并加入工作台；设计简报只需维护一份。</p>
      <details className="studio-import-source">
        <summary>查看对话原文 · {modelSourceLabel(idea.source)}</summary>
        <p>{idea.reply}</p>
      </details>
      <label className="studio-field">
        加入位置
        <select disabled={pending} value={destination ?? ''} onChange={event => {
          setDestination(event.target.value === '' ? null : Number(event.target.value))
        }}>
          <option value="">新建对话概念轮次</option>
          {state.rounds.map((round, index) => (
            <option key={index} value={index} disabled={round.concepts.length >= maxRoundConcepts}>
              第 {index + 1} 轮 · {round.concepts.length} 个概念{round.concepts.length >= maxRoundConcepts ? '（已满）' : ''}
            </option>
          ))}
        </select>
      </label>
      <details className="studio-import-brief">
        <summary>设计简报（可选核对）</summary>
        <p className="studio-hint">加入已有轮次会沿用该轮简报；此处内容可另存为下一轮草稿。</p>
        {([
          ['problem', '设计问题'], ['audience', '目标用户'], ['scenario', '使用场景'],
        ] as const).map(([key, label]) => (
          <label className="studio-field" key={key}>
            {label}
            <input
              maxLength={key === 'problem' ? 1000 : 500}
              value={draft[key]}
              disabled={pending}
              onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))}
            />
          </label>
        ))}
      </details>
      <div className="studio-actions">
        <button type="button" className="studio-button" disabled={!canExtract || pending} onClick={extract}>
          {pending ? '正在整理…' : '用模型整理'}
        </button>
        {pending && <button type="button" className="studio-button" onClick={cancel}>取消整理</button>}
        <span className="studio-hint">
          {canExtract ? '模型会读取简报和所选回复的前 8000 字。也可直接填写。' : '可手动整理，也可先在下方完成 API 设置。'}
        </span>
      </div>
      <p className="studio-hint" role="status">{notice}</p>
      <details className="studio-import-fields" open={!organizedBy}>
        <summary>概念内容（整理后可核对或修改）</summary>
        <label className="studio-field">
          概念名称
          <input value={fields.title} maxLength={60} disabled={pending} required={false}
            onChange={event => setFields(current => ({ ...current, title: event.target.value }))} />
        </label>
        <label className="studio-field">
          方案形态
          <input value={fields.format} maxLength={60} disabled={pending}
            onChange={event => setFields(current => ({ ...current, format: event.target.value }))} />
        </label>
        {conceptContentFields.map(key => (
          <label className="studio-field" key={key}>
            {sentenceLabels[key]}
            <textarea value={fields[key]} maxLength={600} rows={2} disabled={pending}
              placeholder={key === 'idea' ? '写下创意方向，或点击上方 AI 整理' : '可留空'}
              onChange={event => setFields(current => ({ ...current, [key]: event.target.value }))} />
          </label>
        ))}
      </details>
      <div className="studio-actions">
        <button type="submit" value="draft" className="studio-button primary" disabled={!canSave}>
          加入工作台并同步简报
        </button>
        <details>
          <summary>其他保存方式</summary>
          <button type="submit" value="add-only" className="studio-button" disabled={!canSave || (!complete && !target)}>
            仅加入 Concept Studio（不修改简报）
          </button>
        </details>
        <button type="button" className="studio-button" onClick={onDismiss}>返回工作室</button>
      </div>
    </form>
  )
}