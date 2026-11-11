import { useEffect, useRef, useState } from 'react'
import { canvasBlob, downloadBlob, renderConceptBoard } from './conceptBoard'
import type { BoardData } from './conceptBoard'
import { defaultImagePrompt, generateConceptImage, imageByteLimit, imageMime, imageSizes } from './imageGeneration'
import type { ImageSettings, VisualLayout, VisualSource } from './imageGeneration'
import { canUseCustomModel, hasModelSettings } from './modelGeneration'
import { getVisual, putVisual, visualKey } from './visualStore'
import type { SavedVisual } from './visualStore'
import type { Concept } from './concepts'
import { useModelTask } from './useModelTask'
import './VisualStudio.css'

type VisualProps = Omit<BoardData, 'image' | 'imageSource'> & {
  projectId: string
  imageSettings: ImageSettings
  onImageSettingsChange: (change: Partial<ImageSettings>) => void
  onChange: (update: (current: Concept) => Concept) => void
}

const layouts: Record<VisualLayout, string> = { diagram: '概念结构图', landscape: '横版展板', portrait: '竖版展板' }

export function VisualStudio(props: VisualProps) {
  const { projectId, projectName, concept, round, roundNumber, imageSettings, onImageSettingsChange, onChange } = props
  const id = visualKey(projectId, roundNumber, concept.id)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [visual, setVisual] = useState<SavedVisual>()
  const [loadedImage, setLoadedImage] = useState<{ bitmap: ImageBitmap; url: string; visual: SavedVisual }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const { pending, notice, run, cancel } = useModelTask()
  const layout = concept.visualLayout ?? 'landscape'
  const prompt = concept.visualPrompt ?? defaultImagePrompt(round, concept)
  const decoding = Boolean(layout !== 'diagram' && visual && loadedImage?.visual !== visual)

  useEffect(() => {
    let active = true
    getVisual(id).then(result => {
      if (active) { setVisual(result); setLoading(false) }
    }).catch(() => {
      if (active) { setError('当前浏览器无法读取已保存的概念图。'); setLoading(false) }
    })
    return () => { active = false }
  }, [id])

  useEffect(() => {
    if (!visual) return
    let active = true
    const url = URL.createObjectURL(visual.blob)
    createImageBitmap(visual.blob).then(result => {
      if (active) setLoadedImage({ bitmap: result, url, visual })
      else { result.close(); URL.revokeObjectURL(url) }
    }).catch(() => {
      URL.revokeObjectURL(url)
      if (active) setError('这张图片无法显示。可上传或生成另一张。')
    })
    return () => { active = false }
  }, [visual])

  useEffect(() => () => {
    loadedImage?.bitmap.close()
    if (loadedImage) URL.revokeObjectURL(loadedImage.url)
  }, [loadedImage])

  useEffect(() => {
    if (!canvas.current) return
    try {
      renderConceptBoard(canvas.current, { projectName, roundNumber, round, concept, image: loadedImage?.bitmap, imageSource: loadedImage?.visual.source }, layout)
    } catch {
      // Report a failure while synchronizing the external canvas.
      // oxlint-disable-next-line react/set-state-in-effect
      setError('当前浏览器无法预览展板。')
    }
  }, [projectName, roundNumber, round, concept, loadedImage, layout])

  async function saveImage(blob: Blob, source: VisualSource, signal: AbortSignal) {
    const mime = imageMime(new Uint8Array(await blob.slice(0, 12).arrayBuffer()))
    if (blob.size > imageByteLimit || !mime) {
      throw new Error('请使用 8 MB 以内的 PNG、JPEG 或 WebP 图片。')
    }
    const decoded = await createImageBitmap(blob).catch(() => { throw new Error('图片内容无法读取。') })
    const oversized = decoded.width > 8192 || decoded.height > 8192
    decoded.close()
    if (oversized) throw new Error('请使用边长不超过 8192 像素的图片。')
    signal.throwIfAborted()
    return putVisual({ id, projectId, blob: new Blob([blob], { type: mime }), source, prompt }, signal)
  }

  async function download() {
    if (!canvas.current || exporting) return
    setExporting(true)
    setError('')
    try {
      downloadBlob(await canvasBlob(canvas.current), `INNO-LIT-第${roundNumber}轮-${layouts[layout]}.png`)
    } catch {
      setError('展板导出失败。请重试。')
    } finally { setExporting(false) }
  }

  function generate() {
    setError('')
    void run(async signal => {
      const blob = await generateConceptImage(imageSettings, prompt, signal)
      return saveImage(blob, {
        kind: 'model', model: imageSettings.model.trim(), provider: new URL(imageSettings.baseUrl).hostname,
      }, signal)
    }, setVisual, '概念图已保存，可切换排版并导出展板。')
  }

  return (
    <section className="studio-surface studio-refinement visual-studio" aria-labelledby="visual-heading">
      <div>
        <h2 id="visual-heading">概念图与展板</h2>
        <p>把当前方案绘成概念结构图，生成或上传产品效果图，再选择展板排版。</p>
      </div>
      <div className="studio-field">
        <label htmlFor="visual-prompt">图片描述</label>
        <textarea id="visual-prompt" rows={5} maxLength={3000} value={prompt} disabled={pending}
          onChange={event => {
            const visualPrompt = event.target.value
            onChange(current => ({ ...current, visualPrompt }))
          }} />
      </div>
      <details className="visual-api-settings">
        <summary>图片模型 API 设置</summary>
        <p>填写支持生图的模型和密钥。生成时会向该服务发送图片描述，费用按服务商规则计算。</p>
        <div className="studio-validation-fields">
          <label className="studio-field">图片 API 地址
            <input value={imageSettings.baseUrl} maxLength={1000} disabled={pending} placeholder="https://api.siliconflow.cn/v1"
              onChange={event => onImageSettingsChange({ baseUrl: event.target.value })} />
          </label>
          <label className="studio-field">图片模型 ID
            <input value={imageSettings.model} maxLength={200} disabled={pending} placeholder="填写生图模型 ID"
              onChange={event => onImageSettingsChange({ model: event.target.value })} />
          </label>
          <label className="studio-field">图片 API 密钥
            <input type="password" autoComplete="off" value={imageSettings.apiKey} maxLength={2048} disabled={pending}
              onChange={event => onImageSettingsChange({ apiKey: event.target.value })} />
          </label>
          <div className="studio-field"><label htmlFor="visual-protocol">图片接口格式</label>
            <select id="visual-protocol" value={imageSettings.protocol} disabled={pending}
              onChange={event => onImageSettingsChange({ protocol: event.target.value as ImageSettings['protocol'] })}>
              <option value="siliconflow">SiliconFlow</option>
              <option value="images">Images 兼容接口</option>
            </select>
          </div>
          <div className="studio-field"><label htmlFor="visual-size">图片尺寸</label>
            <select id="visual-size" value={imageSettings.size} disabled={pending}
              onChange={event => onImageSettingsChange({ size: event.target.value as ImageSettings['size'] })}>
              {imageSizes.map(size => <option key={size}>{size}</option>)}
            </select>
          </div>
        </div>
        <button type="button" className="studio-button" disabled={pending} onClick={() => onImageSettingsChange({
          baseUrl: 'https://api.siliconflow.cn/v1', model: 'Kwai-Kolors/Kolors', protocol: 'siliconflow', size: '1024x1024',
        })}>填入 SiliconFlow 示例</button>
        <p className="studio-hint">图片设置在当前页面会话中共用，刷新后清除。</p>
      </details>
      <div className="studio-actions">
        <button type="button" className="studio-button primary"
          disabled={loading || pending || !prompt.trim() || !hasModelSettings(imageSettings) || !canUseCustomModel(window.location.hostname)}
          onClick={generate}>{pending ? '正在处理图片…' : '生成产品概念图'}</button>
        <label className="studio-button visual-upload">
          上传概念图
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={loading || pending}
            onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setError('')
              void run(signal => saveImage(file, { kind: 'upload' }, signal), setVisual, '上传的概念图已保存。')
            }} />
        </label>
        {pending && <button type="button" className="studio-button" onClick={cancel}>取消图片处理</button>}
        {visual && <button type="button" className="studio-button" onClick={() => downloadBlob(visual.blob, 'INNO-LIT-产品概念图.' + (visual.blob.type === 'image/jpeg' ? 'jpg' : visual.blob.type === 'image/webp' ? 'webp' : 'png'))}>下载概念图</button>}
      </div>
      <p className="studio-hint" role="status">{error || notice || (loading || decoding ? '正在读取概念图…' : '结构图与展板可直接在本地绘制。')}</p>
      {loadedImage && <figure className="visual-image">
        <img src={loadedImage.url} alt={`${concept.title}的产品概念图`} />
        <figcaption>{loadedImage.visual.source.kind === 'model' ? `AI 生成 · ${loadedImage.visual.source.model}` : '用户上传概念图'}</figcaption>
      </figure>}
      <div className="studio-report-header">
        <div className="studio-field"><label htmlFor="visual-layout">预览与排版</label>
          <select id="visual-layout" value={layout} onChange={event => {
            const visualLayout = event.target.value as VisualLayout
            onChange(current => ({ ...current, visualLayout }))
          }}>
            {Object.entries(layouts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        <button type="button" className="studio-button primary" disabled={loading || decoding || exporting} onClick={download}>
          {exporting ? '正在导出…' : '导出 PNG'}
        </button>
      </div>
      <canvas ref={canvas} className="visual-board" role="img" aria-label={`${concept.title} · ${layouts[layout]}`} />
      <p className="studio-hint">概念图保存在当前浏览器。导出的 PNG 会保留图片来源标注。</p>
    </section>
  )
}
