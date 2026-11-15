import { useEffect, useRef, useState } from 'react'
import { canvasBlob, downloadBlob } from './conceptBoard'
import { pageSizeProblem, visualPages } from './conceptVisuals'
import { renderVisualPage } from './visualIllustration'
import type { VisualPageRole, VisualPageSettings, VisualSubject } from './visualStudioTypes'
import type { SavedVisual } from './visualTypes'

export function VisualThumbnail({ record }: { record?: SavedVisual }) {
  const [url, setUrl] = useState('')
  const blob = record?.blob
  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    // Synchronize the preview URL with the stored image resource.
    // oxlint-disable-next-line react/set-state-in-effect
    setUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [blob])
  return url ? <img src={url} alt="" /> : <span className="visual-empty-thumb" aria-hidden="true">✦</span>
}

export function VisualPagePreview({ subject, role, page, record, pending }: {
  subject: VisualSubject; role: VisualPageRole; page: VisualPageSettings; record?: SavedVisual; pending: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [picture, setPicture] = useState<{ bitmap: ImageBitmap; blob: Blob }>()
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const blob = record?.source.kind === 'local' ? undefined : record?.blob
  const sizeProblem = pageSizeProblem(page)
  useEffect(() => {
    if (!blob) return
    let active = true
    createImageBitmap(blob).then(bitmap => {
      if (active) { setPicture({ bitmap, blob }); setError('') } else bitmap.close()
    }).catch(() => { if (active) setError('图片无法读取，请重新生成或上传。') })
    return () => { active = false }
  }, [blob])
  useEffect(() => () => picture?.bitmap.close(), [picture])
  useEffect(() => {
    if (!canvas.current || sizeProblem) return
    renderVisualPage(canvas.current, subject, role, page, picture?.bitmap, blob ? record?.source : { kind: 'local' })
  }, [subject, role, page, picture, record?.source, blob, sizeProblem])

  return <div className="studio-refinement">
    {sizeProblem || error ? <p role="alert" className="studio-hint">{sizeProblem || error}</p> : null}
    <div className="studio-report-header">
      <p className="studio-hint">{record?.source.kind === 'model' ? `AI 图片 · ${record.source.model}` : record?.source.kind === 'upload' ? '用户上传图片' : '本地概念示意 · 非 AI'} · {page.width} × {page.height} px</p>
      <div className="studio-actions">
        {blob && <button type="button" className="studio-button" disabled={pending} onClick={() => downloadBlob(blob, 'INNO-LIT-原图.' + (blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'))}>下载原图</button>}
        <button type="button" className="studio-button primary" disabled={pending || exporting || Boolean(sizeProblem) || Boolean(blob && picture?.blob !== blob)} onClick={() => {
          if (!canvas.current) return
          setError('')
          setExporting(true)
          void canvasBlob(canvas.current).then(result => downloadBlob(result, `INNO-LIT-${visualPages[role]}-${page.width}x${page.height}.png`))
            .catch(() => setError('导出失败，请重试。')).finally(() => setExporting(false))
        }}>{exporting ? '正在导出…' : '导出 PNG'}</button>
      </div>
    </div>
    <canvas ref={canvas} className="visual-board" role="img" aria-label={`${visualPages[role]}预览`} />
  </div>
}
