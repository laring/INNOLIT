import { wrapBoardText } from './conceptBoard.ts'
import { pageSizeProblem, productSketchOf, visualPages } from './conceptVisuals.ts'
import type { VisualPageRole, VisualPageSettings, VisualSubject } from './visualStudioTypes.ts'
import type { VisualSource } from './imageGeneration.ts'

type Rect = [number, number, number, number]
const ink = '#243d32'

export function visualGeometry(page: VisualPageSettings, role: VisualPageRole) {
  const problem = pageSizeProblem(page)
  if (problem) throw new Error(problem)
  const { width: w, height: h } = page
  const u = Math.min(w, h) / 1000
  const margin = 45 * u
  const compact = h / w < 1.25
  const top = (compact ? 180 : 235) * u
  const wide = w / h >= 1.25
  const hero: Rect = role === 'story'
    ? [margin, top, w - margin * 2, h * .58]
    : wide ? [w * .38, top, w * .62 - margin, h - top - 65 * u]
      : [margin, top, w - margin * 2, (h - top - 60 * u) * .58]
  return { u, margin, top, wide, hero, compact }
}

function box(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, radius = 20) {
  context.beginPath(); context.roundRect(x, y, w, h, radius); context.fillStyle = fill; context.fill()
}
function stroke(context: CanvasRenderingContext2D, points: [number, number][], color = ink, width = 4) {
  context.beginPath(); points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y))
  context.strokeStyle = color; context.lineWidth = width; context.lineCap = 'round'; context.lineJoin = 'round'; context.stroke()
}

function product(context: CanvasRenderingContext2D, subject: VisualSubject, x: number, y: number, scale: number, angle = 0) {
  const design = productSketchOf(subject)
  context.save(); context.translate(x, y); context.rotate(angle); context.scale(scale, scale)
  if (design.kind === 'vessel') {
    context.fillStyle = design.main; context.beginPath(); context.moveTo(-74, -90); context.lineTo(74, -90); context.lineTo(57, 88); context.quadraticCurveTo(0, 110, -57, 88); context.closePath(); context.fill()
    context.fillStyle = design.accent; context.beginPath(); context.ellipse(0, -90, 74, 22, 0, 0, Math.PI * 2); context.fill()
    stroke(context, [[-38, -47], [-30, 54]], '#ffffff90', 9)
    box(context, -35, -5, 70, 45, '#f7f4e7', 10)
  } else if (design.kind === 'cards') {
    box(context, -110, -65, 185, 135, '#cfdbc7', 15)
    box(context, -90, -82, 185, 135, design.accent, 15)
    box(context, -70, -100, 185, 135, design.main, 15)
    for (let i = 0; i < 3; i++) stroke(context, [[-40, -62 + i * 25], [75, -62 + i * 25]], '#ffffffb0', 8)
  } else {
    box(context, -118, -72, 236, 150, '#c6d2c4', 27)
    box(context, -118, -87, 236, 150, design.main, 27)
    box(context, -98, -66, 196, 108, '#eff3e8', 20)
    context.beginPath(); context.arc(0, -13, design.kind === 'soundbox' ? 28 : 35, 0, Math.PI * 2)
    context.strokeStyle = design.accent; context.lineWidth = 10; context.stroke()
    if (design.kind === 'soundbox') {
      context.fillStyle = design.main; context.beginPath(); context.arc(0, -13, 17, 0, Math.PI * 2); context.fill()
      stroke(context, [[0, -13], [32, -43], [52, -43]], design.main, 8)
    } else stroke(context, [[0, -13], [0, -36], [19, -13]], design.main, 7)
  }
  context.fillStyle = design.kind === 'vessel' ? design.main : '#eff3e8'
  context.beginPath(); context.arc(design.kind === 'vessel' ? 0 : 83, design.kind === 'vessel' ? 15 : 40, 5, 0, Math.PI * 2); context.fill()
  context.restore()
}

function scene(context: CanvasRenderingContext2D, subject: VisualSubject, role: VisualPageRole, rect: Rect) {
  const [x, y, w, h] = rect
  context.save(); context.beginPath(); context.roundRect(x, y, w, h, 22); context.clip()
  context.fillStyle = role === 'interaction' ? '#e8eee4' : '#e2ece4'; context.fillRect(x, y, w, h)
  const scale = Math.min(w / 1000, h / 720)
  context.translate(x + (w - 1000 * scale) / 2, y + (h - 720 * scale) / 2); context.scale(scale, scale)
  if (role === 'interaction') {
    box(context, 65, 70, 870, 580, '#f5f6ed', 36)
    product(context, subject, 480, 370, 2.1, -.12)
    stroke(context, [[735, 545], [688, 465], [636, 429]], '#d1aa8b', 52)
    stroke(context, [[215, 400], [215, 244], [280, 244]], '#708e77', 8)
    stroke(context, [[260, 225], [280, 244], [260, 263]], '#708e77', 8)
    context.font = '600 25px "Microsoft YaHei", sans-serif'; context.fillStyle = ink
    context.fillText(/翻面/u.test(subject.sentences.interaction + subject.sentences.idea) ? '翻面 / 启动' : '取用 / 操作', 122, 160)
    context.fillText('关键动作示意', 680, 590)
  } else {
    const outdoors = /户外|公园|自然|野外/u.test(subject.sentences.scenario)
    box(context, 70, 60, 290, 235, '#f5f8ef', 28)
    if (outdoors) {
      for (const px of [135, 280]) {
        stroke(context, [[px, 270], [px, 160]], '#9fae8a', 12)
        context.fillStyle = '#c1d2ac'; context.beginPath(); context.arc(px, 150, 58, 0, Math.PI * 2); context.fill()
      }
    } else {
      stroke(context, [[215, 65], [215, 295]], '#d1decf', 7)
      stroke(context, [[70, 177], [360, 177]], '#d1decf', 7)
    }
    context.fillStyle = '#cfdbce'; context.fillRect(0, 540, 1000, 180)
    const personX = role === 'story' ? 310 : 665
    context.fillStyle = '#d4ac89'; context.beginPath(); context.arc(personX, 245, 58, 0, Math.PI * 2); context.fill()
    box(context, personX - 86, 305, 172, 225, '#6d8977', 55)
    stroke(context, [[personX - 42, 500], [personX - 65, 650]], '#556a5b', 36)
    stroke(context, [[personX + 38, 500], [personX + 58, 650]], '#556a5b', 36)
    box(context, 110, 455, 780, 45, '#b7b69d', 13)
    stroke(context, [[190, 500], [160, 670]], '#9fa58c', 15)
    stroke(context, [[810, 500], [840, 670]], '#9fa58c', 15)
    const productX = role === 'story' ? 610 : 390
    product(context, subject, productX, 412, 1.05, role === 'story' ? .08 : -.1)
    stroke(context, [[personX + (role === 'story' ? 60 : -60), 353], [productX + 75, 400]], '#d4ac89', 30)
    box(context, role === 'story' ? 620 : 450, 110, 285, 70, '#ffffffd9', 18)
    context.font = '600 25px "Microsoft YaHei", sans-serif'; context.fillStyle = ink
    context.fillText(role === 'story' ? '让概念进入使用情境' : '用户 × 产品 × 场景', role === 'story' ? 640 : 470, 134)
  }
  context.restore()
}

