
import { useEffect, useRef, useState } from 'react'
import type { Concept, ConceptBatch } from './concepts'
import { developmentOf } from './conceptDevelopment'
import {
  generateConceptImage,
  imageSizes,
  supportsImageReference,
} from './imageGeneration'
import type { ImageSettings } from './imageGeneration'
import type { ModelSettings } from './modelGeneration'
import { translateVisualWithAI } from './visualPromptAI'
import { getVisual, putVisual } from './visualStore'
import type { SavedVisual } from './visualStore'
import { downloadBlob } from './conceptBoard'

type GenerateMode = 'concept' | 'board'
type OutputSize = 'landscape' | 'portrait' | 'square'

type Props = {
  projectId: string
  roundNumber: number
  frozenId?: string
  concept: Concept
  round: ConceptBatch
  settings: ImageSettings
  textSettings?: ModelSettings
  masterBlob?: Blob
}

type SizeConfig = {
  width: number
  height: number
  apiSize: typeof imageSizes[number]
}

const MAX_JPG_BYTES = 5 * 1024 * 1024

const sizes: Record<OutputSize, SizeConfig> = {
  landscape: {
    width: 4750,
    height: 3167,
    apiSize: '1536x1024',
  },
  portrait: {
    width: 3167,
    height: 4750,
    apiSize: '1024x1536',
  },
  square: {
    width: 1024,
    height: 1024,
    apiSize: '1024x1024',
  },
}

function recordKey(
  projectId: string,
  roundNumber: number,
  conceptId: string,
  frozenId: string | undefined,
  mode: GenerateMode,
  size: OutputSize,
) {
  return JSON.stringify([
    'simple-visual-v022',
    projectId,
    roundNumber,
    conceptId,
    frozenId ?? 'unfrozen',
    mode,
    size,
  ])
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () =>
      reject(new Error('无法读取产品母版图片。'))

    reader.readAsDataURL(blob)
  })
}

async function exportJpeg(
  source: Blob,
  width: number,
  height: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(source)

  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('浏览器无法创建图片画布。')
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    const scale = Math.max(
      width / bitmap.width,
      height / bitmap.height,
    )

    const drawWidth = bitmap.width * scale
    const drawHeight = bitmap.height * scale

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    ctx.drawImage(
      bitmap,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    )

    const qualities = [
      0.92, 0.85, 0.75, 0.65, 0.5, 0.35, 0.2,
    ]

    for (const quality of qualities) {
      const result = await new Promise<Blob>(
        (resolve, reject) => {
          canvas.toBlob(
            blob => {
              if (blob) resolve(blob)
              else reject(new Error('JPG 编码失败。'))
            },
            'image/jpeg',
            quality,
          )
        },
      )

      if (result.size <= MAX_JPG_BYTES) {
        return result
      }
    }

    throw new Error(
      '无法将目标尺寸图片压缩到 5 MB 以下。',
    )
  } finally {
    bitmap.close()
  }
}

function SavedImagePreview({
  blob,
}: {
  blob: Blob
}) {
  const [url] = useState(() =>
    URL.createObjectURL(blob),
  )

  useEffect(() => {
    return () => URL.revokeObjectURL(url)
  }, [url])

  return (
    <figure className="simple-visual-preview">
      <img
        src={url}
        alt="AI 生成的产品设计图"
        style={{
          maxWidth: '100%',
          height: 'auto',
          display: 'block',
        }}
      />
      <figcaption>
        图片已保存到当前浏览器，
        尚未通过高级模式审核。
      </figcaption>
    </figure>
  )
}

