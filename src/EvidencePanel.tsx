import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { evidenceSources, evidenceUrl } from './designWork'
import type { Evidence, EvidenceSource, ResearchLog } from './designWork'
import { searchPapers } from './paperSearch'
import type { Paper } from './paperSearch'

type EvidenceDraft = Omit<Evidence, 'id'>
const emptyDraft: EvidenceDraft = { source: 'patent', title: '', url: '', comparison: '' }

type SearchResult = { status: 'idle' | 'loading' | 'failed' } | { status: 'done'; papers: Paper[] }

export function EvidencePanel({ research, onChange }: {
  research: ResearchLog
  onChange: (update: (current: ResearchLog) => ResearchLog) => void
}) {
  const [draft, setDraft] = useState<EvidenceDraft>(emptyDraft)
  const [editing, setEditing] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState<SearchResult>({ status: 'idle' })
  const request = useRef<AbortController | null>(null)
  const evidenceTitle = useRef<HTMLInputElement>(null)
  const keywords = research.keywords.trim()
  const query = new URLSearchParams({ q: keywords }).toString()

  useEffect(() => () => request.current?.abort(), [])

  function changeKeywords(keywords: string) {
    request.current?.abort()
    setSearch({ status: 'idle' })
    onChange(current => ({ ...current, keywords }))
  }

  async function findPapers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!keywords || search.status === 'loading') return
    const controller = new AbortController()
    request.current = controller
    setSearch({ status: 'loading' })
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12000)])
      const papers = await searchPapers(keywords, signal)
      if (!controller.signal.aborted) setSearch({ status: 'done', papers })
    } catch {
      if (!controller.signal.aborted) setSearch({ status: 'failed' })
    }
  }

  function loadDraft(next: EvidenceDraft, id: string | null = null) {
    setDraft(next)
    setEditing(id)
    setMessage('')
    evidenceTitle.current?.focus()
  }

  function editDraft(fields: Partial<EvidenceDraft>) {
    setDraft(current => ({ ...current, ...fields }))
    setMessage('')
  }

  function saveEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = draft.title.trim()
    const url = evidenceUrl(draft.url)
    if (!title || !url) {
      setMessage('请填写标题和有效的 HTTP 或 HTTPS 链接。')
      return
    }
    if (research.evidence.some(item => item.url === url && item.id !== editing)) {
      setMessage('这个链接已在证据列表中。')
      return
    }

    const entry: Evidence = { ...draft, id: editing ?? crypto.randomUUID(), title, url, comparison: draft.comparison.trim() }
    onChange(current => ({
      ...current,
      evidence: editing
        ? current.evidence.map(item => item.id === editing ? entry : item)
        : [...current.evidence, entry],
    }))
    setDraft(emptyDraft)
    setEditing(null)
    setMessage('证据已保存到当前方案。')
  }

  function removeEvidence(item: Evidence) {
    if (!window.confirm(`移除证据「${item.title}」？`)) return
    onChange(current => ({ ...current, evidence: current.evidence.filter(entry => entry.id !== item.id) }))
    if (editing === item.id) loadDraft(emptyDraft)
    setMessage('证据已移除。')
  }

  return (
    <section className="studio-surface studio-refinement" aria-labelledby="research-heading">
      <div>
        <h2 id="research-heading">原创性检索</h2>
        <p>用关键词查找相近的专利、论文和产品，再记录它们与本方案的相似处和差异。</p>
      </div>
      <form className="studio-research-search" onSubmit={findPapers}>
        <label className="studio-field">
          检索关键词
          <input
            value={research.keywords}
            maxLength={200}
            onChange={event => changeKeywords(event.target.value)}
            placeholder="例如，课间休息 桌面计时器"
          />
        </label>
        <p className="studio-hint">开始搜索时，输入的关键词会发送给对应的检索服务。</p>
        <div className="studio-actions">
          <button type="submit" className="studio-button primary" disabled={!keywords || search.status === 'loading'}>检索论文</button>
          {keywords && (
            <>
              <a className="studio-button" href={`https://patents.google.com/?${query}`} target="_blank" rel="noreferrer">搜索专利</a>
              <a className="studio-button" href={`https://www.google.com/search?${query}`} target="_blank" rel="noreferrer">搜索相近产品</a>
            </>
          )}
        </div>
        <div role="status" className="studio-hint">
          {search.status === 'loading' && '正在通过 Crossref 检索论文…'}
          {search.status === 'failed' && 'Crossref 暂时不可用。可重试，或手动录入已找到的来源。'}
          {search.status === 'done' && (
            search.papers.length
              ? `Crossref 返回 ${search.papers.length} 条结果。请打开原文核对相关性。`
              : 'Crossref 未返回匹配的论文。可换一组关键词继续检索。'
          )}
        </div>
      </form>

      {search.status === 'done' && search.papers.length > 0 && (
        <ul className="studio-evidence-list" aria-label="论文检索结果">
          {search.papers.map(paper => (
            <li key={paper.url}>
              <a href={paper.url} target="_blank" rel="noreferrer">{paper.title}</a>
              <button
                type="button"
                className="studio-button"
                aria-label={`录入论文 ${paper.title}`}
                onClick={() => loadDraft({ ...paper, source: 'paper', comparison: '' })}
              >
                录入证据
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="studio-evidence-form" onSubmit={saveEvidence}>
        <h3>{editing ? '编辑证据' : '录入证据'}</h3>
        <label className="studio-field">
          来源类型
          <select value={draft.source} onChange={event => editDraft({ source: event.target.value as EvidenceSource })}>
            {Object.entries(evidenceSources).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="studio-field">
          证据标题
          <input ref={evidenceTitle} value={draft.title} maxLength={500} required onChange={event => editDraft({ title: event.target.value })} />
        </label>
        <label className="studio-field">
          来源链接
          <input type="url" value={draft.url} maxLength={2000} required onChange={event => editDraft({ url: event.target.value })} placeholder="https://…" />
        </label>
        <label className="studio-field">
          相似与差异
          <textarea rows={3} value={draft.comparison} maxLength={3000} onChange={event => editDraft({ comparison: event.target.value })} />
        </label>
        <div className="studio-actions">
          <button type="submit" className="studio-button primary">保存证据</button>
          {editing && <button type="button" className="studio-button" onClick={() => loadDraft(emptyDraft)}>取消编辑</button>}
          <span className="studio-hint" role="status">{message}</span>
        </div>
      </form>

      <div>
        <h3>已保存证据 · {research.evidence.length}</h3>
        {research.evidence.length ? (
          <ul className="studio-evidence-list">
            {research.evidence.map(item => (
              <li key={item.id}>
                <div>
                  <span className="studio-badge">{evidenceSources[item.source]}</span>{' '}
                  <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
                  {item.comparison && <p>{item.comparison}</p>}
                </div>
                <div className="studio-actions">
                  <button type="button" className="studio-button" onClick={() => loadDraft(item, item.id)}>编辑</button>
                  <button type="button" className="studio-button" onClick={() => removeEvidence(item)}>移除</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p>还没有记录证据。</p>}
        <p className="studio-hint">检索范围以已保存的来源为准。</p>
      </div>
    </section>
  )
}
