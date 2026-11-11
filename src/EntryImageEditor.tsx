import { useEffect, useRef, useState } from 'react'
import type { FrozenConcept } from './conceptDevelopment'
import { canvasBlob, downloadBlob } from './conceptBoard'
import { entryBoardGeometry, posterSceneShare, renderEntryBoard } from './entryBoards'
import { consistencyChecks, entryImagePrompt, entryPurpose, entryRoles, visualProblems } from './entryVisuals'
import type { EntryRole, VisualApproval } from './entryVisuals'
import { generateConceptImage, imageByteLimit, imageMime, supportsImageReference } from './imageGeneration'
import type { ImageSettings, VisualSource } from './imageGeneration'
import { hasModelSettings } from './modelGeneration'
import { putVisual } from './visualStore'
import type { SavedVisual } from './visualStore'
import { useModelTask } from './useModelTask'

const checkKeys = Object.keys(consistencyChecks) as (keyof typeof consistencyChecks)[]

function useVisualImage(visual: SavedVisual | undefined) {
  const [image, setImage] = useState<{ bitmap: ImageBitmap; url: string; blob: Blob }>()
  const [error, setError] = useState('')
  const blob = visual?.blob
  useEffect(() => {
    if (!blob) return
    let active = true
    const url = URL.createObjectURL(blob)
    createImageBitmap(blob).then(bitmap => {
      if (active) { setImage({ bitmap, url, blob }); setError('') }
      else { bitmap.close(); URL.revokeObjectURL(url) }
    }).catch(() => { URL.revokeObjectURL(url); if (active) setError('图片无法解码，请重新上传。') })
    return () => { active = false }
  }, [blob])
  useEffect(() => () => { image?.bitmap.close(); if (image) URL.revokeObjectURL(image.url) }, [image])
  return { image, error }
}

async function referenceData(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('无法读取产品母版。'))
    reader.readAsDataURL(blob)
  })
}

function ReviewImage({ frozen, record, master, role, locked, pending, onApprove, onEdit }: {
  frozen: FrozenConcept; record: SavedVisual; master?: SavedVisual; role: EntryRole; locked: boolean; pending: boolean
  onApprove: (approval: VisualApproval) => void
  onEdit: () => void
}) {
  const [checks, setChecks] = useState<Record<keyof typeof consistencyChecks, boolean>>(() => record.approval?.checks ?? Object.fromEntries(checkKeys.map(key => [key, false])) as Record<keyof typeof consistencyChecks, boolean>)
  const [composition, setComposition] = useState(record.approval?.composition ?? '')
  const [scene, setScene] = useState(record.approval?.scene ?? false)
  const ready = checkKeys.every(key => checks[key]) && (role === 'master' || composition.trim()) && (role !== 'poster' || frozen.sceneException || scene)
  return <fieldset className="development-fields studio-refinement" disabled={locked || pending}>
    <h3>人工一致性审核</h3>
    <p className="studio-hint">将候选图与冻结规范及母版逐项比较。不一致就重新制作；参考图编辑本身不能保证完全一致。</p>
    <div className="visual-checks">{checkKeys.map(key => <label key={key} className="studio-choice"><input type="checkbox" checked={checks[key]} onChange={event => { onEdit(); setChecks(current => ({ ...current, [key]: event.target.checked })) }} />
      {consistencyChecks[key]}一致
    </label>)}</div>
    {role !== 'master' && <label className="studio-field">独立构图与信息职责审核
      <textarea rows={3} maxLength={1500} value={composition} placeholder="说明此图如何承担本入口的职责，以及与另外两图的构图区别。" onChange={event => { onEdit(); setComposition(event.target.value) }} />
    </label>}
    {role === 'poster' && !frozen.sceneException && <label className="studio-choice"><input type="checkbox" checked={scene} onChange={event => { onEdit(); setScene(event.target.checked) }} />主图体现人、产品、关键动作与真实使用环境，第一视觉不是结构图、爆炸图或机制图。</label>}
    <p className="studio-hint">{ready ? '审核项已填写完整，请保存。' : '可以保存未通过的审核记录；有未通过项时禁止导出。'}</p>
    <button type="button" className="studio-button primary" onClick={() => onApprove({ checks, composition: composition.trim(), scene, at: Date.now(), digest: record.digest!, masterDigest: role === 'master' ? record.digest! : master?.digest ?? '' })}>保存人工审核</button>
  </fieldset>
}

