import type { FrozenConcept } from './conceptDevelopment.ts'
import { wrapBoardText } from './conceptBoard.ts'
import { entryRoles } from './entryVisuals.ts'
import type { EntryRole } from './entryVisuals.ts'
import type { VisualSource } from './imageGeneration.ts'

type Rect = [number, number, number, number]
export type BoardRole = Exclude<EntryRole, 'master'>
export const entryBoardGeometry: Record<BoardRole, { size: [number, number]; hero: Rect }> = {
  landscape: { size: [1800, 1100], hero: [680, 240, 1060, 780] },
  portrait: { size: [1200, 1800], hero: [60, 240, 1080, 760] },
  poster: { size: [1600, 2400], hero: [60, 240, 1480, 1350] },
}
export function posterSceneShare() {
  const { size, hero } = entryBoardGeometry.poster
  return hero[2] * hero[3] / (size[0] * size[1])
}

function drawText(context: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, size: number, maxLines: number, font: string, bold = false, color = '#24392f') {
  context.font = `${bold ? 700 : 400} ${size}px "${font}", sans-serif`
  context.fillStyle = color
  wrapBoardText(value, width, text => context.measureText(text).width, maxLines).forEach((line, index) => context.fillText(line, x, y + index * size * 1.5))
}

export function renderEntryBoard(canvas: HTMLCanvasElement, frozen: FrozenConcept, role: BoardRole, bitmap?: ImageBitmap, source?: VisualSource) {
  const { size: [width, height], hero: [x, y, w, h] } = entryBoardGeometry[role]
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法绘制展板。')
  const font = frozen.identity.titleFont
  const text = (value: string, left: number, top: number, box: number, size = 26, lines = 4, bold = false, color = '#24392f') => drawText(context, value, left, top, box, size, lines, font, bold, color)
  context.textBaseline = 'top'
  context.fillStyle = '#f5f4ef'
  context.fillRect(0, 0, width, height)
  text('INNO LIT  /  CONCEPT STUDIO', 60, 38, width - 120, 18, 1, true, '#46694d')
  text(frozen.design.title, 60, 82, width - 120, 42, 2, true)
  text(`${entryRoles[role]}  ·  冻结 V${frozen.revision}  ·  ${frozen.design.format}`, 60, 198, width - 120, 18, 1, false, '#53655a')
  context.fillStyle = '#e4eae0'
  context.fillRect(x, y, w, h)
  if (bitmap) {
    // Each role supplies its own approved image. Cover fills the declared hero area.
    const scale = Math.max(w / bitmap.width, h / bitmap.height)
    const sw = w / scale
    const sh = h / scale
    context.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, x, y, w, h)
  } else text(role === 'poster' && !frozen.sceneException ? '待审核的真实使用场景主图' : '待生成或上传此入口的独立图片', x + 30, y + h / 2 - 20, w - 60, 28, 2, true)

  const info = (label: string, value: string, left: number, top: number, box: number, lines = 5, size = 26) => {
    text(label, left, top, box, 21, 1, true, '#46694d')
    text(value, left, top + 44, box, size, lines)
  }
  const design = frozen.design
  if (role === 'landscape') {
    info('WHY · 为什么需要', design.sentences.problem, 60, 260, 550, 5)
    info('WHAT · 产品是什么', design.sentences.idea, 60, 505, 550, 5)
    info('VALUE · 带来的价值', design.sentences.value, 60, 760, 550, 5)
  } else if (role === 'portrait') {
    info('HOW · 产品结构', frozen.identity.structure, 60, 1050, 1080, 4)
    info('INTERACTION · 关键交互', frozen.identity.interaction, 60, 1265, 1080, 4)
    info('USE FLOW · 使用流程', design.useFlow, 60, 1480, 1080, 5)
  } else {
    const columns = [60, 565, 1070]
    const box = 470
    const entries = [
      ['PROBLEM · 问题', design.sentences.problem], ['INSIGHT · 洞察', design.insight], ['SOLUTION · 方案', design.sentences.idea],
      ['MECHANISM · 机制', design.mechanism], ['USE FLOW · 流程', design.useFlow], ['VALUE · 价值', design.sentences.value],
    ]
    entries.forEach(([label, value], index) => info(label, value, columns[index % 3], index < 3 ? 1650 : 1960, box, 6, 23))
    if (frozen.sceneException) text(`场景表达例外：${frozen.sceneException}`, 60, 2280, width - 120, 18, 2)
  }
  const provenance = source?.kind === 'model' ? `AI 场景演绎 · ${source.model}` : source ? '用户提供图片' : '图片待完成'
  text(`${provenance}  |  冻结编号 ${frozen.id}  |  统一标题字体 ${font}`, 60, height - 36, width - 120, 14, 1, false, '#53655a')
}
