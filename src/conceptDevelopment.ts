import type { Concept, ModelSource } from './concepts.ts'
import { emptyValidation } from './designWork.ts'
import type { Evidence, ResearchLog, ValidationPlan } from './designWork.ts'

export const developmentSteps = { notes: '深化笔记', validation: '可行性验证', research: '原创性检索' } as const
export type DevelopmentStep = keyof typeof developmentSteps
export const identityFields = {
  shape: '产品造型', structure: '产品结构', proportions: '比例与尺寸', materials: '材质与表面',
  colors: '配色', interaction: '关键交互', markings: '标识系统',
} as const
export const titleFonts = ['Microsoft YaHei', 'SimHei'] as const
export type ProductIdentity = Record<keyof typeof identityFields, string> & { titleFont: typeof titleFonts[number] }
export type DevelopmentAdvice = {
  analysis: string
  draft: string
  keywords: string
  validation?: Pick<ValidationPlan, 'prototype' | 'method' | 'criteria'>
  references: Evidence[]
  source: ModelSource
  designKey: string
  confirmedContent?: string
}
export type FinalDesign = Pick<Concept, 'title' | 'format' | 'sentences'> & {
  insight: string; mechanism: string; useFlow: string; summary: string
}
export type Synthesis = FinalDesign & { source: ModelSource; contextKey: string }
export type FrozenConcept = {
  id: string; revision: number; at: number
  design: FinalDesign
  identity: ProductIdentity
  sceneException: string
  notes: string
  validation: ValidationPlan
  feasibilityConclusion: string
  research: ResearchLog
  researchConclusion: string
  advice: Record<DevelopmentStep, DevelopmentAdvice>
  source: ModelSource
  scores: Concept['scores']
  modelReview?: Concept['modelReview']
}
export type ConceptDevelopment = {
  advice: Partial<Record<DevelopmentStep, DevelopmentAdvice>>
  feasibilityConclusion: string
  researchConclusion: string
  identity: ProductIdentity
  sceneException: string
  final?: Synthesis
  frozen?: FrozenConcept
  history: FrozenConcept[]
}

export function developmentOf(concept: Concept): ConceptDevelopment {
  return concept.development ?? {
    advice: {}, feasibilityConclusion: '', researchConclusion: '', sceneException: '', history: [],
    identity: { shape: '', structure: '', proportions: '', materials: '', colors: '', interaction: concept.sentences.interaction, markings: '', titleFont: 'Microsoft YaHei' },
  }
}

export function designKey(concept: Pick<Concept, 'title' | 'format' | 'sentences'>) {
  return JSON.stringify({ title: concept.title, format: concept.format, sentences: concept.sentences })
}

export function stepContent(concept: Concept, step: DevelopmentStep) {
  const development = developmentOf(concept)
  if (step === 'notes') return concept.notes.trim()
  if (step === 'validation') return JSON.stringify({ plan: concept.validation ?? emptyValidation, conclusion: development.feasibilityConclusion.trim() })
  return JSON.stringify({ research: concept.research ?? { keywords: '', evidence: [] }, conclusion: development.researchConclusion.trim() })
}

export function stepReady(concept: Concept, step: DevelopmentStep): boolean {
  const advice = developmentOf(concept).advice[step]
  if (!advice || advice.designKey !== designKey(concept)) return false
  const development = developmentOf(concept)
  if (step === 'notes') return Boolean(concept.notes.trim())
  if (step === 'validation') {
    const plan = concept.validation ?? emptyValidation
    return Boolean(plan.prototype.trim() && plan.method.trim() && plan.criteria.trim() && development.feasibilityConclusion.trim())
  }
  return Boolean(development.researchConclusion.trim() && concept.research?.evidence.some(item => item.comparison.trim()))
}

export function stepConfirmed(concept: Concept, step: DevelopmentStep) {
  return stepReady(concept, step) && developmentOf(concept).advice[step]?.confirmedContent === stepContent(concept, step)
}

export function confirmStep(concept: Concept, step: DevelopmentStep): Concept {
  if (developmentOf(concept).frozen || !stepReady(concept, step)) return concept
  const development = developmentOf(concept)
  const advice = development.advice[step]!
  return { ...concept, development: { ...development, advice: { ...development.advice, [step]: { ...advice, confirmedContent: stepContent(concept, step) } } } }
}

export function synthesisContext(concept: Concept) {
  return JSON.stringify({ design: designKey(concept), steps: Object.keys(developmentSteps).map(step => stepContent(concept, step as DevelopmentStep)),
    advice: Object.values(developmentOf(concept).advice).map(item => [item.analysis, item.source]) })
}

export function freezeProblems(concept: Concept): string[] {
  const development = developmentOf(concept)
  const problems = Object.entries(developmentSteps).filter(([key]) => !stepConfirmed(concept, key as DevelopmentStep))
    .map(([, label]) => `${label}需要 AI 参与并完成人工确认`)
  const final = development.final
  if (!final || final.contextKey !== synthesisContext(concept)) problems.push('请基于最新的三步记录生成完善方案')
  if (final && (![final.title, final.format, final.insight, final.mechanism, final.useFlow, final.summary,
    ...Object.keys(concept.sentences).map(key => final.sentences[key as keyof Concept['sentences']])].every(value => typeof value === 'string' && value.trim()))) {
    problems.push('请补齐完善方案与总结')
  }
  if (Object.keys(identityFields).some(key => !development.identity[key as keyof typeof identityFields].trim())
    || !titleFonts.includes(development.identity.titleFont)) problems.push('请补齐产品一致性规范')
  if (Object.keys(identityFields).some(key => /待确认|待定|建议|未知|未确定/u.test(development.identity[key as keyof typeof identityFields]))) problems.push('产品一致性规范仍有待确认参数')
  if (development.sceneException.trim() && development.sceneException.trim().length < 20) problems.push('场景表达例外需要具体说明项目为何不适合场景化（至少 20 字）')
  return problems
}

export function freezeConcept(concept: Concept, id: string, at: number): Concept {
  const development = developmentOf(concept)
  if (development.frozen) return concept
  const problems = freezeProblems(concept)
  if (problems.length) throw new Error(problems.join('；'))
  const final = development.final!
  const { source, contextKey: _context, ...design } = final
  const frozen: FrozenConcept = structuredClone({
    id, revision: development.history.length + 1, at, design, source, scores: concept.scores, modelReview: concept.modelReview,
    identity: development.identity, sceneException: development.sceneException.trim(),
    notes: concept.notes, validation: concept.validation ?? emptyValidation,
    feasibilityConclusion: development.feasibilityConclusion,
    research: concept.research ?? { keywords: '', evidence: [] }, researchConclusion: development.researchConclusion,
    advice: development.advice as Record<DevelopmentStep, DevelopmentAdvice>,
  })
  return { ...concept, visualEntry: 'master', development: { ...development, frozen } }
}

export function reopenConcept(concept: Concept): Concept {
  const development = developmentOf(concept)
  if (!development.frozen) return concept
  return { ...concept, development: { ...development, frozen: undefined, history: [...development.history, development.frozen] } }
}