export function SimpleVisualGenerator({
  projectId,
  roundNumber,
  frozenId,
  concept,
  round,
  settings,
  textSettings,
  masterBlob,
}: Props) {
  const [mode, setMode] =
    useState<GenerateMode>('board')

  const [size, setSize] =
    useState<OutputSize>('landscape')

  const [extra, setExtra] = useState('')
  const [busy, setBusy] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [record, setRecord] =
    useState<SavedVisual>()

  const [translationStatus, setTranslationStatus] =
    useState('')

  const [translatedPrompt, setTranslatedPrompt] =
    useState('')

  const controllerRef =
    useRef<AbortController | null>(null)

  const mountedRef = useRef(true)
  const requestRef = useRef(0)

  const id = recordKey(
    projectId,
    roundNumber,
    concept.id,
    frozenId,
    mode,
    size,
  )

  const target = sizes[size]

  const currentFrozen =
    developmentOf(concept).frozen

  const validFrozen =
    currentFrozen &&
    currentFrozen.id === frozenId
      ? currentFrozen
      : undefined

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      controllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    let active = true
    const requestId = ++requestRef.current

    getVisual(id)
      .then(saved => {
        if (
          !active ||
          requestId !== requestRef.current
        ) return

        setRecord(saved)
        setError('')
      })
      .catch(() => {
        if (
          !active ||
          requestId !== requestRef.current
        ) return

        setRecord(undefined)
        setError('读取本地图片记录失败。')
      })
      .finally(() => {
        if (
          active &&
          requestId === requestRef.current
        ) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [id])

  async function generate() {
    if (busy || loading) return

    if (!validFrozen) {
      setError(
        '请先完成概念人工确认和 Concept Freeze。',
      )
      return
    }

    if (!textSettings) {
      setError(
        '尚未接入语言模型配置 textSettings。请在 VisualStudio 中传入已配置的文本模型。',
      )
      return
    }

    if (
      !textSettings.apiKey.trim() ||
      !textSettings.baseUrl.trim() ||
      !textSettings.model.trim()
    ) {
      setError('请先在 AI 模型中心配置视觉提示词生成模型。')
      return
    }

    if (
      !settings.apiKey.trim() ||
      !settings.baseUrl.trim() ||
      !settings.model.trim()
    ) {
      setError('请先配置 AI 图像模型。')
      return
    }

    const referenceSupported =
      supportsImageReference(settings)

    if (referenceSupported && !masterBlob) {
      setError(
        '当前图像编辑模型需要已审核的产品母版。请先在高级模式完成母版审核。',
      )
      return
    }

    const controller = new AbortController()
    controllerRef.current = controller

    setBusy(true)
    setError('')
    setTranslationStatus('正在转译冻结概念...')
    setTranslatedPrompt('')

    try {
      const translation =
        await translateVisualWithAI(
          validFrozen,
          mode,
          target.width,
          target.height,
          textSettings,
          controller.signal,
        )

      if (controller.signal.aborted) return

      if (translation.frozenId !== validFrozen.id) {
        throw new Error(
          'AI 转译版本与当前冻结版本不一致。',
        )
      }

      const prompt = [
        translation.prompt,
        '',
        'PRESENTATION PREFERENCES:',
        extra.trim(),
        '',
        `Target aspect ratio: ${target.width}:${target.height}.`,
        referenceSupported
          ? [
              'REFERENCE IMAGE:',
              'Preserve the exact approved product',
              'geometry, structure, colors, materials',
              'and proportions.',
              'Do not redesign the reference product.',
            ].join(' ')
          : '',
      ]
        .filter(Boolean)
        .join('\n')

      if (mountedRef.current) {
        setTranslatedPrompt(prompt)
        setTranslationStatus(
          'AI 转译完成，正在生成产品图片...',
        )
      }

      const reference = referenceSupported
        ? await blobToDataURL(masterBlob!)
        : undefined

      if (controller.signal.aborted) return

      const blob = await generateConceptImage(
        {
          ...settings,
          size: target.apiSize,
        },
        prompt,
        controller.signal,
        referenceSupported
          ? {
              reference,
              purpose: 'landscape',
            }
          : {
              purpose: 'master',
            },
      )

      if (controller.signal.aborted) return

      if (mountedRef.current) {
        setTranslationStatus(
          '图片生成完成，正在保存...',
        )
      }

      const digestBytes = await crypto.subtle.digest(
        'SHA-256',
        await blob.arrayBuffer(),
      )

      const digest = Array.from(
        new Uint8Array(digestBytes),
        byte => byte.toString(16).padStart(2, '0'),
      ).join('')

      const saved: SavedVisual = {
        id,
        projectId,
        blob,
        source: {
          kind: 'model',
          model: settings.model.trim(),
          provider: new URL(
            settings.baseUrl,
          ).hostname,
        },
        prompt,
        frozenId: validFrozen.id,
        digest,
      }

      await putVisual(saved, controller.signal)

      if (
        mountedRef.current &&
        !controller.signal.aborted
      ) {
        setRecord(saved)
        setTranslationStatus(
          'AI 转译、图片生成和本地保存已完成。',
        )
      }
    } catch (cause) {
      if (
        !controller.signal.aborted &&
        mountedRef.current
      ) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'AI 转译或图片生成失败。',
        )
        setTranslationStatus('')
      }
    } finally {
      if (mountedRef.current) {
        setBusy(false)
      }

      if (controllerRef.current === controller) {
        controllerRef.current = null
      }
    }
  }

  async function exportImage() {
    if (!record || exportBusy) return

    setExportBusy(true)
    setError('')

    try {
      const jpg = await exportJpeg(
        record.blob,
        target.width,
        target.height,
      )

      downloadBlob(
        jpg,
        `INNO-LIT-${mode}-${target.width}x${target.height}.jpg`,
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '图片导出失败。',
      )
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <section className="simple-visual">
      <h2>AI 视觉生成 · V0.2.3</h2>

      <p>
        根据冻结概念自动转译生图语言，
        然后生成产品效果图或设计展板。
      </p>

      <div className="studio-surface">
        <h3>概念状态</h3>

        <p>
          {validFrozen
            ? `已冻结 · V${validFrozen.revision}`
            : '尚未冻结当前概念'}
        </p>

        {validFrozen && (
          <p className="studio-hint">
            冻结编号：{validFrozen.id}
          </p>
        )}
      </div>

      <label className="studio-field">
        生成内容
        <select
          disabled={busy || exportBusy}
          value={mode}
          onChange={event => {
            setLoading(true)
            setRecord(undefined)
            setTranslatedPrompt('')
            setTranslationStatus('')
            setMode(
              event.target.value as GenerateMode,
            )
          }}
        >
          <option value="board">
            设计展板
          </option>
          <option value="concept">
            产品概念图
          </option>
        </select>
      </label>

      <label className="studio-field">
        图像模型
        <input
          value={settings.model || '未配置'}
          readOnly
        />
      </label>

      <label className="studio-field">
        语言转译模型
        <input
          value={
            textSettings?.model ||
            '尚未配置视觉提示词生成模型'
          }
          readOnly
        />
      </label>

      <label className="studio-field">
        输出尺寸
        <select
          disabled={busy || exportBusy}
          value={size}
          onChange={event => {
            setLoading(true)
            setRecord(undefined)
            setTranslatedPrompt('')
            setTranslationStatus('')
            setSize(
              event.target.value as OutputSize,
            )
          }}
        >
          <option value="landscape">
            横版 4750 × 3167
          </option>
          <option value="portrait">
            竖版 3167 × 4750
          </option>
          <option value="square">
            正方形 1024 × 1024
          </option>
        </select>
      </label>

      <label className="studio-field">
        补充展示要求（可选）
        <textarea
          disabled={busy}
          value={extra}
          onChange={event =>
            setExtra(event.target.value)
          }
          placeholder="例如：简洁背景、突出产品主体、展示交互过程。不得修改冻结产品定义。"
          rows={3}
        />
      </label>

      <div className="studio-actions">
        <button
          type="button"
          className="studio-button primary"
          disabled={
            busy ||
            loading ||
            !validFrozen ||
            !textSettings
          }
          onClick={generate}
        >
          {busy
            ? 'AI 正在处理...'
            : 'AI 转译并一键生图'}
        </button>

        {busy && (
          <button
            type="button"
            className="studio-button"
            onClick={() =>
              controllerRef.current?.abort()
            }
          >
            取消生成
          </button>
        )}

        <button
          type="button"
          className="studio-button"
          disabled={
            !record ||
            busy ||
            loading ||
            exportBusy
          }
          onClick={exportImage}
        >
          {exportBusy
            ? '正在导出...'
            : '导出 JPG'}
        </button>
      </div>

      {translationStatus && (
        <p role="status">
          {translationStatus}
        </p>
      )}

      {error && (
        <p role="alert">{error}</p>
      )}

      {loading && (
        <p>正在读取本地图片记录...</p>
      )}

      {record && !loading && (
        <SavedImagePreview
          key={`${id}:${record.digest ?? ''}`}
          blob={record.blob}
        />
      )}

      {translatedPrompt && (
        <details>
          <summary>
            查看 AI 自动转译的生图提示词
          </summary>

          <textarea
            readOnly
            rows={16}
            value={translatedPrompt}
            style={{
              width: '100%',
              marginTop: '12px',
              fontSize: '15px',
              lineHeight: 1.6,
            }}
          />
        </details>
      )}

      <p className="studio-hint">
        图片保存在当前浏览器的 IndexedDB 中。
        JPG 导出尺寸为所选像素尺寸，
        最大 5 MB。大尺寸输出采用浏览器重采样，
        并非 AI 原生高清生成。
        图片仍需经过高级模式审核。
      </p>

      <p className="studio-hint">
        当前设计简报：
        {round.brief.problem}
      </p>
    </section>
  )
}
