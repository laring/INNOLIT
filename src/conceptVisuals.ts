import type { Concept } from './concepts.ts'
import { developmentOf, synthesisContext } from './conceptDevelopment.ts'
import type { PageLayout, VisualPageRole, VisualPageSettings, VisualStudioSettings, VisualSubject } from './visualStudioTypes.ts'

export const visualPages = { overview: '场景与价值', interaction: '结构与交互', story: '完整概念' } as const
export const visualPageRoles = Object.keys(visualPages) as VisualPageRole[]
export const pageLayouts: Record<PageLayout, string> = { landscape: '横版', portrait: '竖版', square: '方形', custom: '自定义' }
export const layoutSizes: Record<Exclude<PageLayout, 'custom'>, [number, number]> = { landscape: [1600, 1000], portrait: [1000, 1600], square: [1200, 1200] }

export function visualSettingsOf(concept: Concept): VisualStudioSettings {
  const saved = concept.visualStudio
  const defaults: VisualStudioSettings = {
    count: 3, mode: 'local', active: 'overview', pages: {
      overview: { layout: 'landscape', width: 1600, height: 1000, description: '' },
      interaction: { layout: 'portrait', width: 1000, height: 1600, description: '' },
      story: { layout: 'portrait', width: 1600, height: 2400, description: '' },
    },
  }
  return {
    ...defaults, ...saved,
    pages: Object.fromEntries(visualPageRoles.map(role => [role, { ...defaults.pages[role], ...saved?.pages?.[role] }])) as VisualStudioSettings['pages'],
  }
}

export function pageSizeProblem({ width, height }: Pick<VisualPageSettings, 'width' | 'height'>): string {
  if (![width, height].every(value => Number.isInteger(value) && value >= 320 && value <= 6000)) return '宽和高请填写 320–6000 之间的整数像素。'
  if (width * height > 24000000) return '图片总像素请控制在 2400 万以内。'
  if (width / height < .25 || width / height > 4) return '宽高比请保持在 1:4 到 4:1 之间。'
  return ''
}

export function setPageLayout(page: VisualPageSettings, layout: PageLayout): VisualPageSettings {
  if (layout === 'custom') return { ...page, layout }
  const [width, height] = layoutSizes[layout]
  return { ...page, layout, width, height }
}

export function visualSubjectOf(concept: Concept): VisualSubject {
  const development = developmentOf(concept)
  const frozen = development.frozen
  if (frozen) return { ...frozen.design, identity: frozen.identity, version: `冻结 V${frozen.revision}` }
  const final = development.final
  if (final && final.contextKey === synthesisContext(concept)) return { ...final, identity: development.identity, version: '完善稿' }
  return {
    title: concept.title, format: concept.format, sentences: concept.sentences,
    insight: concept.sentences.problem, mechanism: concept.sentences.idea, useFlow: concept.sentences.interaction, version: '当前概念',
  }
}

export function simpleVisualKey(projectId: string, round: number, conceptId: string, version: string, role: VisualPageRole) {
  return JSON.stringify([projectId, round, conceptId, 'simple-visuals', version, role])
}

export function visualImagePrompt(subject: VisualSubject, role: VisualPageRole, description = '', hasReference = false) {
  const purpose = {
    overview: 'WHY + WHAT：人物、产品与真实使用场景的主视角，展示产品为什么存在和带来的价值。',
    interaction: 'HOW：同一产品的近景与关键使用动作，用不同视角表现形态、功能部位和交互。',
    story: '完整概念：用另一处使用场景呈现人、产品、动作与环境，不使用结构图或爆炸图作为第一视觉。',
  }
  return [
    hasReference ? '参考输入图片中的同一产品，保持产品设计一致，只改变视角、动作和场景。' : '产品设计概念可视化，清楚表达产品主体与用途。',
    `所有图片共用的概念：${subject.title}；${subject.format}。`,
    ...Object.entries(subject.sentences).map(([key, value]) => `${key}：${value.slice(0, 600)}`),
    ...(subject.identity ? [`固定产品规范：${JSON.stringify(subject.identity)}`] : []),
    '保持同一产品的造型、结构、比例、材质、配色、关键交互和标识系统。不得为不同图片重新设计产品。',
    `本图表达：${purpose[role]}`,
    '采用独立构图，不以同一画面的裁切代替不同图片。产品完整入画；不要绘制标题和大段说明文字，标题由展板统一排版。',
    description ? `补充画面描述：${description.slice(0, 1500)}` : '',
  ].filter(Boolean).join('\n')
}

export function productSketchOf(subject: VisualSubject) {
  const words = `${subject.format} ${subject.sentences.idea}`
  const kind = /杯|瓶|水壶/u.test(words) ? 'vessel' : /卡片|任务卡|分步|服务|流程|引导/u.test(words) ? 'cards' : /声音|发声|玩具/u.test(words) ? 'soundbox' : 'device'
  const colors = subject.identity?.colors.match(/#[\da-f]{6}\b/giu) ?? []
  return { kind, main: colors[0] ?? '#5d816c', accent: colors[1] ?? '#d9b679', titleFont: subject.identity?.titleFont ?? 'Microsoft YaHei' }
}
