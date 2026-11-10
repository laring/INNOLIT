import type { ResearchLog, ValidationPlan } from './designWork.ts'

export const conceptCounts = [3, 4, 5, 6] as const
export type ConceptCount = typeof conceptCounts[number]

export type ConceptDraft = {
  problem: string
  audience: string
  scenario: string
  count: ConceptCount
}

export const sentenceLabels = {
  problem: '设计问题',
  audience: '目标用户',
  scenario: '使用场景',
  idea: '核心构想',
  interaction: '使用方式',
  difference: '差异点',
  value: '预期价值',
  risk: '关键风险',
  test: '验证方式',
} as const

export const scoreDimensions = {
  novelty: '创新性',
  feasibility: '可行性',
  value: '用户价值',
} as const

export type ScoreDimension = keyof typeof scoreDimensions
export type Score = 1 | 2 | 3 | 4 | 5
export const scoreOptions: Score[] = [1, 2, 3, 4, 5]
export type Scores = Record<ScoreDimension, Score | null>

type Direction = 'tool' | 'cue' | 'guide' | 'kit' | 'service' | 'feedback'

export type Concept = {
  id: string
  title: string
  format: string
  sentences: Record<keyof typeof sentenceLabels, string>
  scores: Scores
  notes: string
  validation?: ValidationPlan
  research?: ResearchLog
}

export type ConceptBatch = {
  brief: ConceptDraft
  concepts: Concept[]
  selectedId: Concept['id'] | null
  generation?: { model: string; provider: string }
}

type ConceptCandidate = Pick<Concept, 'id' | 'title' | 'format' | 'sentences'>

export type ConceptStudioState = {
  draft: ConceptDraft
  rounds: ConceptBatch[]
  activeRound: number
}

type DesignContext = {
  action: string
  tool: string
  cue: string
  signal: string
}

const contexts: { match: RegExp; context: DesignContext }[] = [
  {
    match: /放松|减压|休息|专注|压力|relax|stress|focus/i,
    context: {
      action: '完成一次短暂停顿并回到原来的活动',
      tool: '翻面即启动一分钟计时的桌面小牌',
      cue: '获得短暂休息机会',
      signal: '启动停顿到恢复原活动所需的时间',
    },
  },
  {
    match: /环保|一次性|废弃|回收|循环|复用|waste|recycl|reus/i,
    context: {
      action: '在用完后把物品带回可复用的流程',
      tool: '带回收状态标记和回收点提示的可清洗套件',
      cue: '用完物品准备丢弃',
      signal: '每十次使用中完成归还的次数',
    },
  },
  {
    match: /声音|音效|听觉|声响|sound|listen/i,
    context: {
      action: '辨认一种声音并尝试复现它',
      tool: '可替换发声件的手摇声音盒',
      cue: '听见声音并开始寻找来源',
      signal: '能独立匹配声音与来源的次数',
    },
  },
]

const defaultContext: DesignContext = {
  action: '完成设计问题中最关键的一步',
  tool: '把操作顺序印在握持面上的便携工具',
  cue: '遇到困难并准备采取行动',
  signal: '独立完成关键步骤的次数和耗时',
}

type Strategy = {
  id: Direction
  title: string
  format: string
  describe: (context: DesignContext) => Pick<
    Concept['sentences'], 'idea' | 'interaction' | 'difference' | 'value' | 'risk' | 'test'
  >
}

