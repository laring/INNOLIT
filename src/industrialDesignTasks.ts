export type IndustrialTask = 'original' | 'hero-render' | 'ten-sketches'

export const industrialTaskNames: Record<IndustrialTask, string> = {
  original: '原有绘图模式',
  'hero-render': '前沿智能电子产品效果图',
  'ten-sketches': '一图十方案设计草图',
}

export function industrialDesignPrompt(input: {
  task: Exclude<IndustrialTask, 'original'>
  productBrief: string
  style: string
  locked: boolean
}): string {
  const common = [
    'ROLE: Senior industrial designer specializing in smart electronic consumer products.',
    `PRODUCT BRIEF: ${input.productBrief}`,
    `STYLE: ${input.style || 'youthful, lightweight, futuristic space-age, sophisticated CMF'}`,
    'Prioritize usability, credible electronics packaging, manufacturability, material efficiency,',
    'repairability, environmental responsibility, inclusive and human-centered design.',
    'No invented brand logos, fake certification marks, or unverified product claims.',
  ]
  if (input.task === 'ten-sketches') return [
    ...common,
    'Create ONE cohesive industrial design sketch sheet containing EXACTLY TEN concepts.',
    'Arrange 2 rows x 5 columns, equal-sized cells, with numbered concepts 01 to 10.',
    'Ten genuinely different silhouettes and interface concepts; no duplicates.',
    'Consistent perspective and scale; clean marker-and-pencil sketches on a white background.',
    'Use references for visual style, not as a mandate to repeat the same silhouette.',
    'Concept exploration only; do not claim any design is already engineered or validated.',
  ].join('\n')
  return [
    ...common,
    'Create ONE premium industrial design product hero render, not a collage.',
    'Elegant space-age design, lightweight silhouette, realistic material and joinery details.',
    'Plausible functional interfaces, refined studio lighting, full product visible.',
    input.locked
      ? 'DESIGN FREEZE: Preserve the approved reference product geometry, proportions, colors, materials, brand marks and interaction. Only improve lighting and composition.'
      : 'Explore a distinctive original product form with plausible novel features.',
  ].join('\n')
}
