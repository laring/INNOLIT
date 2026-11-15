import type { ProductWorkflow } from './productWorkflow.ts'
import { packagingContext } from './productWorkflow.ts'

const encoder = new TextEncoder()
export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0) }
  return (crc ^ 0xffffffff) >>> 0
}

export function pngDensity(bytes: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
  if (bytes.length < 33 || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) throw new Error('无法写入 PNG 印刷分辨率。')
  if (!Number.isFinite(dpi) || dpi < 300 || dpi > 100000) throw new Error('输出的有效分辨率必须不低于 300 dpi。')
  const density = new Uint8Array(21), view = new DataView(density.buffer)
  view.setUint32(0, 9); density.set(encoder.encode('pHYs'), 4)
  view.setUint32(8, Math.round(dpi / .0254)); view.setUint32(12, Math.round(dpi / .0254)); density[16] = 1
  view.setUint32(17, crc32(density.subarray(4, 17)))
  const chunks: Uint8Array[] = [bytes.subarray(0, 8)]
  let end = false, header = false
  for (let offset = 8; offset < bytes.length;) {
    if (offset + 12 > bytes.length) throw new Error('PNG 数据不完整。')
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0)
    const next = offset + size + 12
    if (next > bytes.length) throw new Error('PNG 数据不完整。')
    const name = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (!header && name !== 'IHDR') throw new Error('PNG 文件头无效。')
    if (name !== 'pHYs') chunks.push(bytes.subarray(offset, next))
    if (name === 'IHDR') { if (header) throw new Error('PNG 文件头重复。'); header = true; chunks.push(density) }
    offset = next
    if (name === 'IEND') { end = true; break }
  }
  if (!end) throw new Error('PNG 数据不完整。')
  const result = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0))
  let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  return result
}

export type BundleFile = { name: string; data: string | Uint8Array }
export function zipFiles(files: BundleFile[]): Uint8Array<ArrayBuffer> {
  if (!files.length || files.length > 128 || new Set(files.map(file => file.name.toLowerCase())).size !== files.length) throw new Error('交付包文件数量或名称无效。')
  const entries = files.map(file => {
    const segments = file.name.replaceAll('\\', '/').split('/')
    if (!file.name || segments[0] === '' || segments.some(part => part === '..' || part === '.') || file.name.includes(':') || Array.from(file.name).some(char => char.codePointAt(0)! < 32)) throw new Error('交付包文件名无效。')
    const name = encoder.encode(file.name), data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data
    if (name.length > 65535) throw new Error('文件名称太长。')
    return { name, data, crc: crc32(data) }
  })
  const contentLength = entries.reduce((size, item) => size + 30 + item.name.length + item.data.length, 0)
  const centralLength = entries.reduce((size, item) => size + 46 + item.name.length, 0)
  if (contentLength + centralLength > 128 * 1024 * 1024) throw new Error('交付包超过 128 MB，请减少附件。')
  const bytes = new Uint8Array(contentLength + centralLength + 22), view = new DataView(bytes.buffer)
  let offset = 0, central = contentLength
  for (const item of entries) {
    view.setUint32(offset, 0x04034b50, true); view.setUint16(offset + 4, 20, true); view.setUint16(offset + 6, 0x800, true)
    view.setUint16(offset + 12, 33, true); view.setUint32(offset + 14, item.crc, true)
    view.setUint32(offset + 18, item.data.length, true); view.setUint32(offset + 22, item.data.length, true); view.setUint16(offset + 26, item.name.length, true)
    bytes.set(item.name, offset + 30); bytes.set(item.data, offset + 30 + item.name.length)
    view.setUint32(central, 0x02014b50, true); view.setUint16(central + 4, 20, true); view.setUint16(central + 6, 20, true); view.setUint16(central + 8, 0x800, true)
    view.setUint16(central + 14, 33, true); view.setUint32(central + 16, item.crc, true)
    view.setUint32(central + 20, item.data.length, true); view.setUint32(central + 24, item.data.length, true); view.setUint16(central + 28, item.name.length, true); view.setUint32(central + 42, offset, true)
    bytes.set(item.name, central + 46); central += 46 + item.name.length; offset += 30 + item.name.length + item.data.length
  }
  view.setUint32(central, 0x06054b50, true); view.setUint16(central + 8, entries.length, true); view.setUint16(central + 10, entries.length, true)
  view.setUint32(central + 12, centralLength, true); view.setUint32(central + 16, contentLength, true)
  return bytes
}