const strategies: Strategy[] = [
  {
    id: 'tool', title: '一步到手', format: '实体工具',
    describe: ({ tool, action, signal }) => ({
      idea: `制作${tool}，帮助用户${action}。`,
      interaction: '用户在使用地点取用工具，按工具上的提示完成一次操作，再把它放回原位。',
      difference: '把提示和操作合在同一件物品上，使用者伸手就能开始。',
      value: '用户可在现场自行开始，减少查找说明和设备的时间。',
      risk: '如果取用位置不顺手或标记不清，工具可能会被跳过。',
      test: `用纸板或现成物件做原型，对照现有流程记录${signal}。`,
    }),
  },
  {
    id: 'cue', title: '恰时提示', format: '环境干预',
    describe: ({ cue, action, signal }) => ({
      idea: `在用户${cue}时展示可翻转色卡，提醒他们${action}。`,
      interaction: '用户沿原路线看到色卡，用完翻到完成面，下一次使用前由现场人员复位。',
      difference: '只改变决策点的环境，把提示放在用户自然会经过的位置。',
      value: '用户可以沿用熟悉的路线，同时更容易记住关键动作。',
      risk: '提示可能被视觉噪音淹没，或在未复位时给出错误信号。',
      test: `在两个候选位置分别贴临时提示，对照无提示条件记录${signal}。`,
    }),
  },
  {
    id: 'guide', title: '三步引导', format: '分步流程',
    describe: ({ action, signal }) => ({
      idea: `用三张翻页任务卡把「${action}」拆成准备、尝试和自查。`,
      interaction: '用户每次只看一张卡，按图示完成后翻页，并在卡片末尾选择重试或结束。',
      difference: '通过逐步揭示降低首次使用的学习负担，在容易出错的步骤提供可回退的提示。',
      value: '首次使用的人可以自行练习，卡住时也知道从哪里重试。',
      risk: '高频用户可能觉得翻页打断节奏，反而比原流程慢。',
      test: `用三张便签做原型，请初次使用者自行操作并记录卡住的步骤与${signal}。`,
    }),
  },
  {
    id: 'kit', title: '自由拼装', format: '模块化系统',
    describe: ({ action, signal }) => ({
      idea: `设计统一接口的基础件和两种可替换的操作模块，以不同方式帮助用户${action}。`,
      interaction: '用户先用基础配置完成一次，再根据空间、力度或操作习惯替换其中一个模块。',
      difference: '保留同一个基础件，只替换影响实际操作的一部分。',
      value: '不同使用者可以找到适合自己的配置，损耗件也可以单独更换。',
      risk: '连接件松动和配件丢失都会增加维护成本。',
      test: `用磁贴和纸板做出两种配置，记录换件耗时与${signal}。`,
    }),
  },
  {
    id: 'service', title: '就近共享', format: '共享服务',
    describe: ({ action, signal }) => ({
      idea: `在使用场景附近设一个借用点，由同伴示范并交接一套帮助用户${action}的材料。`,
      interaction: '用户领取材料，跟着示范完成一次操作，归还时在纸质登记卡上标注可用状态。',
      difference: '用公共资源与现场协作分担个人购置和学习成本。',
      value: '低频使用者也能就近获得工具和即时帮助。',
      risk: '高峰期可能缺货，交接和维护也需要明确的负责人。',
      test: `用一个桌面借用点试运行，记录等待时间、归还率与${signal}。`,
    }),
  },
  {
    id: 'feedback', title: '可见进展', format: '自我反馈',
    describe: ({ action, signal }) => ({
      idea: `用带滑块的匿名记录卡显示用户每次尝试「${action}」的结果。`,
      interaction: '用户在操作结束时移动滑块，下一次开始前查看上次结果并决定是否调整做法。',
      difference: '用个人可见的结果建立反馈循环，让反复使用的人能自行调整。',
      value: '用户可以看见自己的进展，并比较不同做法的效果。',
      risk: '额外记录可能打断使用，单一指标也可能忽略体验质量。',
      test: `用纸质滑卡试用两轮，对照无反馈的一轮记录${signal}和主动调整的次数。`,
    }),
  },
]

export function normalizeDraft(draft: ConceptDraft): ConceptDraft {
  return {
    problem: draft.problem.trim(),
    audience: draft.audience.trim(),
    scenario: draft.scenario.trim(),
    count: draft.count,
  }
}

export function requireConceptBrief(draft: ConceptDraft): ConceptDraft {
  const brief = normalizeDraft(draft)
  if (!brief.problem || !brief.audience || !brief.scenario) {
    throw new Error('请填写设计问题、目标用户和使用场景。')
  }
  if (!conceptCounts.includes(brief.count)) {
    throw new Error('请选择生成 3 到 6 个概念。')
  }
  return brief
}

export function briefSentences(brief: ConceptDraft): Pick<Concept['sentences'], 'problem' | 'audience' | 'scenario'> {
  return {
    problem: `本概念回应的设计问题是「${brief.problem}」。`,
    audience: `概念面向「${brief.audience}」。`,
    scenario: `概念用于「${brief.scenario}」这一情境。`,
  }
}

export function createConceptBatch(brief: ConceptDraft, candidates: ConceptCandidate[], generation?: ConceptBatch['generation']): ConceptBatch {
  return {
    brief,
    selectedId: null,
    ...(generation ? { generation } : {}),
    concepts: candidates.map(candidate => ({
      ...candidate,
      scores: { novelty: null, feasibility: null, value: null },
      notes: '',
    })),
  }
}

export function generateConceptBatch(draft: ConceptDraft): ConceptBatch {
  const brief = requireConceptBrief(draft)
  const context = contexts.find(rule => rule.match.test(brief.problem))?.context ?? defaultContext
  return createConceptBatch(brief, strategies.slice(0, brief.count).map(({ id, title, format, describe }) => ({
    id,
    title,
    format,
    sentences: { ...briefSentences(brief), ...describe(context) },
  })))
}

export function conceptSourceLabel(batch: ConceptBatch): string {
  return batch.generation
    ? `AI · ${batch.generation.model}（${batch.generation.provider}）`
    : '本地规则生成 · 非 AI'
}

export function appendConceptRound(state: ConceptStudioState, batch = generateConceptBatch(state.draft)): ConceptStudioState {
  return {
    draft: batch.brief,
    rounds: [...state.rounds, batch],
    activeRound: state.rounds.length,
  }
}

export function averageScore({ novelty, feasibility, value }: Scores): number | null {
  if (novelty === null || feasibility === null || value === null) return null
  return (novelty + feasibility + value) / 3
}
