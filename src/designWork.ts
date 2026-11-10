import { averageScore, conceptSourceLabel, scoreDimensions, sentenceLabels } from './concepts.ts'
import type { Concept, ConceptBatch, ScoreDimension } from './concepts.ts'

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
  const validation = concept.validation ?? emptyValidation
  const research = concept.research
  return {
    title: 'INNO LIT 设计报告',
    sections: [
      {
        heading: '项目与方案',
        entries: [
          { label: '项目', value: projectName },
          { label: '概念轮次', value: `第 ${roundNumber} 轮` },
          { label: '选定方案', value: `${concept.title} · ${concept.format}` },
          { label: '概念来源', value: conceptSourceLabel(round) },
          { label: '设计问题', value: round.brief.problem },
          { label: '目标用户', value: round.brief.audience },
          { label: '使用场景', value: round.brief.scenario },
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
      {
        heading: '可行性验证',
        entries: [
          ...(Object.keys(validationFields) as (keyof typeof validationFields)[])
            .map(key => ({ label: validationFields[key].label, value: validation[key] })),
          { label: '人工判断', value: validationOutcomes[validation.outcome] },
        ],
      },
      {
        heading: '原创性检索记录',
        entries: [
          { label: '检索关键词', value: research?.keywords ?? '' },
          ...(research?.evidence ?? []).map(item => ({
            label: `${evidenceSources[item.source]} · ${item.title}`,
            value: item.comparison,
            url: evidenceUrl(item.url) ?? undefined,
          })),
          { label: '记录范围', value: research?.evidence.length ? '仅涵盖本报告列出的参考来源。' : '尚未记录参考来源。' },
        ],
      },
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
