
import { useState } from 'react'
import { modelSourceLabel, sentenceLabels } from './concepts'
import type { Concept } from './concepts'
import {
  developmentOf,
  developmentSteps,
  freezeConcept,
  freezeProblems,
  identityFields,
  reopenConcept,
  stepConfirmed,
  synthesisContext,
  titleFonts,
} from './conceptDevelopment'
import type {
  ProductIdentity,
  Synthesis,
} from './conceptDevelopment'
import { synthesizeConcept } from './developmentModel'
import { hasModelSettings } from './modelGeneration'
import type { ModelSettings } from './modelGeneration'
import { useModelTask } from './useModelTask'

type Props = {
  concept: Concept
  settings: ModelSettings
  onChange: (
    update: (current: Concept) => Concept
  ) => void
  onFrozen: () => void
}

const detailLabels = {
  insight: '设计洞察',
  mechanism: '产品机制',
  useFlow: '使用流程',
  summary: '完善总结与剩余风险',
} as const

export function ConceptFreezePanel({
  concept,
  settings,
  onChange,
  onFrozen,
}: Props) {
  const { pending, notice, run, cancel } = useModelTask()

  const [checks, setChecks] = useState<string[]>([])
  const [editing, setEditing] = useState(false)
  const [freezeError, setFreezeError] = useState('')

  const data = developmentOf(concept)
  const frozen = data.frozen
  const final = frozen?.design ?? data.final
  const identity = frozen?.identity ?? data.identity

  const ready = Object.keys(developmentSteps).every(
    step => stepConfirmed(
      concept,
      step as keyof typeof developmentSteps,
    ),
  )

  const problems = frozen ? [] : freezeProblems(concept)

  const items = final
    ? [
        {
          key: 'title',
          label: '最终概念标题',
          value: final.title,
        },
        {
          key: 'format',
          label: '最终产品形态',
          value: final.format,
        },
        ...Object.entries(sentenceLabels).map(
          ([key, label]) => ({
            key: `sentence:${key}`,
            label,
            value: final.sentences[
              key as keyof typeof sentenceLabels
            ],
          }),
        ),
        ...Object.entries(detailLabels).map(
          ([key, label]) => ({
            key: `detail:${key}`,
            label,
            value: final[
              key as keyof typeof detailLabels
            ],
          }),
        ),
        ...Object.entries(identityFields).map(
          ([key, label]) => ({
            key: `identity:${key}`,
            label,
            value: identity[
              key as keyof typeof identityFields
            ],
          }),
        ),
        {
          key: 'titleFont',
          label: '统一标题字体',
          value: identity.titleFont,
        },
        {
          key: 'sceneException',
          label: '场景表达例外理由',
          value: frozen?.sceneException ??
            data.sceneException ??
            '',
        },
      ]
    : []

  // 场景例外是可选项，留空无需勾选。
  const requiredItems = items.filter(
    item =>
      item.key !== 'sceneException' ||
      Boolean(item.value.trim()),
  )

  const checkedCount = requiredItems.filter(
    item => checks.includes(item.key),
  ).length

  const allChecked =
    requiredItems.length > 0 &&
    checkedCount === requiredItems.length

  function resetReview() {
    setChecks([])
    setFreezeError('')
  }

  function toggleCheck(key: string, checked: boolean) {
    setChecks(current =>
      checked
        ? [...new Set([...current, key])]
        : current.filter(item => item !== key),
    )
  }

  function updateFinal(change: Partial<Synthesis>) {
    resetReview()

    onChange(current => {
      const development = developmentOf(current)

      if (!development.final) return current

      return {
        ...current,
        development: {
          ...development,
          final: {
            ...development.final,
            ...change,
          },
        },
      }
    })
  }

  function updateIdentity(change: Partial<ProductIdentity>) {
    resetReview()

    onChange(current => {
      const development = developmentOf(current)

      return {
        ...current,
        development: {
          ...development,
          identity: {
            ...development.identity,
            ...change,
          },
        },
      }
    })
  }

  function handleFreeze() {
    if (!allChecked || pending || problems.length) return

    try {
      setFreezeError('')

      const id = crypto.randomUUID()
      const at = Date.now()

      // 继续使用现有冻结函数，不绕过任何校验。
      onChange(current => freezeConcept(current, id, at))
      onFrozen()
    } catch (error) {
      setFreezeError(
        error instanceof Error
          ? error.message
          : '冻结失败，请检查概念数据。',
      )
    }
  }

  return (
    <section className="studio-surface studio-refinement">
      <h2>
        {frozen
          ? `概念已冻结 · V${frozen.revision}`
          : '方案优化与定稿'}
      </h2>

      <p>
        AI 根据现有概念与分析记录先完善方案，你可以随时修正。
        未完成的验证保留为待验证；冻结是可选操作，不影响继续生成概念图。
      </p>

      <h3>已有分析记录</h3>

      <ul>
        {Object.entries(developmentSteps).map(
          ([key, label]) => (
            <li key={key}>
              {stepConfirmed(
                concept,
                key as keyof typeof developmentSteps,
              )
                ? '✓'
                : '○'}{' '}
              {label}
              {' · '}
              {stepConfirmed(
                concept,
                key as keyof typeof developmentSteps,
              )
                ? '已确认'
                : '待完成'}
            </li>
          ),
        )}
      </ul>

      {!frozen && (
        <div className="studio-actions">
          <button
            type="button"
            className="studio-button primary"
            disabled={
              pending ||
              !hasModelSettings(settings)
            }
            onClick={() => {
              resetReview()

              void run(
                signal =>
                  synthesizeConcept(
                    concept,
                    settings,
                    signal,
                  ),
                result =>
                  onChange(current => {
                    if (
                      synthesisContext(current) !==
                      result.final.contextKey
                    ) {
                      return current
                    }

                    const development =
                      developmentOf(current)

                    const preserved = Object.fromEntries(
                      Object.entries(
                        development.identity,
                      ).filter(
                        ([, value]) =>
                          value.trim(),
                      ),
                    )

                    const identity = {
                      ...result.identity,
                      ...preserved,
                    } as ProductIdentity

                    return {
                      ...current,
                      development: {
                        ...development,
                        final: result.final,
                        identity,
                      },
                    }
                  }),
                'AI 优化稿已保存，可修正、直接制作概念图，或选择冻结。',
              )
            }}
          >
            AI 完善概念与总结
          </button>

          {pending && (
            <button
              type="button"
              className="studio-button"
              onClick={cancel}
            >
              取消完善
            </button>
          )}
        </div>
      )}

      <p className="studio-hint" role="status">
        {notice ||
          (frozen
            ? `冻结编号：${frozen.id}`
            : ready ? '已有三步确认记录，可让 AI 继续优化。' : '可以先让 AI 优化现有概念；未完成的分析与实测不会被自动确认。')}
      </p>

      {final && (
        <>
          <p className="studio-badge">
            完善模型：
            {modelSourceLabel(
              frozen?.source ?? data.final?.source,
            )}
          </p>

          {!frozen && <button type="button" className="studio-button primary" disabled={pending || data.final?.contextKey !== synthesisContext(concept)} onClick={onFrozen}>使用优化稿制作概念图（无需冻结）</button>}
          {!frozen && data.final?.contextKey !== synthesisContext(concept) && <p className="studio-hint">分析记录已变化，请重新优化后使用最新方案。</p>}
          <h3>方案内容 · 勾选用于可选冻结</h3>

          {!frozen && (
            <div className="studio-actions">
              <button
                type="button"
                className="studio-button"
                disabled={pending}
                onClick={() =>
                  setChecks(
                    requiredItems.map(item => item.key),
                  )
                }
              >
                全部勾选确认
              </button>

              <button
                type="button"
                className="studio-button"
                disabled={pending}
                onClick={() => setChecks([])}
              >
                清除勾选
              </button>
            </div>
          )}

          <p className="studio-hint">
            已确认 {frozen
              ? requiredItems.length
              : checkedCount}
            {' / '}
            {requiredItems.length} 项
          </p>

          <div
            className="development-fields"
            style={{
              display: 'grid',
              gap: '12px',
            }}
          >
            {requiredItems.map(item => (
              <label
                key={item.key}
                className="studio-choice"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '16px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    Boolean(frozen) ||
                    checks.includes(item.key)
                  }
                  disabled={Boolean(frozen) || pending}
                  onChange={event =>
                    toggleCheck(
                      item.key,
                      event.target.checked,
                    )
                  }
                  style={{
                    width: '22px',
                    height: '22px',
                    flexShrink: 0,
                  }}
                />

                <span style={{ flex: 1 }}>
                  <strong
                    style={{
                      display: 'block',
                      fontSize: '17px',
                    }}
                  >
                    {item.label}
                  </strong>

                  <span
                    style={{
                      display: 'block',
                      marginTop: '6px',
                      fontSize: '16px',
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {item.value || '尚未填写'}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {!frozen && (
            <details
              open={editing}
              onToggle={event =>
                setEditing(event.currentTarget.open)
              }
              style={{ marginTop: '20px' }}
            >
              <summary>
                内容有问题？展开修改
              </summary>

              <fieldset
                className="development-fields studio-refinement"
                disabled={pending}
              >
                <label className="studio-field">
                  最终概念标题
                  <input
                    value={final.title}
                    maxLength={100}
                    onChange={event =>
                      updateFinal({
                        title: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="studio-field">
                  最终产品形态
                  <input
                    value={final.format}
                    maxLength={100}
                    onChange={event =>
                      updateFinal({
                        format: event.target.value,
                      })
                    }
                  />
                </label>

                <div className="studio-validation-fields">
                  {Object.entries(sentenceLabels).map(
                    ([key, label]) => (
                      <label
                        className="studio-field"
                        key={key}
                      >
                        {label}
                        <textarea
                          rows={3}
                          maxLength={1000}
                          value={
                            final.sentences[
                              key as keyof typeof sentenceLabels
                            ]
                          }
                          onChange={event =>
                            updateFinal({
                              sentences: {
                                ...final.sentences,
                                [key]: event.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    ),
                  )}
                </div>

                {(
                  Object.keys(
                    detailLabels,
                  ) as Array<
                    keyof typeof detailLabels
                  >
                ).map(key => (
                  <label
                    className="studio-field"
                    key={key}
                  >
                    {detailLabels[key]}
                    <textarea
                      rows={4}
                      maxLength={4000}
                      value={final[key]}
                      onChange={event =>
                        updateFinal({
                          [key]: event.target.value,
                        })
                      }
                    />
                  </label>
                ))}

                <h3>产品一致性规范</h3>

                <div className="studio-validation-fields">
                  {Object.entries(identityFields).map(
                    ([key, label]) => (
                      <label
                        className="studio-field"
                        key={key}
                      >
                        {label}
                        <textarea
                          rows={3}
                          maxLength={800}
                          value={
                            identity[
                              key as keyof typeof identityFields
                            ]
                          }
                          onChange={event =>
                            updateIdentity({
                              [key]: event.target.value,
                            })
                          }
                        />
                      </label>
                    ),
                  )}
                </div>

                <label className="studio-field">
                  统一标题字体
                  <select
                    value={identity.titleFont}
                    onChange={event =>
                      updateIdentity({
                        titleFont: event.target.value as
                          ProductIdentity['titleFont'],
                      })
                    }
                  >
                    {titleFonts.map(font => (
                      <option key={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="studio-field">
                  场景表达例外理由（可选）
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={data.sceneException}
                    onChange={event => {
                      resetReview()
                      const sceneException =
                        event.target.value

                      onChange(current => ({
                        ...current,
                        development: {
                          ...developmentOf(current),
                          sceneException,
                        },
                      }))
                    }}
                  />
                </label>
              </fieldset>
            </details>
          )}

          {!frozen && (
            <>
              {problems.length > 0 && (
                <div className="studio-hint">
                  <h3>冻结前需要解决</h3>
                  <ul>
                    {problems.map(problem => (
                      <li key={problem}>
                        {problem}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {freezeError && (
                <p role="alert">
                  {freezeError}
                </p>
              )}

              <button
                type="button"
                className="studio-button primary"
                disabled={
                  pending ||
                  !allChecked ||
                  problems.length > 0
                }
                onClick={handleFreeze}
              >
                确认并冻结概念
              </button>
            </>
          )}
        </>
      )}

      {frozen && (
        <>
          <p>
            产品定义已锁定。下一阶段将根据冻结版本，
            由 AI 自动转译为专业生图提示词。
          </p>

          <button
            type="button"
            className="studio-button"
            onClick={() => {
              resetReview()
              onChange(reopenConcept)
            }}
          >
            创建修订版
          </button>
        </>
      )}

      {data.history.length > 0 && (
        <details>
          <summary>
            历史冻结版本 · {data.history.length}
          </summary>

          <ul>
            {data.history.map(item => (
              <li key={item.id}>
                V{item.revision}
                {' · '}
                {item.design.title}
                {' · '}
                {new Date(item.at).toLocaleString()}
                {' · '}
                {item.id}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