export function renderVisualPage(canvas: HTMLCanvasElement, subject: VisualSubject, role: VisualPageRole, page: VisualPageSettings, picture?: ImageBitmap, source?: VisualSource) {
  const geometry = visualGeometry(page, role)
  const { u, margin, top, wide, hero, compact } = geometry
  canvas.width = page.width; canvas.height = page.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法绘制概念图。')
  const font = productSketchOf(subject).titleFont
  const text = (value: string, x: number, y: number, width: number, size = 25 * u, lines = 3, bold = false, color = ink) => {
    context.font = `${bold ? 700 : 400} ${size}px "${font}", sans-serif`; context.fillStyle = color
    wrapBoardText(value, width, line => context.measureText(line).width, lines).forEach((line, index) => context.fillText(line, x, y + index * size * 1.45))
  }
  context.fillStyle = '#f7f6f0'; context.fillRect(0, 0, page.width, page.height); context.textBaseline = 'top'
  text('INNO LIT  /  CONCEPT STUDIO', margin, 30 * u, page.width - margin * 2, 17 * u, 1, true, '#54725e')
  text(subject.title, margin, 72 * u, page.width - margin * 2, 42 * u, compact ? 1 : 2, true)
  text(`${visualPages[role]}  ·  ${subject.format}  ·  ${subject.version}`, margin, (compact ? 140 : 195) * u, page.width - margin * 2, 18 * u, 1)
  if (picture) {
    const [x, y, w, h] = hero
    const scale = Math.max(w / picture.width, h / picture.height)
    const sw = w / scale; const sh = h / scale
    context.save(); context.beginPath(); context.roundRect(x, y, w, h, 22 * u); context.clip()
    context.drawImage(picture, (picture.width - sw) / 2, (picture.height - sh) / 2, sw, sh, x, y, w, h); context.restore()
  } else scene(context, subject, role, hero)

  const items = role === 'overview' ? [
    ['为什么需要', subject.sentences.problem], ['概念是什么', subject.sentences.idea], ['带来的价值', subject.sentences.value],
  ] : role === 'interaction' ? [
    ['关键机制', subject.identity?.structure || subject.mechanism], ['如何使用', subject.identity?.interaction || subject.useFlow], ['设计特点', subject.sentences.difference],
  ] : [
    ['问题', subject.sentences.problem], ['洞察', subject.insight], ['方案', subject.sentences.idea],
    ['机制', subject.mechanism], ['使用流程', subject.useFlow], ['价值', subject.sentences.value],
  ]
  const area: Rect = role !== 'story' && wide ? [margin, top, page.width * .33 - margin, page.height - top - 65 * u]
    : [margin, hero[1] + hero[3] + 35 * u, page.width - margin * 2, page.height - hero[1] - hero[3] - 100 * u]
  const columns = role === 'story' ? 3 : wide ? 1 : 3
  const rows = Math.ceil(items.length / columns)
  const cellW = area[2] / columns
  const cellH = area[3] / rows
  items.forEach(([label, value], index) => {
    const left = area[0] + (index % columns) * cellW
    const y = area[1] + Math.floor(index / columns) * cellH
    const bodySize = Math.min((role === 'story' ? 20 : 24) * u, cellW / 12, Math.max(10 * u, (cellH - 42 * u) / 4.2))
    text(label, left, y, cellW - 20 * u, 18 * u, 1, true, '#54725e')
    text(page.description && index === items.length - 1 ? page.description : value, left, y + 33 * u, cellW - 20 * u, bodySize, Math.max(1, Math.floor((cellH - 40 * u) / (bodySize * 1.45))))
  })
  const sourceText = source?.kind === 'model' ? `AI 生成 · ${source.model}` : source?.kind === 'upload' ? '用户上传图片' : '本地概念示意 · 非 AI'
  text(`${sourceText}  |  ${page.width} × ${page.height} px`, margin, page.height - 32 * u, page.width - margin * 2, 13 * u, 1, false, '#637265')
}