export function EntryImageEditor({ frozen, projectId, id, role, record, master, records, settings, direction, locked, onDirection, onSaved, onBusy }: {
  frozen: FrozenConcept; projectId: string; id: string; role: EntryRole; record?: SavedVisual; master?: SavedVisual
  records: Partial<Record<EntryRole, SavedVisual>>; settings: ImageSettings; direction: string; locked: boolean
  onDirection: (value: string) => void; onSaved: (visual: SavedVisual) => void
  onBusy: (busy: boolean) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const { pending, notice, run, cancel } = useModelTask()
  const { image, error } = useVisualImage(record)
  const { image: reference } = useVisualImage(role === 'master' ? undefined : master)
  const [exportError, setExportError] = useState('')
  const [reviewDirty, setReviewDirty] = useState(false)
  const problems = visualProblems(frozen, role, record, master, records)
  const masterReady = master && !visualProblems(frozen, 'master', master, master, records).length
  const prompt = entryImagePrompt(frozen, role, direction)
  const canGenerate = hasModelSettings(settings) && (role === 'master' ? !supportsImageReference(settings) : masterReady && supportsImageReference(settings))

  async function perform<T>(task: (signal: AbortSignal) => Promise<T>, apply: (value: T) => void, success: string) {
    onBusy(true)
    try { await run(task, apply, success) } finally { onBusy(false) }
  }

  useEffect(() => {
    if (role === 'master' || !canvas.current) return
    renderEntryBoard(canvas.current, frozen, role, image?.bitmap, record?.source)
  }, [frozen, role, image, record?.source])

  async function saveCandidate(blob: Blob, source: VisualSource, signal: AbortSignal) {
    const mime = imageMime(new Uint8Array(await blob.slice(0, 12).arrayBuffer()))
    if (!mime || blob.size > imageByteLimit) throw new Error('请使用 8 MB 以内的 PNG、JPEG 或 WebP 图片。')
    const decoded = await createImageBitmap(blob).catch(() => { throw new Error('图片内容无法读取。') })
    const oversized = decoded.width > 8192 || decoded.height > 8192
    decoded.close()
    if (oversized) throw new Error('图片边长不能超过 8192 像素。')
    if (role !== 'master' && !masterReady) throw new Error('请先审核通过产品母版。')
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('')
    signal.throwIfAborted()
    return putVisual({ id, projectId, blob: new Blob([blob], { type: mime }), source, prompt, frozenId: frozen.id, role, digest, masterDigest: role === 'master' ? digest : master?.digest }, signal)
  }

  async function exportBoard() {
    setExportError('')
    if (role === 'master' || !canvas.current || problems.length || reviewDirty || !image || image.blob !== record?.blob) return
    try { downloadBlob(await canvasBlob(canvas.current), `INNO-LIT-V${frozen.revision}-${entryRoles[role]}.png`) }
    catch { setExportError('展板导出失败，请重试。') }
  }

  return <div className="studio-refinement">
    <h3>{entryRoles[role]}</h3><p>{entryPurpose[role]}</p>
    {role === 'poster' && <p className="studio-badge">{frozen.sceneException ? `已冻结的场景表达例外：${frozen.sceneException}` : `使用场景主图占版面 ${(posterSceneShare() * 100).toFixed(1)}%，不使用图解作为第一视觉中心`}</p>}
    {role !== 'master' && reference && <figure className="visual-reference"><img src={reference.url} alt="当前冻结版本的产品母版参考" /><figcaption>唯一产品母版 · V{frozen.revision}</figcaption></figure>}
    <label className="studio-field">本入口构图补充（不能更改冻结产品）<textarea rows={3} maxLength={1000} disabled={locked || pending} value={direction} onChange={event => onDirection(event.target.value)} /></label>
    <details><summary>查看完整生图约束</summary><p className="visual-prompt-text">{prompt}</p></details>
    {role === 'master' && supportsImageReference(settings) && <p className="studio-hint">当前选择的是参考图编辑模型。产品母版请使用 Kolors 等文生图模型，或上传已有的产品母版。</p>}
    {role !== 'master' && !supportsImageReference(settings) && <p className="studio-hint">Kolors 可生成产品母版。延展三图需改用 SiliconFlow 的 Qwen Image Edit 参考图编辑接口，或上传同一产品的不同场景与交互图。当前模型不会进行无参考的独立重画。</p>}
    <div className="studio-actions">
      <button type="button" className="studio-button primary" disabled={locked || pending || !canGenerate} onClick={() => {
        void perform(async signal => {
          const reference = role === 'master' ? undefined : await referenceData(master!.blob)
          const blob = await generateConceptImage(settings, prompt, signal, { purpose: role, ...(reference ? { reference } : {}) })
          return saveCandidate(blob, { kind: 'model', model: settings.model.trim(), provider: new URL(settings.baseUrl).hostname }, signal)
        }, visual => { setReviewDirty(false); onSaved(visual) }, '候选图已保存，请逐项审核产品一致性。')
      }}>{role === 'master' ? '生成产品母版候选' : '参考母版生成本入口候选'}</button>
      <label className="studio-button visual-upload">上传本入口独立图片<input aria-label="上传本入口独立图片" type="file" accept="image/png,image/jpeg,image/webp" disabled={locked || pending || role !== 'master' && !masterReady} onChange={event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
        void perform(signal => saveCandidate(file, { kind: 'upload' }, signal), visual => { setReviewDirty(false); onSaved(visual) }, '候选图已保存，请逐项审核。')
      }} /></label>
      {pending && <button type="button" className="studio-button" onClick={cancel}>取消图片处理</button>}
    </div>
    <p role="status" className="studio-hint">{error || exportError || notice}</p>
    {image && <figure className="visual-image"><img src={image.url} alt={`${entryRoles[role]}候选图`} /><figcaption>{record?.source.kind === 'model' ? `AI 生成 · ${record.source.model}` : '用户提供图片'} · {problems.length ? '待审核' : '审核通过'}</figcaption></figure>}
    {record && <ReviewImage key={`${record.digest}:${record.approval?.at ?? 0}`} frozen={frozen} record={record} master={master} role={role} locked={locked} pending={pending} onEdit={() => setReviewDirty(true)} onApprove={approval => {
      void perform(signal => putVisual({ ...record, approval }, signal), visual => { setReviewDirty(false); onSaved(visual) }, '人工审核已保存。')
    }} />}
    <ul className="studio-hint">{problems.map(problem => <li key={problem}>{problem}</li>)}</ul>
    {role !== 'master' && <>
      <div className="studio-report-header"><p>{entryBoardGeometry[role].size.join(' × ')} PNG · 固定标题、字体和版本</p>
        <button type="button" className="studio-button primary" disabled={pending || reviewDirty || problems.length > 0 || image?.blob !== record?.blob || !image} onClick={() => { void exportBoard() }}>导出本入口 PNG</button>
      </div>
      <canvas className="visual-board" ref={canvas} role="img" aria-label={`${entryRoles[role]} · 冻结 V${frozen.revision}`} />
    </>}
  </div>
}
