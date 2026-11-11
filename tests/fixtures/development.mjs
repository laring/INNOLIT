import { generateConceptBatch } from '../../src/concepts.ts'
import { confirmStep, designKey, synthesisContext } from '../../src/conceptDevelopment.ts'

export const brief = { problem: '课间安静休息', audience: '中学生', scenario: '课间教室桌面', count: 3 }
export const source = { model: 'fixture-text-model', provider: 'api.example.com' }
export const identity = { shape: '圆角矩形翻面牌，R8 圆角', structure: '整体双面外壳，无附加按钮', proportions: '90×60×12 mm', materials: '哑光桦木外壳', colors: '原木色与墨绿 #234235', interaction: '翻面启动 60 秒无声计时', markings: '正面单个小叶标识，背面圆点提示', titleFont: 'Microsoft YaHei' }

export function responseFor(stage, input = {}) {
  if (stage === 'synthesis') return { title: '无声翻面休息牌', format: '桌面工具',
    ...generateConceptBatch(brief).concepts[0].sentences, insight: '测试洞察：课间应降低开始休息的操作负担。', mechanism: '翻面触发无声计时。', useFlow: '取用 → 翻面 → 休息一分钟 → 翻回。', summary: '测试总结：保留翻面机制，统一尺寸和材质。尚未实测。', identity }
  return {
    analysis: `测试服务的 ${stage} 分析：缺少实测，所有建议须人工核对。`, draft: `测试 ${stage} 草稿，记录尚待验证的条件和风险。`,
    keywords: 'classroom quiet timer', prototype: '纸板翻面计时牌', method: '请五名志愿者完成一次操作，记录耗时', criteria: '五人中至少四人能自行开始',
    comparisons: (input.references ?? []).map(item => ({ id: item.id, comparison: '仅根据标题元数据初步判断相关性，需核对原文。' })),
  }
}

export function developedConcept() {
  let concept = generateConceptBatch(brief).concepts[0]
  concept.notes = '人工修正后的深化笔记。'
  concept.validation = { prototype: '纸板原型', method: '五人操作', criteria: '至少四人成功', observations: '', outcome: 'pending' }
  concept.research = { keywords: 'timer', evidence: [{ id: 'e1', title: '测试元数据', url: 'https://example.com/reference', source: 'paper', comparison: '用户核对后认为触发方式不同。' }] }
  concept.development = { advice: {}, feasibilityConclusion: '材料和结构可做原型，尚未实测。', researchConclusion: '仅覆盖已录入来源，仍需查专利和产品。', identity: { ...identity }, sceneException: '', history: [] }
  for (const step of ['notes', 'validation', 'research']) {
    concept.development.advice[step] = { analysis: '测试 AI 分析', draft: '测试 AI 草稿', keywords: '', references: [], source, designKey: designKey(concept) }
    concept = confirmStep(concept, step)
  }
  const proposed = responseFor('synthesis')
  const { identity: _identity, ...final } = proposed
  concept.development.final = { ...final, sentences: Object.fromEntries(Object.keys(concept.sentences).map(key => [key, final[key]])), source, contextKey: synthesisContext(concept) }
  return concept
}
