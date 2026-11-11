import type { Concept, ConceptBatch } from './concepts.ts'
import { conceptSourceLabel } from './concepts.ts'
import type { VisualLayout, VisualSource } from './imageGeneration.ts'

export const boardSizes: Record<VisualLayout, [number, number]> = {
  diagram: [1400, 1000],
  landscape: [1600, 1100],
  portrait: [1200, 1600],
}

export type BoardData = {
  projectName: string
  roundNumber: number
  round: ConceptBatch
  concept: Concept
  image?: ImageBitmap
  imageSource?: VisualSource
}

const colors = { paper: '#f5f4ef', ink: '#24392f', muted: '#53655a', line: '#d6ded5', accent: '#46694d', card: '#ffffff' }
const font = '"Microsoft YaHei", "Segoe UI", sans-serif'

export function wrapBoardText(text: string, width: number, measure: (text: string) => number, maxLines: number): string[] {
  const paragraphs = text.replace(/\r/gu, '').split('\n')
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    let line = ''
    for (const character of paragraph) {
      if (line && measure(line + character) > width) {
        const characters = [...line]
        // Keep closing punctuation with the preceding character in Chinese copy.
        if (/^[，。！？、；：）】》,.!?;:)]$/u.test(character) && characters.length > 1) {
          line = characters.pop() ?? ''
          lines.push(characters.join(''))
        } else { lines.push(line); line = '' }
      }
      line += character
    }
    lines.push(line)
  }
  if (lines.length <= maxLines) return lines
  const clipped = lines.slice(0, maxLines)
  let last = clipped.at(-1) ?? ''
  while (last && measure(last + '…') > width) last = [...last].slice(0, -1).join('')
  clipped[maxLines - 1] = last + '…'
  return clipped
}

function text(
  context: CanvasRenderingContext2D, value: string, x: number, y: number, width: number,
  size = 24, maxLines = 3, bold = false, color = colors.ink,
) {
  context.font = `${bold ? 650 : 400} ${size}px ${font}`
  context.fillStyle = color
  const lines = wrapBoardText(value, width, line => context.measureText(line).width, maxLines)
  lines.forEach((line, index) => context.fillText(line, x, y + index * size * 1.5))
}

function card(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, fill = colors.card) {
  context.beginPath()
  context.roundRect(x, y, width, height, 18)
  context.fillStyle = fill
  context.fill()
  context.strokeStyle = colors.line
  context.lineWidth = 1.5
  context.stroke()
}

function diagram(context: CanvasRenderingContext2D, data: BoardData, x: number, y: number, width: number, height: number) {
  const entries = [
    ['01 · 设计问题', data.round.brief.problem],
    ['02 · 核心构想', data.concept.sentences.idea],
    ['03 · 原型验证', data.concept.sentences.test],
  ]
  const gap = 34
  const nodeWidth = (width - gap * 2) / 3
  const size = height > 300 ? 28 : 20
  entries.forEach(([label, value], index) => {
    const left = x + (nodeWidth + gap) * index
    card(context, left, y, nodeWidth, height, index === 1 ? '#e7efe3' : colors.card)
    text(context, label, left + 22, y + 38, nodeWidth - 44, 17, 1, true, colors.accent)
    text(context, value, left + 22, y + 85, nodeWidth - 44, size, Math.max(2, Math.floor((height - 110) / (size * 1.5))))
    if (index < 2) {
      const ax = left + nodeWidth + 7
      const ay = y + height / 2
      context.beginPath()
      context.moveTo(ax, ay)
      context.lineTo(ax + 20, ay)
      context.moveTo(ax + 13, ay - 6)
      context.lineTo(ax + 20, ay)
      context.lineTo(ax + 13, ay + 6)
      context.strokeStyle = colors.accent
      context.lineWidth = 2
      context.stroke()
    }
  })
}

function info(context: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, width: number, maxLines = 3) {
  text(context, label, x, y, width, 18, 1, true, colors.accent)
  text(context, value || '待补充', x, y + 38, width, 23, maxLines)
}

function image(context: CanvasRenderingContext2D, bitmap: ImageBitmap, x: number, y: number, width: number, height: number) {
  card(context, x, y, width, height)
  const scale = Math.min((width - 24) / bitmap.width, (height - 24) / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  context.drawImage(bitmap, x + (width - w) / 2, y + (height - h) / 2, w, h)
}

export function renderConceptBoard(canvas: HTMLCanvasElement, data: BoardData, layout: VisualLayout) {
  const [width, height] = boardSizes[layout]
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法绘制展板。')
  context.fillStyle = colors.paper
  context.fillRect(0, 0, width, height)
  context.textBaseline = 'top'
  text(context, 'INNO LIT  /  CONCEPT STUDIO', 60, 42, width - 120, 17, 1, true, colors.accent)
  text(context, data.concept.title, 60, 91, width - 120, 42, 2, true)
  text(context, `${data.concept.format}  ·  第 ${data.roundNumber} 轮  ·  ${data.projectName}`, 60, 213, width - 120, 20, 1, false, colors.muted)

  if (layout === 'diagram') {
    diagram(context, data, 60, 280, width - 120, 430)
    info(context, '目标用户', data.round.brief.audience, 60, 770, 350, 3)
    info(context, '使用场景', data.round.brief.scenario, 500, 770, 350, 3)
    info(context, '关键差异', data.concept.sentences.difference, 940, 770, 400, 3)
  } else if (layout === 'landscape') {
    if (data.image) image(context, data.image, 60, 270, 850, 560)
    else diagram(context, data, 60, 270, 850, 560)
    info(context, '目标用户与场景', `${data.round.brief.audience}\n${data.round.brief.scenario}`, 970, 280, 550, 4)
    info(context, '设计差异', data.concept.sentences.difference, 970, 470, 550, 4)
    info(context, '关键风险', data.concept.sentences.risk, 970, 655, 550, 3)
    if (data.image) diagram(context, data, 60, 875, 1480, 150)
    else {
      info(context, '预期价值', data.concept.sentences.value, 60, 875, 680, 3)
      info(context, '首轮验证', data.concept.sentences.test, 840, 875, 680, 3)
    }
  } else {
    if (data.image) image(context, data.image, 60, 270, 1080, 600)
    else diagram(context, data, 60, 270, 1080, 600)
    if (data.image) diagram(context, data, 60, 915, 1080, 340)
    else {
      info(context, '预期价值', data.concept.sentences.value, 60, 930, 490, 5)
      info(context, '关键风险', data.concept.sentences.risk, 650, 930, 490, 5)
    }
    info(context, '目标用户与场景', `${data.round.brief.audience}\n${data.round.brief.scenario}`, 60, 1320, 490, 4)
    info(context, '设计差异', data.concept.sentences.difference, 650, 1320, 490, 4)
  }

  const source = layout === 'diagram' ? undefined : data.imageSource
  const visualLabel = source?.kind === 'model'
    ? `AI 生成概念图 · ${source.model}（${source.provider}）`
    : source ? '用户上传概念图' : '本地概念结构图'
  text(context, `${visualLabel}  |  ${conceptSourceLabel(data.round)}`, 60, height - 36, width - 120, 14, 1, false, colors.muted)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('展板导出失败。')),
    'image/png',
  ))
}
