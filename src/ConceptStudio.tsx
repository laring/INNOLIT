import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Layers } from 'lucide-react'
import {
  addChatConcept, appendConceptRound, conceptCounts, conceptSourceLabel, normalizeDraft, sentenceLabels,
} from './concepts'
import type {
  ChatIdea, Concept, ConceptBatch, ConceptCount, ConceptDraft, ConceptStudioState, Score, ScoreDimension,
} from './concepts'
import { RefinementWorkspace } from './RefinementWorkspace'
import { canUseCustomModel, generateWithModel, hasModelSettings } from './modelGeneration'
import type { ModelSettings } from './modelGeneration'
import { ModelControls } from './ModelControls'
import { ChatConceptImport } from './ChatConceptImport'
import { ConceptComparison } from './ConceptComparison'
import './ConceptStudio.css'

type StudioProps = {
  projectName: string
  state: ConceptStudioState
  onChange: (update: (current: ConceptStudioState) => ConceptStudioState) => void
  settings: ModelSettings
  onSettingsChange: (change: Partial<ModelSettings>) => void
  idea?: ChatIdea
  onDismissIdea: () => void
}

const sentences = Object.keys(sentenceLabels) as (keyof typeof sentenceLabels)[]

function ConceptFramework({ concept }: { concept: Concept }) {
  return (
    <ol className="concept-framework">
      {sentences.map(key => (
        <li key={key}>
          <strong>{sentenceLabels[key]}</strong>
          <span>{concept.sentences[key]}</span>
        </li>
      ))}
    </ol>
  )
}

function focusHeading(heading: HTMLHeadingElement | null) {
  heading?.scrollIntoView({ block: 'start' })
  heading?.focus({ preventScroll: true })
}

