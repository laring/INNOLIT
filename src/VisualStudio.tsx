
import { useEffect, useState } from 'react'
import { SimpleVisualGenerator } from './SimpleVisualGenerator'
import { ConceptVisualWorkspace } from './ConceptVisualWorkspace'
import { ProductWorkflowStudio } from './ProductWorkflowStudio'
import type { Concept, ConceptBatch } from './concepts'
import { developmentOf } from './conceptDevelopment'
import {
  consistencyChecks,
  entryRoles,
  entryVisualKey,
  visualProblems,
} from './entryVisuals'
import type { EntryRole } from './entryVisuals'
import type { ImageSettings } from './imageGeneration'
import type { ModelSettings } from './modelGeneration'
import { getVisual, visualKey } from './visualStore'
import type { SavedVisual } from './visualStore'
import { downloadBlob } from './conceptBoard'
import { EntryImageEditor } from './EntryImageEditor'
import './VisualStudio.css'

type VisualProps = {
  projectId: string
  projectName: string
  round: ConceptBatch
  roundNumber: number
  concept: Concept
  imageSettings: ImageSettings
  imageConfiguration: string
  modelSettings: ModelSettings
  onChange: (
    update: (current: Concept) => Concept,
  ) => void
}

const roles = Object.keys(entryRoles) as EntryRole[]

