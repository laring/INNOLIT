import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Layers } from 'lucide-react'
import {
  appendConceptRound, averageScore, conceptCounts, conceptSourceLabel, normalizeDraft,
  scoreDimensions, scoreOptions, sentenceLabels,
} from './concepts'
import type {
  Concept, ConceptBatch, ConceptCount, ConceptDraft, ConceptStudioState, Score, ScoreDimension,
} from './concepts'
import { RefinementWorkspace } from './RefinementWorkspace'
import { generateWithModel } from './modelGeneration'
import type { ModelSettings } from './modelGeneration'
import './ConceptStudio.css'

type StudioProps = {
  projectName: string
  state: ConceptStudioState
  onChange: (update: (current: ConceptStudioState) => ConceptStudioState) => void
}

const dimensions = Object.keys(scoreDimensions) as ScoreDimension[]
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

export function ConceptStudio({ projectName, state, onChange }: StudioProps) {
  const [refining, setRefining] = useState(false)
  const [customModel, setCustomModel] = useState(false)
  const [settings, setSettings] = useState<ModelSettings>({ baseUrl: '', model: '', apiKey: '' })
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
  const localPage = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  const configured = settings.baseUrl.trim() && settings.model.trim() && settings.apiKey.trim()
  const unchanged = latest && !latest.generation && !customModel && (
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
  }, [rounds.length, refining])

  useEffect(() => () => request.current?.abort(), [])

  function editDraft(fields: Partial<ConceptDraft>) {
    onChange(current => ({ ...current, draft: { ...current.draft, ...fields } }))
  }

  function editSettings(change: Partial<ModelSettings>) {
    setNotice('')
    setSettings(current => {
      const next = { ...current, ...change }
      if (next.baseUrl.trim() !== current.baseUrl.trim()) next.apiKey = ''
      return next
    })
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
    if (!localPage || !configured) return

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
            <label className="studio-field studio-model-select">
              生成方式
              <select value={customModel ? 'api' : 'rules'} disabled={generating} onChange={event => {
                setCustomModel(event.target.value === 'api')
                setNotice('')
              }}>
                <option value="rules">本地规则（非 AI）</option>
                <option value="api" disabled={!localPage}>自配 API 模型</option>
              </select>
            </label>
            {customModel && (
              <div className="studio-model-settings">
                <label className="studio-field">
                  API 地址
                  <input type="url" maxLength={1000} value={settings.baseUrl} disabled={generating} required
                    onChange={event => editSettings({ baseUrl: event.target.value })} placeholder="https://api.deepseek.com" />
                </label>
                <label className="studio-field">
                  模型 ID
                  <input maxLength={200} value={settings.model} disabled={generating} required
                    onChange={event => editSettings({ model: event.target.value })} placeholder="deepseek-flash" />
                </label>
                <label className="studio-field">
                  API 密钥
                  <input type="password" autoComplete="off" maxLength={2048} value={settings.apiKey} disabled={generating} required
                    onChange={event => editSettings({ apiKey: event.target.value })} />
                </label>
                <div>
                  <button type="button" className="studio-button" disabled={generating} onClick={() => editSettings({
                    baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash',
                  })}>
                    填入 DeepSeek 示例
                  </button>
                </div>
                <p className="studio-hint">
                  生成时会把简报发送至该服务，可能产生 API 费用。密钥仅在当前工作区会话中使用。
                </p>
              </div>
            )}
            {!localPage && <p className="studio-hint">请通过 localhost 打开工作台以使用自配 API 模型。</p>}
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
              <p className="studio-hint" id="score-help">由你填写 1–5 分，1 为最低，5 为最高。三项填满后显示等权平均分。</p>
              <div className="studio-table-scroll" role="region" aria-label="概念比较表" tabIndex={0}>
                <table className="studio-table" aria-describedby="score-help">
                  <thead>
                    <tr>
                      <th scope="col">比较维度</th>
                      {batch.concepts.map(concept => (
                        <th scope="col" key={concept.id}>{concept.title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">差异点</th>
                      {batch.concepts.map(concept => <td key={concept.id}>{concept.sentences.difference}</td>)}
                    </tr>
                    {dimensions.map(dimension => (
                      <tr key={dimension}>
                        <th scope="row">{scoreDimensions[dimension]}</th>
                        {batch.concepts.map(concept => (
                          <td key={concept.id}>
                            <select
                              aria-label={`${concept.title} ${scoreDimensions[dimension]}`}
                              value={concept.scores[dimension] ?? ''}
                              onChange={event => setScore(
                                concept.id, dimension, scoreOptions.find(score => String(score) === event.target.value) ?? null
                              )}
                            >
                              <option value="">未评分</option>
                              {scoreOptions.map(score => <option key={score} value={score}>{score} 分</option>)}
                            </select>
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <th scope="row">平均分</th>
                      {batch.concepts.map(concept => (
                        <td key={concept.id}>{averageScore(concept.scores)?.toFixed(1) ?? '—'}</td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">选择方案</th>
                      {batch.concepts.map(concept => (
                        <td key={concept.id}>
                          <label className="studio-choice">
                            <input
                              type="radio"
                              name="selected-concept"
                              aria-label={`选择 ${concept.title}`}
                              checked={selected?.id === concept.id}
                              onChange={() => selectConcept(concept.id)}
                            />
                            {selected?.id === concept.id ? '已选' : '选择'}
                          </label>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="studio-next">
                <p aria-live="polite">{selected ? `已选方案 · ${selected.title}` : '请选择一个方案继续。'}</p>
                <button type="button" className="studio-button primary" disabled={!selected || generating} onClick={() => setRefining(true)}>
                  进入深化 <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </section>
  )
}
