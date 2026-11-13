
import type { FrozenConcept } from './conceptDevelopment'

export type VisualMode = 'concept' | 'board'

export type VisualPromptResult = {
  frozenId: string
  prompt: string
  source: 'frozen-rules'
  warnings: string[]
}

export function translateFrozenVisual(
  frozen: FrozenConcept,
  mode: VisualMode,
  width: number,
  height: number,
  extra = '',
): VisualPromptResult {
  const { design, identity } = frozen

  const constraints = [
    ['Product geometry', identity.shape],
    ['Mechanical structure', identity.structure],
    ['Proportions and dimensions', identity.proportions],
    ['Materials and surface finish', identity.materials],
    ['Color scheme', identity.colors],
    ['Key interaction', identity.interaction],
    ['Product markings', identity.markings],
  ]

  const missing = constraints
    .filter(([, value]) => !value.trim())
    .map(([label]) => label)

  if (missing.length) {
    throw new Error(
      `冻结概念缺少一致性信息：${missing.join(', ')}`,
    )
  }

  const presentation =
    mode === 'board'
      ? [
          'Create a professional industrial design presentation board.',
          'Use a clear editorial layout.',
          'Show the product as the main visual subject.',
          'Include usage and mechanism explanations only when',
          'supported by the frozen design.',
          'Keep diagrams consistent with the product.',
        ].join(' ')
      : [
          'Create a professional industrial design product rendering.',
          'Show the product clearly with realistic materials.',
          'Use clean lighting and a restrained background.',
          'Do not introduce unapproved design details.',
        ].join(' ')

  const prompt = [
    'INDUSTRIAL DESIGN VISUAL SPECIFICATION',
    '',
    `Product title: ${design.title}`,
    `Product category and form: ${design.format}`,
    '',
    'FROZEN PRODUCT IDENTITY:',
    ...constraints.map(
      ([label, value]) => `${label}: ${value}`,
    ),
    `Title typography: ${identity.titleFont}`,
    '',
    'DESIGN INTENT:',
    `Core idea: ${design.sentences.idea}`,
    `Target audience: ${design.sentences.audience}`,
    `Usage scenario: ${design.sentences.scenario}`,
    `Interaction: ${design.sentences.interaction}`,
    `Design insight: ${design.insight}`,
    `Mechanism: ${design.mechanism}`,
    `Use flow: ${design.useFlow}`,
    '',
    'VISUAL PRESENTATION:',
    presentation,
    `Target aspect ratio: ${width}:${height}`,
    '',
    'STRICT CONSISTENCY RULES:',
    'Preserve the frozen product identity.',
    'Do not redesign the geometry or mechanism.',
    'Do not invent additional functions.',
    'Do not alter approved colors or materials.',
    'Do not change the product proportions.',
    'Do not introduce unsupported engineering details.',
    'Keep all depicted interactions consistent with the design.',
    '',
    'USER PRESENTATION PREFERENCE:',
    extra.trim() ||
      'Clean, readable, professional presentation.',
  ].join('\n')

  return {
    frozenId: frozen.id,
    prompt,
    source: 'frozen-rules',
    warnings: [
      '当前使用规则式视觉转译，尚未经过文本模型优化。',
      '文字约束不能保证图像模型完全遵守产品一致性。',
      '生成结果仍需人工审核。',
    ],
  }
}
