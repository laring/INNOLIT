import { containProductImage } from './productImageLayout'
import type { ProductOutputSize } from './productImageLayout'
import { canvasBlob, wrapBoardText } from './conceptBoard'
import { imageByteLimit, imageMime } from './imageGeneration'
import { printResolution, sketchAreaRect } from './productWorkflow'
import type { SketchArea } from './productWorkflow'
import { pngDensity } from './productionFiles'

export function imageDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('图片无法读取。')); reader.readAsDataURL(blob)
  })
}
export async function imageDigest(blob: Blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function validateProductImage(blob: Blob) {
  const mime = imageMime(new Uint8Array(await blob.slice(0, 12).arrayBuffer()))
  if (!mime || blob.size > imageByteLimit) throw new Error('图片应为 8 MB 以内的 PNG、JPEG 或 WebP。')
  const bitmap = await createImageBitmap(blob).catch(() => { throw new Error('图片不能解码。') })
  try { if (bitmap.width > 8192 || bitmap.height > 8192 || bitmap.width * bitmap.height > 24000000) throw new Error('图片应在 2400 万像素以内，边长不超过 8192。') } finally { bitmap.close() }
  return new Blob([blob], { type: mime })
}
export async function selectedSketch(blob: Blob, index: number, area?: SketchArea) {
  const bitmap = await createImageBitmap(blob)
  try {
    const rect = sketchAreaRect(index, bitmap.width, bitmap.height, area), canvas = document.createElement('canvas')
    canvas.width = rect.width; canvas.height = rect.height
    const context = canvas.getContext('2d'); if (!context) throw new Error('当前浏览器无法提取草图。')
    context.drawImage(bitmap, rect.left, rect.top, rect.width, rect.height, 0, 0, rect.width, rect.height)
    return canvasBlob(canvas)
  } finally { bitmap.close() }
}
export async function explodedPrint(blob: Blob, widthMm: number, productName: string, components: string) {
  const bitmap = await createImageBitmap(blob)
  try {
    const dpi = printResolution(bitmap.width, widthMm)
    if (dpi < 300) throw new Error(`原图清晰度不足：该印刷宽度下仅 ${Math.floor(dpi)} dpi。请缩小印刷宽度或提供更高分辨率原图。`)
    const font = Math.max(18, Math.round(bitmap.width / 65)), margin = font * 2
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width
    const context = canvas.getContext('2d'); if (!context) throw new Error('当前浏览器无法绘制标注。')
    context.font = `${font}px "Microsoft YaHei", sans-serif`
    const lines = components.split('\n').map(line => line.trim()).filter(Boolean).flatMap(line => wrapBoardText(line, canvas.width - margin * 2, text => context.measureText(text).width, 1000))
    canvas.height = bitmap.height + margin * 3 + Math.max(1, lines.length) * font * 1.5
    if (canvas.width * canvas.height > 24000000 || canvas.height > 8192) throw new Error('图纸与完整标注超过导出上限，请拆分标注到工程附表。')
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#193c32'; context.font = `600 ${font}px "Microsoft YaHei", sans-serif`; context.textBaseline = 'top'
    context.fillText(productName + ' · 结构爆炸示意', margin, font, canvas.width - margin * 2)
    context.drawImage(bitmap, 0, margin, bitmap.width, bitmap.height)
    context.font = `${font}px "Microsoft YaHei", sans-serif`
    for (const [index, line] of lines.entries()) context.fillText(line, margin, bitmap.height + margin * 1.5 + index * font * 1.5, canvas.width - margin * 2)
    context.fillText('装配与内部结构需工程核对 · 非加工图', margin, canvas.height - font * 2, canvas.width - margin * 2)
    return new Blob([pngDensity(new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer()), dpi)], { type: 'image/png' })
  } finally { bitmap.close() }
}


export async function sizedProductImage(blob: Blob, size: ProductOutputSize) {
  const bitmap = await createImageBitmap(blob)
  try {
    const rect = containProductImage(bitmap.width, bitmap.height, size)
    const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height
    const context = canvas.getContext('2d'); if (!context) throw new Error('当前浏览器无法按尺寸导出图片。')
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, rect.left, rect.top, rect.width, rect.height)
    return canvasBlob(canvas)
  } finally { bitmap.close() }
}


export async function nativePcbPrint(blob: Blob, widthMm: number) {
  const bitmap=await createImageBitmap(blob)
  try {
    const dpi=printResolution(bitmap.width,widthMm)
    if(dpi<300)throw new Error('PCB原图在当前印刷宽度下不足300dpi。')
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height
    const context=canvas.getContext('2d');if(!context)throw new Error('无法读取PCB图纸。')
    context.drawImage(bitmap,0,0)
    return new Blob([pngDensity(new Uint8Array(await(await canvasBlob(canvas)).arrayBuffer()),dpi)],{type:'image/png'})
  }finally{bitmap.close()}
}