function AdvancedVisualStudio({
  projectId,
  round,
  roundNumber,
  concept,
  imageSettings,
  modelSettings,
  onChange,
}: VisualProps) {
  const [simpleMode, setSimpleMode] = useState(true)

  const development = developmentOf(concept)

  const versions = [
    ...(development.frozen ? [development.frozen] : []),
    ...development.history.slice().reverse(),
  ]

  const [selectedVersion, setSelectedVersion] =
    useState(versions[0]?.id ?? '')

  const frozen = versions.find(
    item => item.id === selectedVersion,
  )

  const [role, setRole] = useState<EntryRole>(
    concept.visualEntry ?? 'master',
  )

  const [records, setRecords] = useState<
    Partial<Record<EntryRole, SavedVisual>>
  >({})

  const [legacy, setLegacy] = useState<SavedVisual>()
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [imageBusy, setImageBusy] = useState(false)

  const frozenId = frozen?.id

  useEffect(() => {
    let active = true

    getVisual(
      visualKey(projectId, roundNumber, concept.id),
    )
      .then(item => {
        if (active) setLegacy(item)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [projectId, roundNumber, concept.id])

  useEffect(() => {
    if (!frozenId) return

    let active = true

    Promise.all(
      roles.map(itemRole =>
        getVisual(
          entryVisualKey(
            projectId,
            roundNumber,
            concept.id,
            frozenId,
            itemRole,
          ),
        ),
      ),
    )
      .then(items => {
        if (!active) return

        setRecords(
          Object.fromEntries(
            roles.map((itemRole, index) => [
              itemRole,
              items[index],
            ]),
          ),
        )

        setLoading(false)
        setLoadError('')
      })
      .catch(() => {
        if (!active) return

        setLoadError(
          '图片存储读取失败，请检查浏览器存储权限。',
        )
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [
    projectId,
    roundNumber,
    concept.id,
    frozenId,
  ])

  const locked =
    development.frozen?.id !== frozenId

  const directionKey = `${frozenId}:${role}`

  const complete =
    frozen &&
    (['landscape', 'portrait', 'poster'] as const)
      .every(
        itemRole =>
          !visualProblems(
            frozen,
            itemRole,
            records[itemRole],
            records.master,
            records,
          ).length,
      )

  const masterBlob =
    frozen &&
    records.master &&
    !visualProblems(
      frozen,
      'master',
      records.master,
      records.master,
      records,
    ).length
      ? records.master.blob
      : undefined

  return (
    <section className="studio-surface studio-refinement visual-studio">
      <div className="studio-actions">
        <button
          type="button"
          className="studio-button"
          onClick={() =>
            setSimpleMode(value => !value)
          }
        >
          {simpleMode
            ? '切换高级模式'
            : '返回简洁模式'}
        </button>
      </div>

      {simpleMode && (
        <SimpleVisualGenerator
          projectId={projectId}
          roundNumber={roundNumber}
          frozenId={frozen?.id}
          concept={concept}
          round={round}
          settings={imageSettings}
          textSettings={modelSettings}
          masterBlob={masterBlob}
        />
      )}

      {!simpleMode && (
        <>
          <h2>
            概念图与展板 · 同一冻结产品的三个信息入口
          </h2>

          <p>
            母版统一产品设计，三张图分别承担
            WHY / WHAT、HOW 和完整设计叙事。
            独立构图，逐项审核后才能导出。
          </p>

          {legacy && (
            <p className="studio-hint">
              旧版概念图仍保留。
              <button
                type="button"
                className="studio-button"
                onClick={() =>
                  downloadBlob(
                    legacy.blob,
                    'INNO-LIT-旧版概念图.' +
                      (
                        legacy.blob.type === 'image/jpeg'
                          ? 'jpg'
                          : legacy.blob.type === 'image/webp'
                            ? 'webp'
                            : 'png'
                      ),
                  )
                }
              >
                下载旧图留存
              </button>
            </p>
          )}

          {!frozen ? (
            <p>
              请先在「完善与冻结」完成 AI 深化、
              人工确认和概念冻结。
            </p>
          ) : (
            <>
              <label className="studio-field">
                展示版本
                <select
                  disabled={imageBusy}
                  value={selectedVersion}
                  onChange={event => {
                    setSelectedVersion(event.target.value)
                    setRecords({})
                    setLoading(true)
                  }}
                >
                  {versions.map(item => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      V{item.revision} · {item.design.title}
                      {development.frozen?.id === item.id
                        ? '（当前冻结版）'
                        : '（历史只读）'}
                    </option>
                  ))}
                </select>
              </label>

              <p className="studio-badge">
                {complete
                  ? '三张入口均已审核完成'
                  : '展示制作进行中'}
                {' · '}
                冻结 V{frozen.revision}
                {' · '}
                {frozen.id}
              </p>

              <details>
                <summary>固定产品规范</summary>
                <dl>
                  {Object.entries(consistencyChecks).map(
                    ([key, label]) => (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd>
                          {
                            frozen.identity[
                              key as keyof typeof frozen.identity
                            ]
                          }
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </details>
              <p className="studio-hint">图像生成模型：{imageSettings.model || "未配置"}。请在「深化 AI 模型设置」统一管理。</p>

              <nav
                className="studio-refinement-nav"
                aria-label="展示入口"
              >
                {roles.map(itemRole => (
                  <button
                    type="button"
                    key={itemRole}
                    disabled={imageBusy}
                    className="studio-button"
                    aria-pressed={role === itemRole}
                    onClick={() => {
                      setRole(itemRole)
                      onChange(current => ({
                        ...current,
                        visualEntry: itemRole,
                      }))
                    }}
                  >
                    {entryRoles[itemRole]}
                  </button>
                ))}
              </nav>

              {loadError ? (
                <p role="alert">{loadError}</p>
              ) : loading ? (
                <p>
                  正在读取当前冻结版本的图片…
                </p>
              ) : (
                <EntryImageEditor
                  key={`${frozen.id}:${role}`}
                  frozen={frozen}
                  projectId={projectId}
                  id={entryVisualKey(
                    projectId,
                    roundNumber,
                    concept.id,
                    frozen.id,
                    role,
                  )}
                  role={role}
                  record={records[role]}
                  master={records.master}
                  records={records}
                  settings={imageSettings}
                  direction={
                    concept.visualDirections?.[
                      directionKey
                    ] ?? ''
                  }
                  locked={locked}
                  onDirection={value =>
                    onChange(current => ({
                      ...current,
                      visualDirections: {
                        ...current.visualDirections,
                        [directionKey]: value,
                      },
                    }))
                  }
                  onSaved={visual =>
                    setRecords(current => ({
                      ...current,
                      [role]: visual,
                    }))
                  }
                  onBusy={setImageBusy}
                />
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}

export function VisualStudio(props: VisualProps) {
  const [mode, setMode] = useState<'workflow' | 'layout' | 'advanced'>('workflow')
  return <>
    <p className="studio-hint" role="status">当前实际图片配置：{props.imageConfiguration}（与顶部 AI 模型中心同步）</p>
    <nav className="studio-actions" aria-label="概念图工作方式">
      <button type="button" className="studio-button" aria-pressed={mode === 'workflow'} onClick={() => setMode('workflow')}>六步产品设计</button>
      <button type="button" className="studio-button" aria-pressed={mode === 'layout'} onClick={() => setMode('layout')}>自由排版与三图</button>
      <button type="button" className="studio-button" aria-pressed={mode === 'advanced'} onClick={() => setMode('advanced')}>原有 AI 专业流程</button>
    </nav>
    {mode === 'workflow' ? <ProductWorkflowStudio {...props} /> : mode === 'advanced' ? <AdvancedVisualStudio {...props} /> : <ConceptVisualWorkspace {...props} />}
  </>
}
