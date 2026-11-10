import { ArrowRight } from 'lucide-react'
import { averageModelScore, averageScore, modelSourceLabel, scoreDimensions, scoreOptions } from './concepts'
import type { ConceptBatch, ModelReview, Score, ScoreDimension } from './concepts'
import { canUseCustomModel, hasModelSettings } from './modelGeneration'
import type { ModelSettings } from './modelGeneration'
import { reviewCriteria, reviewWithModel } from './modelStudio'
import { useModelTask } from './useModelTask'

type ComparisonProps = {
  batch: ConceptBatch
  settings: ModelSettings
  onScore: (id: string, dimension: ScoreDimension, score: Score | null) => void
  onSelect: (id: string) => void
  onReviews: (reviews: Map<string, ModelReview>) => void
  onRefine: () => void
  generating: boolean
}

const dimensions = Object.keys(scoreDimensions) as ScoreDimension[]

export function ConceptComparison({ batch, settings, onScore, onSelect, onReviews, onRefine, generating }: ComparisonProps) {
  const { pending, notice, run, cancel } = useModelTask()
  const selected = batch.concepts.find(concept => concept.id === batch.selectedId)
  const canReview = canUseCustomModel(window.location.hostname) && hasModelSettings(settings)

  return (
    <>
      <p className="studio-hint" id="score-help">
        人工与模型都按三项各打 1–5 分，平均分分别计算。模型评分用于讨论，方案由你选择。
      </p>
      <details className="studio-review-rubric">
        <summary>查看评分标准</summary>
        <ul>
          {dimensions.map(key => <li key={key}><strong>{scoreDimensions[key]}</strong>　{reviewCriteria[key]}</li>)}
        </ul>
      </details>
      <div className="studio-actions studio-review-actions">
        <button type="button" className="studio-button" disabled={!canReview || pending || generating} onClick={() => {
          void run(signal => reviewWithModel(batch, settings, signal), onReviews, '本轮模型评分与理由已更新。')
        }}>
          {pending ? '正在评分…' : batch.concepts.some(concept => concept.modelReview) ? '更新模型评分' : '让模型评分'}
        </button>
        {pending && <button type="button" className="studio-button" onClick={cancel}>取消评分</button>}
        <p className="studio-hint">
          {canReview
            ? '模型只依据本轮简报和概念独立评分。'
            : '如需模型评分，请先在上方完成自配 API 设置。'}
        </p>
      </div>
      <p className="studio-hint studio-review-status" role="status">{notice}</p>
      <div className="studio-table-scroll" role="region" aria-label="概念比较表" tabIndex={0}>
        <table className="studio-table studio-comparison" aria-describedby="score-help">
          <thead>
            <tr>
              <th scope="col">方案与差异</th>
              <th scope="col">人工评分</th>
              <th scope="col">模型评分与理由</th>
              <th scope="col">选择方案</th>
            </tr>
          </thead>
          <tbody>
            {batch.concepts.map(concept => (
              <tr key={concept.id}>
                <th scope="row">
                  <strong>{concept.title}</strong>
                  {concept.chatOrigin && <p className="studio-hint">来自创意对话</p>}
                  <p className="studio-hint">{concept.sentences.difference}</p>
                </th>
                <td>
                  <div className="studio-human-scores">
                    {dimensions.map(key => (
                      <label className="studio-field" key={key}>
                        {scoreDimensions[key]}
                        <select
                          aria-label={`${concept.title} ${scoreDimensions[key]}`}
                          value={concept.scores[key] ?? ''}
                          onChange={event => onScore(
                            concept.id, key, scoreOptions.find(score => String(score) === event.target.value) ?? null,
                          )}
                        >
                          <option value="">未评分</option>
                          {scoreOptions.map(score => <option key={score} value={score}>{score} 分</option>)}
                        </select>
                      </label>
                    ))}
                    <p className="studio-hint">人工平均分 {averageScore(concept.scores)?.toFixed(1) ?? '—'}</p>
                  </div>
                </td>
                <td>
                  {concept.modelReview ? (
                    <div className="studio-model-review">
                      <dl>
                        {dimensions.map(key => (
                          <div key={key}>
                            <dt>{scoreDimensions[key]} · {concept.modelReview?.ratings[key].score} / 5</dt>
                            <dd>{concept.modelReview?.ratings[key].reason}</dd>
                          </div>
                        ))}
                      </dl>
                      <p className="studio-hint">模型平均分 {averageModelScore(concept.modelReview).toFixed(1)}</p>
                      <p className="studio-hint">{modelSourceLabel(concept.modelReview.source)}</p>
                    </div>
                  ) : <span className="studio-hint">未评分</span>}
                </td>
                <td>
                  <label className="studio-choice">
                    <input
                      type="radio"
                      name="selected-concept"
                      aria-label={`选择 ${concept.title}`}
                      checked={selected?.id === concept.id}
                      onChange={() => onSelect(concept.id)}
                    />
                    {selected?.id === concept.id ? '已选' : '选择'}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="studio-next">
        <p aria-live="polite">{selected ? `已选方案 · ${selected.title}` : '请选择一个方案继续。'}</p>
        <button type="button" className="studio-button primary" disabled={!selected || generating || pending} onClick={onRefine}>
          进入深化 <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </>
  )
}