type Point = [number, number]
type Segment = [Point, Point]
const number = (value: number) => Number(value.toFixed(4)).toString()
export const xmlText = (value: string) => value.replace(/[<>&"']/gu, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!)
function copyLines(value: string, width: number, font: number) {
  const lines: string[] = []; let line = '', used = 0
  for (const char of value) {
    const advance = char.codePointAt(0)! <= 127 ? font * .6 : font
    if (char === '\n' || used + advance > width) { lines.push(line); line = ''; used = 0 }
    if (char !== '\n') { line += char; used += advance }
  }
  if (line) lines.push(line)
  return lines
}
function artworkTypography(data: ProductWorkflow) {
  const { length: l, height: h } = data.packaging
  const titleSize = Math.max(3, Math.min(7, l / 16, h / 18)), bodySize = Math.max(2.5, Math.min(4, l / 25, h / 24))
  return { titleSize, bodySize, titles: copyLines(data.productName, l - 10, titleSize), copy: copyLines(data.packaging.copy, l - 10, bodySize) }
}
export function packagingProblem(data: ProductWorkflow) {
  const spec = data.packaging
  if (!data.productName.trim()) return '请填写与产品一致的产品名称。'
  if (![spec.length, spec.width, spec.height].every(value => Number.isFinite(value) && value >= 20 && value <= 1200)) return '请填写 20–1200 mm 的盒体内尺寸。'
  if (!Number.isFinite(spec.glue) || spec.glue < 5 || spec.glue > Math.min(40, spec.length / 2)) return '请调整粘口宽度（5–40 mm，且不超过正面宽度的一半）。'
  if (!Number.isFinite(spec.flap) || spec.flap < 5 || spec.flap > Math.min(spec.length / 3, spec.width)) return '请调整插舌长度（至少 5 mm，且不超过盒深或正面宽度的三分之一）。'
  if (!Number.isFinite(spec.bleed) || spec.bleed < 1 || spec.bleed > 10) return '请填写 1–10 mm 出血。'
  if (!spec.stock.trim()) return '请填写纸材、克重与厚度。'
  if (!spec.copy.trim()) return '请填写已核对的包装文案。'
  const typography = artworkTypography(data)
  if (typography.titles.length > 2 || copyLines(data.brand, spec.length - 10, typography.titleSize * .75).length > 1) return '当前正面太窄，请增大盒体、精简产品名称或品牌文字，再在矢量稿中复核排版。'
  if (typography.copy.length * typography.bodySize * 1.6 > spec.height - 20) return '包装文案超过当前背板容量，请精简文案或增大盒体后导出。'
  return ''
}

export function cartonGeometry(data: ProductWorkflow) {
  const problem = packagingProblem(data)
  if (problem) throw new Error(problem)
  const { length: l, width: d, height: h, glue: g, flap: t, bleed: b } = data.packaging
  const xs = [g, g + l, g + l + d, g + 2 * l + d, g + 2 * (l + d)]
  const y = d + t, bottom = y + h, gap = 1, shoulder = Math.min(8, l / 8)
  const top: Point[] = [[0, y + 3], [g, y]]
  const lower: Point[] = [[xs[4], bottom]]
  function flap(points: Point[], left: number, right: number, base: number, direction: number, main: boolean, absent: boolean) {
    points.push([left, base])
    if (!absent) {
      const edge = base + direction * (main ? d : d * .45)
      points.push([left + gap, edge])
      if (main) points.push([left + shoulder, edge], [left + shoulder, edge + direction * t], [right - shoulder, edge + direction * t], [right - shoulder, edge])
      points.push([right - gap, edge])
    }
    points.push([right, base])
  }
  const folds: Segment[] = xs.slice(0, 4).map(x => [[x, y], [x, bottom]])
  for (let panel = 0; panel < 4; panel++) {
    flap(top, xs[panel], xs[panel + 1], y, -1, panel === 0, panel === 2)
    const part: Point[] = []
    flap(part, xs[panel], xs[panel + 1], bottom, 1, panel === 2, panel === 0)
    lower.push(...part)
    if (panel !== 2) folds.push([[xs[panel], y], [xs[panel + 1], y]])
    if (panel !== 0) folds.push([[xs[panel], bottom], [xs[panel + 1], bottom]])
  }
  folds.push([[xs[0] + shoulder, y - d], [xs[1] - shoulder, y - d]], [[xs[2] + shoulder, bottom + d], [xs[3] - shoulder, bottom + d]])
  // Rebuild the lower boundary left-to-right, then trace it right-to-left to keep a single non-crossing cut outline.
  const bottomEdge = lower.slice(1)
  const boundary: Point[] = [...top, [xs[4], bottom], ...bottomEdge.reverse(), [g, bottom], [0, bottom - 3]]
  const outline = boundary.filter((point, index, all) => !index || point[0] !== all[index - 1][0] || point[1] !== all[index - 1][1])
  return { outline, folds, width: xs[4] + b * 2, height: h + (d + t) * 2 + b * 2, xs, top: y, bottom, bleed: b }
}

function dxfDocument(outline: Point[], folds: Segment[], height: number, title: string) {
  const code: (string | number)[] = [0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1024', 9, '$INSUNITS', 70, 4, 9, '$MEASUREMENT', 70, 1, 0, 'ENDSEC', 0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 5, '10', 330, '0', 100, 'AcDbSymbolTable', 70, 4]
  for (const [index, [layer, color]] of [['0', 7], ['CUT', 1], ['CREASE', 4], ['NOTES', 7]].entries()) code.push(0, 'LAYER', 5, (32 + index).toString(16), 330, '10', 100, 'AcDbSymbolTableRecord', 100, 'AcDbLayerTableRecord', 2, layer, 70, 0, 62, color, 6, 'CONTINUOUS')
  code.push(0, 'ENDTAB', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES', 0, 'LWPOLYLINE', 100, 'AcDbEntity', 8, 'CUT', 100, 'AcDbPolyline', 90, outline.length, 70, 1)
  for (const [x, y] of outline) code.push(10, number(x), 20, number(height - y))
  for (const [[x1, y1], [x2, y2]] of folds) code.push(0, 'LINE', 100, 'AcDbEntity', 8, 'CREASE', 100, 'AcDbLine', 10, number(x1), 20, number(height - y1), 30, 0, 11, number(x2), 21, number(height - y2), 31, 0)
  code.push(0, 'TEXT', 100, 'AcDbEntity', 8, 'NOTES', 100, 'AcDbText', 10, 0, 20, number(height + 8), 40, 3, 1, title, 0, 'ENDSEC', 0, 'EOF')
  return code.join('\r\n') + '\r\n'
}

export function packagingFiles(data: ProductWorkflow, productImageData: string): BundleFile[] {
  const geometry = cartonGeometry(data)
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/u.test(productImageData) || productImageData.length > 12 * 1024 * 1024) throw new Error('包装需嵌入当前产品效果图。')
  const { outline, folds, width, height, xs, top, bleed: b } = geometry
  const points = outline.map(([x, y]) => `${number(x + b)},${number(y + b)}`).join(' ')
  const lines = folds.map(([[x1, y1], [x2, y2]]) => `<line x1="${number(x1 + b)}" y1="${number(y1 + b)}" x2="${number(x2 + b)}" y2="${number(y2 + b)}"/>`).join('')
  const header = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${number(width)}mm" height="${number(height)}mm" viewBox="0 0 ${number(width)} ${number(height)}">`
  const cut = `<g id="CUT" fill="none" stroke="#ff00aa" stroke-width="0.15"><polygon points="${points}"/></g>`
  const crease = `<g id="CREASE" fill="none" stroke="#00a5b5" stroke-width="0.15" stroke-dasharray="2 1">${lines}</g>`
  const dieline = `${header}<title>反插口盒结构草稿，毫米 1:1，待纸材补偿与刀模厂复核</title>${cut}${crease}</svg>`
  const frontX = xs[0] + b, frontY = top + b, l = data.packaging.length, h = data.packaging.height
  const { titleSize: fontSize, bodySize, titles, copy: textLines } = artworkTypography(data)
  const color = /^#[\da-f]{6}$/iu.test(data.brandColor) ? data.brandColor : '#193c32'
  const artwork = `${header}<title>${xmlText(data.productName)}：可编辑包装打样稿</title>
  <defs><clipPath id="front"><rect x="${frontX}" y="${frontY}" width="${l}" height="${h}"/></clipPath></defs>
  <g id="ARTWORK"><polygon points="${points}" fill="#e9eee8"/><rect x="${frontX - b}" y="${frontY - b}" width="${l + b * 2}" height="${h + b * 2}" fill="${color}"/>
  <g clip-path="url(#front)" fill="#ffffff" font-family="Microsoft YaHei, sans-serif"><text x="${frontX + 5}" y="${frontY + fontSize + 5}" font-size="${fontSize * .75}">${xmlText(data.brand)}</text>
  ${titles.map((line, index) => `<text x="${frontX + 5}" y="${frontY + fontSize * 2 + 7 + index * fontSize * 1.2}" font-size="${fontSize}">${xmlText(line)}</text>`).join('')}
  <image x="${frontX + 5}" y="${frontY + h * .25}" width="${Math.max(1, l - 10)}" height="${h * .62}" preserveAspectRatio="xMidYMid meet" xlink:href="${productImageData}"/></g>
  <g id="APPROVED_COPY" fill="${color}" font-family="Microsoft YaHei, sans-serif" font-size="${bodySize}">${textLines.map((line, i) => `<text x="${xs[2] + b + 5}" y="${frontY + 10 + i * bodySize * 1.6}">${xmlText(line)}</text>`).join('')}</g></g>
  <g id="NONPRINT_DIELINE" visibility="hidden">${cut}${crease}</g></svg>`
  const reviewed = data.packaging.confirmedContext === packagingContext(data)
  const readme = `# ${data.productName} 包装打样资料\n\n状态：${reviewed ? '含人工确认记录，请印厂继续做制版检查' : '结构与印刷草稿，待印厂确认'}。\n\n盒型：反插口盒参数模板。盒体内尺寸：${data.packaging.length} × ${data.packaging.width} × ${data.packaging.height} mm。纸材：${data.packaging.stock}。出血：${b} mm。\n\n文件：artwork.svg 为可编辑图文与嵌入的实际产品效果图；dieline.svg / dieline.dxf 为 1:1 毫米刀线及折线，CUT 为裁切、CREASE 为压痕。DXF 是二维交换文件，不是三维 CAD。SVG 中 NONPRINT_DIELINE 默认隐藏，不参与印刷。\n\n必须由印厂核对：纸厚和折弯补偿、插舌与粘口、刀模闭合、内装缓冲和净空、出血与安全边距、文字是否溢出、字体转曲、CMYK/专色与 ICC、覆膜和工艺、条码及法规文案。当前 SVG 保留可编辑文字及 RGB 颜色，没有伪称已转曲或 PDF/X。需要最终制版格式时由印厂转换并出纸样。\n\n包装产品图直接嵌入效果图原件，不由模型重新设计产品。外观与名称仍需人工核对。\n\n确认人：${data.packaging.reviewer || '未填写'}\n备注：${data.packaging.notes}\n`
  return [{ name: 'artwork.svg', data: artwork }, { name: 'dieline.svg', data: dieline }, { name: 'dieline.dxf', data: dxfDocument(outline, folds, height - b * 2, 'REVERSE TUCK CARTON - MM 1:1 - VENDOR REVIEW REQUIRED') }, { name: 'specification.json', data: JSON.stringify({ productName: data.productName, brand: data.brand, ...data.packaging, unit: 'mm', cutLayer: 'CUT', creaseLayer: 'CREASE', artwork: 'RGB editable SVG, prepress required' }, null, 2) }, { name: 'README.md', data: readme }]
}

export function engineeringEnvelope(data: ProductWorkflow) {
  const { length: l, width: w, height: h } = data.engineering
  if (![l, w, h].every(value => Number.isFinite(value) && value > 0 && value <= 3000)) throw new Error('请先填写真实的产品外形尺寸。')
  return dxfDocument([[0, 0], [l, 0], [l, w], [0, w]], [[[0, w + 20], [l, w + 20]], [[l, w + 20], [l, w + 20 + h]], [[l, w + 20 + h], [0, w + 20 + h]], [[0, w + 20 + h], [0, w + 20]]], w + 20 + h, 'PRODUCT ENVELOPE ONLY - NOT MOULD CAVITY OR MACHINING DRAWING')
}