export function ConceptStudio({ projectName, state, onChange, settings, onSettingsChange, idea, onDismissIdea }: StudioProps) {
  const [refining, setRefining] = useState(false)
  const [customModel, setCustomModel] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [notice, setNotice] = useState('')
  const request = useRef<AbortController | null>(null)
  const conceptHeading = useRef<HTMLHeadingElement>(null)
  const comparisonHeading = useRef<HTMLHeadingElement>(null)
  const pendingFocus = useRef<'concepts' | 'comparison' | null>(null)
  const { draft, rounds, activeRound } = state
  const batch = rounds[activeRound]
  const latest = rounds.at(-1)
  const selected = batch?.concepts.find(concept => concept.id === batch.selectedId)
  const normalized = normalizeDraft(draft)
  const ready = normalized.problem && normalized.audience && normalized.scenario
  const configured = hasModelSettings(settings)
  const unchanged = latest && !latest.origin && !latest.generation && !customModel && (
    latest.brief.problem === normalized.problem &&
    latest.brief.audience === normalized.audience &&
    latest.brief.scenario === normalized.scenario &&
    latest.brief.count === normalized.count
  )

  useEffect(() => {
    if (!pendingFocus.current) return
    const heading = pendingFocus.current === 'concepts' ? conceptHeading : comparisonHeading
    pendingFocus.current = null
    focusHeading(heading.current)
  }, [rounds.length, batch?.concepts.length, activeRound, refining])

  useEffect(() => () => request.current?.abort(), [])

  function editDraft(fields: Partial<ConceptDraft>) {
    onChange(current => ({ ...current, draft: { ...current.draft, ...fields } }))
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || unchanged || request.current) return
    setNotice('')
    if (!customModel) {
      pendingFocus.current = 'concepts'
      onChange(appendConceptRound)
      return
    }
    if (!canUseCustomModel(window.location.hostname) || !configured) return

    const controller = new AbortController()
    request.current = controller
    setGenerating(true)
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(150000)])
      const result = await generateWithModel(draft, settings, signal)
      if (controller.signal.aborted) return
      pendingFocus.current = 'concepts'
      onChange(current => appendConceptRound(current, result))
    } catch (error) {
      if (!controller.signal.aborted) {
        setNotice(error instanceof DOMException && error.name === 'TimeoutError'
          ? '等待模型服务超时。可减少概念数量后重试。'
          : error instanceof Error && !(error instanceof TypeError)
            ? error.message
            : '无法连接模型服务。请检查配置，或选择本地规则。')
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        if (!controller.signal.aborted) setGenerating(false)
      }
    }
  }

  function cancelGeneration() {
    request.current?.abort()
    request.current = null
    setGenerating(false)
    setNotice('已取消本轮生成。')
  }

  function updateRound(update: (round: ConceptBatch) => ConceptBatch) {
    onChange(current => ({
      ...current,
      rounds: current.rounds.map((round, index) => index === activeRound ? update(round) : round),
    }))
  }

  function editConcept(id: Concept['id'], update: (concept: Concept) => Concept) {
    updateRound(round => ({
      ...round,
      concepts: round.concepts.map(concept => concept.id === id ? update(concept) : concept),
    }))
  }

  function setScore(id: Concept['id'], dimension: ScoreDimension, score: Score | null) {
    editConcept(id, concept => ({ ...concept, scores: { ...concept.scores, [dimension]: score } }))
  }

  function selectConcept(id: Concept['id']) {
    updateRound(round => ({ ...round, selectedId: id }))
  }

  if (refining && batch && selected) {
    return (
      <section className="studio-scroll" key="refinement" aria-labelledby="refinement-heading">
        <div className="studio-content">
          <button type="button" className="studio-button" onClick={() => {
            pendingFocus.current = 'comparison'
            setRefining(false)
          }}>
            <ArrowLeft size={16} aria-hidden="true" />
            返回概念比较
          </button>
          <header className="studio-intro">
            <p className="studio-kicker">第 {activeRound + 1} 轮 · 已选方案 · {selected.format}</p>
            <h1 id="refinement-heading" ref={focusHeading} tabIndex={-1}>方案深化 · {selected.title}</h1>
            <p>记录验证与检索证据，并整理本轮的设计报告。</p>
            <span className="studio-badge">{conceptSourceLabel(batch)}</span>
          </header>
          <RefinementWorkspace
            projectName={projectName}
            round={batch}
            roundNumber={activeRound + 1}
            concept={selected}
            onChange={update => editConcept(selected.id, update)}
          >
            <details>
              <summary>查看完整九句话</summary>
              <ConceptFramework concept={selected} />
            </details>
          </RefinementWorkspace>
        </div>
      </section>
    )
  }

  return (
    <section className="studio-scroll" key="studio" aria-labelledby="studio-heading">
      <div className="studio-content">
        <header className="studio-intro">
          <p className="studio-kicker"><Layers size={15} aria-hidden="true" /> V0.2 · 创意方案</p>
          <h1 id="studio-heading">Concept Studio</h1>
          <p>从同一设计问题探索 3–6 个方向，再比较、评分并选定一个进行深化。</p>
        </header>

        {idea && (
          <ChatConceptImport
            key={idea.messageId}
            idea={idea}
            state={state}
            settings={settings}
            onDismiss={onDismissIdea}
            onSave={(destination, brief, candidate) => {
              pendingFocus.current = 'concepts'
              onChange(current => addChatConcept(current, destination, brief, candidate))
              onDismissIdea()
            }}
          />
        )}

        <form className="studio-surface studio-brief" onSubmit={generate}>
          <h2>设计简报草稿</h2>
          <label className="studio-field studio-problem">
            设计问题
            <textarea
              rows={2}
              value={draft.problem}
              onChange={event => editDraft({ problem: event.target.value })}
              placeholder="例如，如何帮助学生在课间快速放松？"
              disabled={generating}
              required
            />
          </label>
          <label className="studio-field">
            目标用户
            <input
              value={draft.audience}
              onChange={event => editDraft({ audience: event.target.value })}
              placeholder="例如，备考的高中生"
              disabled={generating}
              required
            />
          </label>
          <label className="studio-field">
            使用场景
            <input
              value={draft.scenario}
              onChange={event => editDraft({ scenario: event.target.value })}
              placeholder="例如，两节课之间的教室桌面"
              disabled={generating}
              required
            />
          </label>
          <div className="studio-model">
            <ModelControls
              settings={settings}
              onSettingsChange={change => {
                onSettingsChange(change)
                setNotice('')
              }}
              customModel={customModel}
              onModeChange={custom => {
                setCustomModel(custom)
                setNotice('')
              }}
              disabled={generating}
              requestDescription="生成时会将当前设计简报发送给所选服务。"
            />
          </div>
          <div className="studio-actions">
            <label className="studio-field">
              生成数量
              <select value={draft.count} disabled={generating} onChange={event => editDraft({ count: Number(event.target.value) as ConceptCount })}>
                {conceptCounts.map(count => <option key={count} value={count}>{count} 个</option>)}
              </select>
            </label>
            <button type="submit" className="studio-button primary" disabled={!ready || Boolean(unchanged) || generating || (customModel && !configured)}>
              {generating ? '正在生成…' : latest ? '生成新一轮' : '生成概念'}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            {generating && <button type="button" className="studio-button" onClick={cancelGeneration}>取消生成</button>}
          </div>
          <p className="studio-hint" role="status">
            {generating
              ? `正在使用 ${settings.model.trim()} 生成概念…`
              : notice || (latest
              ? unchanged
                ? `最新的第 ${rounds.length} 轮有 ${latest.concepts.length} 个概念。可修改简报、数量或选择模型生成新一轮。`
                : '生成新一轮会保留已有轮次及其评分和深化笔记。'
              : '填写三个字段后即可生成概念。')}
          </p>
        </form>

        {batch && (
          <>
            <section className="studio-section" aria-labelledby="concept-heading">
              <h2 id="concept-heading" tabIndex={-1} ref={conceptHeading}>概念方向 <span>{batch.concepts.length} 个</span></h2>
              <p className="studio-hint">{conceptSourceLabel(batch)}</p>
              <div className="studio-round-bar">
                <label className="studio-field">
                  概念轮次
                  <select value={activeRound} onChange={event => {
                    const index = Number(event.target.value)
                    onChange(current => ({ ...current, activeRound: index }))
                  }}>
                    {rounds.map((round, index) => (
                      <option key={index} value={index}>
                        第 {index + 1} 轮 · {round.concepts.length} 个概念{index === rounds.length - 1 ? '（最新）' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="studio-actions">
                  <button type="button" className="studio-button" onClick={() => focusHeading(comparisonHeading.current)}>
                    查看比较 <ArrowRight size={16} aria-hidden="true" />
                  </button>
                  {selected && (
                    <button type="button" className="studio-button primary" disabled={generating} onClick={() => setRefining(true)}>继续深化</button>
                  )}
                </div>
              </div>
              <details className="studio-round-brief" key={`brief-${activeRound}`}>
                <summary>查看本轮生成简报</summary>
                <dl>
                  <dt>设计问题</dt><dd>{batch.brief.problem}</dd>
                  <dt>目标用户</dt><dd>{batch.brief.audience}</dd>
                  <dt>使用场景</dt><dd>{batch.brief.scenario}</dd>
                </dl>
              </details>
              <p className="studio-hint">展开卡片查看每个方向的完整九句话。</p>
              <div className="studio-cards" key={`cards-${activeRound}`}>
                {batch.concepts.map((concept, index) => (
                  <article className="studio-surface studio-card" key={concept.id} data-selected={selected?.id === concept.id}>
                    <p className="studio-kicker">{String(index + 1).padStart(2, '0')} · {concept.format}</p>
                    <h3>{concept.title}</h3>
                    {concept.chatOrigin && <span className="studio-badge">来自创意对话</span>}
                    <p>{concept.sentences.idea}</p>
                    <details>
                      <summary>查看九句话</summary>
                      <ConceptFramework concept={concept} />
                    </details>
                  </article>
                ))}
              </div>
            </section>

            <section className="studio-section" aria-labelledby="comparison-heading">
              <h2 id="comparison-heading" tabIndex={-1} ref={comparisonHeading}>概念比较</h2>
              <ConceptComparison
                key={activeRound}
                batch={batch}
                settings={settings}
                onScore={setScore}
                onSelect={selectConcept}
                onReviews={reviews => updateRound(round => ({
                  ...round,
                  concepts: round.concepts.map(concept => {
                    const modelReview = reviews.get(concept.id)
                    return modelReview ? { ...concept, modelReview } : concept
                  }),
                }))}
                onRefine={() => setRefining(true)}
                generating={generating}
              />
            </section>
          </>
        )}
      </div>
    </section>
  )
}
