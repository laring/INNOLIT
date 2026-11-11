import { useState } from 'react'
import { modelSourceLabel, sentenceLabels } from './concepts'
import type { Concept } from './concepts'
import { developmentOf, developmentSteps, freezeConcept, freezeProblems, identityFields, reopenConcept, stepConfirmed, synthesisContext, titleFonts } from './conceptDevelopment'
import type { ProductIdentity, Synthesis } from './conceptDevelopment'
import { synthesizeConcept } from './developmentModel'
import { hasModelSettings } from './modelGeneration'
import type { ModelSettings } from './modelGeneration'
import { useModelTask } from './useModelTask'

export function ConceptFreezePanel({ concept, settings, onChange, onFrozen }: {
  concept: Concept; settings: ModelSettings; onChange: (update: (current: Concept) => Concept) => void; onFrozen: () => void
}) {
  const { pending, notice, run, cancel } = useModelTask()
  const [reviewed, setReviewed] = useState(false)
  const data = developmentOf(concept)
  const frozen = data.frozen
  const final = frozen?.design ?? data.final
  const identity = frozen?.identity ?? data.identity
  const ready = Object.keys(developmentSteps).every(step => stepConfirmed(concept, step as keyof typeof developmentSteps))
  const problems = freezeProblems(concept)

  function updateFinal(change: Partial<Synthesis>) {
    setReviewed(false)
    onChange(current => {
      const development = developmentOf(current)
      return development.final ? { ...current, development: { ...development, final: { ...development.final, ...change } } } : current
    })
  }
  function updateIdentity(change: Partial<ProductIdentity>) {
    setReviewed(false)
    onChange(current => ({ ...current, development: { ...developmentOf(current), identity: { ...developmentOf(current).identity, ...change } } }))
  }
  return <section className="studio-surface studio-refinement">
    <h2>{frozen ? `概念已冻结 · V${frozen.revision}` : '完善优化、总结与概念冻结'}</h2>
    <p>根据三步中你修正并确认的记录形成最终方案，再锁定产品规范。冻结后的三张展示图都引用同一版本。</p>
    <ul>{Object.entries(developmentSteps).map(([key, label]) => <li key={key}>{label}：{stepConfirmed(concept, key as keyof typeof developmentSteps) ? 'AI 参与 · 人工已确认' : '待完成'}</li>)}</ul>
    {!frozen && <div className="studio-actions">
      <button type="button" className="studio-button primary" disabled={!ready || pending || !hasModelSettings(settings)} onClick={() => {
        setReviewed(false)
        void run(signal => synthesizeConcept(concept, settings, signal), result => onChange(current => {
          if (synthesisContext(current) !== result.final.contextKey) return current
          const development = developmentOf(current)
          const identity = { ...result.identity, ...Object.fromEntries(Object.entries(development.identity).filter(([, value]) => value.trim())) } as ProductIdentity
          return { ...current, development: { ...development, final: result.final, identity } }
        }), '完善方案已生成，请人工修正，并明确产品一致性规范。')
      }}>AI 完善概念与总结</button>
      {pending && <button type="button" className="studio-button" onClick={cancel}>取消完善</button>}
    </div>}
    <p className="studio-hint" role="status">{notice || (frozen ? `冻结编号：${frozen.id}` : '三步人工确认后可生成完善方案。')}</p>
    {final && <>
      <p className="studio-badge">完善模型：{modelSourceLabel(frozen?.source ?? data.final?.source)}</p>
      <fieldset className="development-fields studio-refinement" disabled={Boolean(frozen) || pending}>
        <label className="studio-field">最终概念标题<input value={final.title} maxLength={100} onChange={event => updateFinal({ title: event.target.value })} /></label>
        <label className="studio-field">最终产品形态<input value={final.format} maxLength={100} onChange={event => updateFinal({ format: event.target.value })} /></label>
        <div className="studio-validation-fields">{Object.entries(sentenceLabels).map(([key, label]) => <label className="studio-field" key={key}>{label}
          <textarea rows={3} maxLength={1000} value={final.sentences[key as keyof typeof sentenceLabels]} onChange={event => updateFinal({ sentences: { ...final.sentences, [key]: event.target.value } })} />
        </label>)}</div>
        {(['insight', 'mechanism', 'useFlow', 'summary'] as const).map(key => <label className="studio-field" key={key}>
          {{ insight: '设计洞察', mechanism: '产品机制', useFlow: '使用流程', summary: '完善总结与剩余风险' }[key]}
          <textarea rows={4} maxLength={4000} value={final[key]} onChange={event => updateFinal({ [key]: event.target.value })} />
        </label>)}
        <h3>三图共用的产品一致性规范</h3>
        <p className="studio-hint">填写已确定的形态、参数与标识；将“待确认”“建议”等内容改为明确决定后冻结。</p>
        <div className="studio-validation-fields">{Object.entries(identityFields).map(([key, label]) => <label className="studio-field" key={key}>{label}
          <textarea rows={3} maxLength={800} value={identity[key as keyof typeof identityFields]} onChange={event => updateIdentity({ [key]: event.target.value })} />
        </label>)}</div>
        <label className="studio-field">统一标题字体<select value={identity.titleFont} onChange={event => updateIdentity({ titleFont: event.target.value as ProductIdentity['titleFont'] })}>
          {titleFonts.map(font => <option key={font}>{font}</option>)}
        </select></label>
        <label className="studio-field">场景表达例外理由（仅不适合场景化的项目填写）
          <textarea rows={2} maxLength={1000} value={frozen?.sceneException ?? data.sceneException} placeholder="通常留空；例外必须说明项目为何不适合真实使用场景表达。" onChange={event => {
            setReviewed(false)
            const sceneException = event.target.value
            onChange(current => ({ ...current, development: { ...developmentOf(current), sceneException } }))
          }} />
        </label>
      </fieldset>
      {!frozen && <>
        {problems.length > 0 && <ul className="studio-hint">{problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
        <label className="studio-choice"><input type="checkbox" checked={reviewed} disabled={pending} onChange={event => setReviewed(event.target.checked)} />我已核对最终概念、八项一致性规范和剩余风险；未实测事项仍按未实测记录。</label>
        <button type="button" className="studio-button primary" disabled={pending || problems.length > 0 || !reviewed} onClick={() => {
          const id = crypto.randomUUID(); const at = Date.now()
          onChange(current => freezeConcept(current, id, at)); onFrozen()
        }}>冻结概念并进入展示制作</button>
      </>}
    </>}
    {frozen && <><p>设计内容已锁定。需要调整时创建修订版，现有冻结版本和对应图片继续保留。</p><button type="button" className="studio-button" onClick={() => { setReviewed(false); onChange(reopenConcept) }}>创建修订版</button></>}
    {data.history.length > 0 && <details><summary>历史冻结版本 · {data.history.length}</summary><ul>{data.history.map(item => <li key={item.id}>V{item.revision} · {item.design.title} · {new Date(item.at).toLocaleString()} · {item.id}</li>)}</ul></details>}
  </section>
}
