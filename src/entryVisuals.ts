import type { FrozenConcept } from './conceptDevelopment.ts'
import { identityFields } from './conceptDevelopment.ts'
import type { SavedVisual } from './visualTypes.ts'

export const entryRoles = {
  master: '产品母版', landscape: 'Landscape Entry Image', portrait: 'Portrait Entry Image', poster: 'Poster Area 1',
} as const
export type EntryRole = keyof typeof entryRoles
export const entryPurpose: Record<EntryRole, string> = {
  master: '建立唯一的产品视觉母版，清楚显示完整造型、结构、比例、材质、配色、关键交互与产品标识。',
  landscape: 'WHY + WHAT + Hero Scene：以有目标用户参与的使用情境展示为什么需要产品、产品是什么。',
  portrait: 'HOW + 产品结构 / 关键交互：通过有手部操作的近景、功能部位与结构关系说明同一产品如何工作。保持可见外形，不自行增加零件。',
  poster: 'Problem + Insight + Solution + Mechanism + Use Flow + Value：使用另一张独立构图的真实使用情境主图，清楚展示人、产品、动作和环境。禁止用爆炸图、机制图、结构图作为主视觉。',
}
export const consistencyChecks = { ...identityFields, titleFont: '标题字体由排版统一使用冻结字体' } as const
export type VisualApproval = {
  checks: Record<keyof typeof consistencyChecks, boolean>
  composition: string
  scene: boolean
  at: number
  digest: string
  masterDigest: string
}

export function entryVisualKey(projectId: string, round: number, conceptId: string, frozenId: string, role: EntryRole) {
  return JSON.stringify([projectId, round, conceptId, frozenId, role])
}

export function entryImagePrompt(frozen: FrozenConcept, role: EntryRole, additional = ''): string {
  return [
    role === 'master' ? '建立可审查的产品设计母版，工业设计原型效果图。' : '这是对输入产品母版的参考图编辑。母版是唯一产品视觉基准，不得重新设计产品。',
    `冻结版本：V${frozen.revision}；产品：${frozen.design.title}；${frozen.design.format}。`,
    ...Object.entries(identityFields).map(([key, label]) => `${label}：${frozen.identity[key as keyof typeof identityFields]}`),
    `产品机制：${frozen.design.mechanism.slice(0, 700)}\n关键交互与使用流程：${frozen.design.useFlow.slice(0, 700)}`,
    `目标用户与场景：${frozen.design.sentences.audience.slice(0, 500)}；${frozen.design.sentences.scenario.slice(0, 500)}`,
    `本图职责：${entryPurpose[role]}`,
    role === 'poster' && frozen.sceneException ? `本项目不适合场景化，已冻结的例外理由：${frozen.sceneException}。以适合项目的应用情境表现价值。` : '',
    '必须保持完全相同的产品造型、结构、比例、材质、配色、关键交互和标识系统。不得新增或删去部件。不得更换产品。',
    '只改变拍摄视角、人物动作、场景和信息焦点；各入口使用独立构图，不能把同一张图裁切或重复排版作为新入口。产品主体完整，留出排版空间。',
    `不要在图片内绘制标题或大段说明文字；三张图统一由排版程序使用 ${frozen.identity.titleFont} 添加相同标题与标识。`,
    additional ? `用户补充的构图要求（不能修改冻结设计）：${additional.slice(0, 1000)}` : '',
  ].filter(Boolean).join('\n')
}

export function visualProblems(frozen: FrozenConcept, role: EntryRole, record: SavedVisual | undefined, master: SavedVisual | undefined, records: Partial<Record<EntryRole, SavedVisual>>): string[] {
  if (!record) return ['请生成或上传此入口的独立图片']
  const problems: string[] = []
  if (record.frozenId !== frozen.id || record.role !== role || !record.digest) problems.push('图片不属于当前冻结版本')
  const approval = record.approval
  if (!approval || approval.digest !== record.digest || !Object.keys(consistencyChecks).every(key => approval.checks[key as keyof typeof consistencyChecks])) problems.push('请逐项核对并确认八项产品一致性')
  if (role !== 'master') {
    if (!master || visualProblems(frozen, 'master', master, master, records).length) problems.push('产品母版尚未审核通过')
    if (!master?.digest || record.masterDigest !== master.digest || approval && approval.masterDigest !== master.digest) problems.push('产品母版已变化，需要重新制作并审核此图')
    if (!approval?.composition.trim()) problems.push('请记录此图独立构图和信息职责的审核结果')
    if (Object.entries(records).some(([key, item]) => key !== role && item?.digest === record.digest)) problems.push('不得重复使用同一图片作为不同信息入口')
    if (role === 'poster' && !frozen.sceneException && !approval?.scene) problems.push('Poster 主图必须是人、产品、动作和环境明确的真实使用情境')
  }
  return problems
}
