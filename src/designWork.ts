import { averageModelScore, averageScore, conceptSourceLabel, modelSourceLabel, scoreDimensions, sentenceLabels } from './concepts.ts'
import type { Concept, ConceptBatch, ScoreDimension } from './concepts.ts'
import { developmentSteps, identityFields, stepConfirmed } from './conceptDevelopment.ts'

export const validationFields = {
  prototype: { label: '原型与材料', hint: '准备哪些材料，制作什么样的原型？' },
  method: { label: '测试步骤', hint: '由谁参与，在什么条件下完成哪些动作？' },
  criteria: { label: '通过标准', hint: '记录可观察的阈值，例如 5 人中至少 4 人能独立完成。' },
  observations: { label: '实测记录', hint: '记录实际人数、耗时、成功次数或出现的问题。' },
} as const

export const validationOutcomes = {
  pending: '待验证',
  pass: '达到标准',
  revise: '需迭代',
} as const

export type ValidationOutcome = keyof typeof validationOutcomes
export type ValidationPlan = Record<keyof typeof validationFields, string> & { outcome: ValidationOutcome }

export const emptyValidation: ValidationPlan = {
  prototype: '',
  method: '',
  criteria: '',
  observations: '',
  outcome: 'pending',
}

export function updateValidation(plan: ValidationPlan, change: Partial<ValidationPlan>): ValidationPlan {
  const next = { ...plan, ...change }
  const evidenceChanged = next.criteria !== plan.criteria || next.observations !== plan.observations
  if (!next.criteria.trim() || !next.observations.trim() || (evidenceChanged && change.outcome === undefined)) {
    next.outcome = 'pending'
  }
  return next
}

export const evidenceSources = {
  patent: '专利',
  paper: '论文',
  product: '产品',
  other: '其他',
} as const

export type EvidenceSource = keyof typeof evidenceSources
export type Evidence = {
  id: string
  source: EvidenceSource
  title: string
  url: string
  comparison: string
}

export type ResearchLog = {
  keywords: string
  evidence: Evidence[]
}

export function evidenceUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

type ReportEntry = { label: string; value: string; url?: string }
type ReportSection = { heading: string; entries: ReportEntry[] }
type DesignReport = { title: string; sections: ReportSection[] }

