import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Layers } from 'lucide-react'
import {
  averageScore, conceptCounts, generateConceptBatch, normalizeDraft,
  scoreDimensions, scoreOptions, sentenceLabels,
} from './concepts'
import type {
  Concept, ConceptCount, ConceptDraft, ConceptStudioState, Score, ScoreDimension,
} from './concepts'
import './ConceptStudio.css'

type StudioProps = {
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
  heading?.focus()
}

export function ConceptStudio({ state, onChange }: StudioProps) {
  const [refining, setRefining] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { draft, batch } = state
  const selected = batch?.concepts.find(concept => concept.id === batch.selectedId)
  const normalized = normalizeDraft(draft)
  const ready = normalized.problem && normalized.audience && normalized.scenario
  const unchanged = batch && (
    batch.brief.problem === normalized.problem &&
    batch.brief.audience === normalized.audience &&
    batch.brief.scenario === normalized.scenario &&
    batch.brief.count === normalized.count
  )

  function editDraft(fields: Partial<ConceptDraft>) {
    setConfirming(false)
    onChange(current => ({ ...current, draft: { ...current.draft, ...fields } }))
  }

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || unchanged || confirming) return
    if (batch) setConfirming(true)
    else commitBatch()
  }

  function commitBatch() {
    const nextBatch = generateConceptBatch(draft)
    onChange(() => ({ draft: nextBatch.brief, batch: nextBatch }))
    setConfirming(false)
  }

  function editConcept(id: Concept['id'], update: (concept: Concept) => Concept) {
    onChange(current => {
      if (!current.batch) return current
      return {
        ...current,
        batch: {
          ...current.batch,
          concepts: current.batch.concepts.map(concept => concept.id === id ? update(concept) : concept),
        },
      }
    })
  }

  function setScore(id: Concept['id'], dimension: ScoreDimension, score: Score | null) {
    editConcept(id, concept => ({ ...concept, scores: { ...concept.scores, [dimension]: score } }))
  }

  function selectConcept(id: Concept['id']) {
    onChange(current => current.batch
      ? { ...current, batch: { ...current.batch, selectedId: id } }
      : current)
  }

  if (refining && selected) {
    return (
      <section className="studio-scroll" key="refinement" aria-labelledby="refinement-heading">
        <div className="studio-content">
          <button type="button" className="studio-button" onClick={() => setRefining(false)}>
            <ArrowLeft size={16} aria-hidden="true" />
            返回概念比较
          </button>
          <header className="studio-intro">
            <p className="studio-kicker">已选方案 · {selected.format}</p>
            <h1 id="refinement-heading" ref={focusHeading} tabIndex={-1}>方案深化 · {selected.title}</h1>
            <p>用现有概念确定首轮原型和验证计划。笔记会保存到当前项目。</p>
          </header>
          <div className="studio-surface studio-refinement">
            <div>
              <h2>首轮验证</h2>
              <p><strong>关键风险</strong>　{selected.sentences.risk}</p>
              <p><strong>验证方式</strong>　{selected.sentences.test}</p>
            </div>
            <label className="studio-field">
              深化笔记
              <textarea
                rows={5}
                maxLength={4000}
                value={selected.notes}
                onChange={event => {
                  const notes = event.target.value
                  editConcept(selected.id, concept => ({ ...concept, notes }))
                }}
                placeholder="记录原型材料、验证步骤和观察结果"
              />
            </label>
            <details>
              <summary>查看完整九句话</summary>
              <ConceptFramework concept={selected} />
            </details>
          </div>
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
          <span className="studio-badge">本地规则生成 · 非 AI</span>
        </header>

        <form className="studio-surface studio-brief" onSubmit={generate}>
          <h2>设计简报</h2>
          <label className="studio-field studio-problem">
            设计问题
            <textarea
              rows={2}
              value={draft.problem}
              onChange={event => editDraft({ problem: event.target.value })}
              placeholder="例如，如何帮助学生在课间快速放松？"
              required
            />
          </label>
          <label className="studio-field">
            目标用户
            <input
              value={draft.audience}
              onChange={event => editDraft({ audience: event.target.value })}
              placeholder="例如，备考的高中生"
              required
            />
          </label>
          <label className="studio-field">
            使用场景
            <input
              value={draft.scenario}
              onChange={event => editDraft({ scenario: event.target.value })}
              placeholder="例如，两节课之间的教室桌面"
              required
            />
          </label>
          <div className="studio-actions">
            <label className="studio-field">
              生成数量
              <select value={draft.count} onChange={event => editDraft({ count: Number(event.target.value) as ConceptCount })}>
                {conceptCounts.map(count => <option key={count} value={count}>{count} 个</option>)}
              </select>
            </label>
            <button type="submit" className="studio-button primary" disabled={!ready || Boolean(unchanged) || confirming}>
              {batch ? '生成新一轮' : '生成概念'}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="studio-hint" role="status">
            {batch
              ? unchanged
                ? `已生成 ${batch.concepts.length} 个概念。修改简报或数量可生成新一轮。`
                : '简报已有变更。下方仍显示上一轮的概念和评分。'
              : '填写三个字段后即可生成概念。'}
          </p>
          {confirming && (
            <div className="studio-replace" role="group" aria-label="确认生成新一轮">
              <p role="status">生成新一轮将替换当前概念、评分、已选方案和深化笔记。</p>
              <button type="button" className="studio-button" onClick={() => setConfirming(false)}>取消</button>
              <button type="button" className="studio-button primary" onClick={commitBatch}>替换本轮</button>
            </div>
          )}
        </form>

        {batch && (
          <>
            <section className="studio-section" aria-labelledby="concept-heading">
              <h2 id="concept-heading">概念方向 <span>{batch.concepts.length} 个</span></h2>
              <p className="studio-hint">展开卡片查看每个方向的完整九句话。</p>
              <div className="studio-cards">
                {batch.concepts.map((concept, index) => (
                  <article className="studio-surface studio-card" key={concept.id}>
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
              <h2 id="comparison-heading">概念比较</h2>
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
                <button type="button" className="studio-button primary" disabled={!selected} onClick={() => setRefining(true)}>
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