export function buildDesignReport(
  projectName: string, round: ConceptBatch, roundNumber: number, concept: Concept,
): DesignReport {
  const development = concept.development
  const frozen = development?.frozen
  const confirmation = Object.fromEntries(Object.keys(developmentSteps).map(key => [key, stepConfirmed(concept, key as keyof typeof developmentSteps)]))
  if (frozen) concept = { ...concept, title: frozen.design.title, format: frozen.design.format, sentences: frozen.design.sentences,
    notes: frozen.notes, validation: frozen.validation, research: frozen.research, scores: frozen.scores ?? concept.scores, modelReview: frozen.modelReview }
  const validation = concept.validation ?? emptyValidation
  const research = concept.research
  const origin = concept.chatOrigin
  const review = concept.modelReview
  return {
    title: 'INNO LIT 设计报告',
    sections: [
      {
        heading: '项目与方案',
        entries: [
          { label: '项目', value: projectName },
          { label: '概念轮次', value: `第 ${roundNumber} 轮` },
          { label: '选定方案', value: `${concept.title} · ${concept.format}` },
          { label: '概念来源', value: origin ? `来自创意对话 · ${modelSourceLabel(origin.source)}` : conceptSourceLabel(round) },
          ...(frozen ? [{ label: '冻结版本', value: `V${frozen.revision} · ${frozen.id} · ${new Date(frozen.at).toISOString()}` }] : []),
          ...(origin?.organizedBy ? [{ label: '整理模型', value: modelSourceLabel(origin.organizedBy) }] : []),
          { label: '设计问题', value: round.brief.problem },
          { label: '目标用户', value: round.brief.audience },
          { label: '使用场景', value: round.brief.scenario },
          ...(round.brief.startingPoint ? [
            { label: '设计起点', value: round.brief.startingPoint.text },
            ...(round.brief.startingPoint.source ? [{ label: '起点概念', value: round.brief.startingPoint.source.title }] : []),
          ] : []),
        ],
      },
      {
        heading: '九句话概念',
        entries: (Object.keys(sentenceLabels) as (keyof typeof sentenceLabels)[])
          .map(key => ({ label: sentenceLabels[key], value: concept.sentences[key] })),
      },
      {
        heading: '人工评分与深化',
        entries: [
          ...(Object.keys(scoreDimensions) as ScoreDimension[]).map(key => ({
            label: scoreDimensions[key],
            value: concept.scores[key] === null ? '未评分' : `${concept.scores[key]} / 5`,
          })),
          { label: '等权平均分', value: averageScore(concept.scores)?.toFixed(1) ?? '未完成评分' },
          { label: '深化笔记', value: concept.notes },
        ],
      },
      ...(review ? [{
        heading: '模型评分与理由',
        entries: [
          ...Object.entries(scoreDimensions).map(([key, label]) => {
            const rating = review.ratings[key as ScoreDimension]
            return { label, value: `${rating.score} / 5 · ${rating.reason}` }
          }),
          { label: '模型平均分', value: averageModelScore(review).toFixed(1) },
          { label: '评分模型', value: modelSourceLabel(review.source) },
        ],
      }] : []),
      {
        heading: '可行性验证',
        entries: [
          ...(Object.keys(validationFields) as (keyof typeof validationFields)[])
            .map(key => ({ label: validationFields[key].label, value: validation[key] })),
          { label: '人工判断', value: validationOutcomes[validation.outcome] },
          { label: '人工可行性分析结论', value: frozen?.feasibilityConclusion ?? development?.feasibilityConclusion ?? '' },
          { label: '实测状态', value: validation.observations.trim() ? '实测记录由用户提供，模型未替代实测。' : '尚未提供实测记录；冻结不代表实测通过。' },
        ],
      },
      {
        heading: '原创性检索记录',
        entries: [
          { label: '检索关键词', value: research?.keywords ?? '' },
          { label: '人工检索比较结论', value: frozen?.researchConclusion ?? development?.researchConclusion ?? '' },
          ...(research?.evidence ?? []).map(item => ({
            label: `${evidenceSources[item.source]} · ${item.title}`,
            value: item.comparison,
            url: evidenceUrl(item.url) ?? undefined,
          })),
          { label: '记录范围', value: research?.evidence.length ? '仅涵盖本报告列出的参考来源。' : '尚未记录参考来源。' },
        ],
      },
      ...(development ? [{
        heading: 'AI 参与与人工确认',
        entries: Object.entries(developmentSteps).flatMap(([key, label]) => {
          const advice = (frozen?.advice ?? development.advice)[key as keyof typeof developmentSteps]
          return advice ? [
            { label: `${label} · 模型`, value: modelSourceLabel(advice.source) },
            { label: `${label} · 模型分析`, value: advice.analysis },
            { label: `${label} · 原始草稿`, value: advice.draft },
            { label: `${label} · 人工确认`, value: frozen || confirmation[key] ? '已确认当前记录' : '待确认或记录已修改' },
          ] : [{ label, value: '尚无 AI 参与记录' }]
        }),
      }] : []),
      ...(frozen ? [{
        heading: '完善总结与冻结产品规范',
        entries: [
          { label: '设计洞察', value: frozen.design.insight }, { label: '产品机制', value: frozen.design.mechanism },
          { label: '使用流程', value: frozen.design.useFlow }, { label: '完善总结与剩余风险', value: frozen.design.summary },
          ...Object.entries(identityFields).map(([key, label]) => ({ label, value: frozen.identity[key as keyof typeof identityFields] })),
          { label: '标题字体', value: frozen.identity.titleFont },
          { label: '场景表达例外', value: frozen.sceneException || '无；Poster 必须使用占版面超过 50% 的真实使用情境主图。' },
        ],
      }] : []),
    ],
  }
}

function escapeMarkdown(value: string): string {
  return value
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replace(/[\\`*_{}[\]()#+.!|~-]/g, '\\$&')
    .replace(/\r?\n/g, '\n  ')
}

export function formatDesignReport(report: DesignReport): string {
  const sections = report.sections.map(section => [
    `## ${section.heading}`,
    '',
    ...section.entries.map(entry => {
      const label = escapeMarkdown(entry.label.replace(/\s+/g, ' '))
      const value = escapeMarkdown(entry.value.trim() || '未填写')
      const url = entry.url ? `\n  <${entry.url}>` : ''
      return `- **${label}** ${value}${url}`
    }),
  ].join('\n'))
  return [`# ${report.title}`, ...sections, ''].join('\n\n')
}
