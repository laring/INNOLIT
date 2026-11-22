import type { Concept } from './concepts.ts'
import type { ProductStage, LegacyProductStage } from './productWorkflow.ts'
import type { PageLayout } from './visualStudioTypes.ts'
import { pageSizeProblem, layoutSizes } from './conceptVisuals.ts'
export type ProductOutputSize = { layout: PageLayout; width: number; height: number }
export function productOutputSize(concept: Concept, stage: ProductStage | LegacyProductStage): ProductOutputSize {
  return { layout: 'landscape', width: 1600, height: 1000, ...(concept.productWorkflow?.outputSizes?.[stage] ?? (stage === 'design' ? concept.productWorkflow?.outputSizes?.[concept.productWorkflow.designPhase === 'render' || concept.productWorkflow.stage === 'render' ? 'render' : 'sketches'] : undefined)) }
}
export function productOutputLayout(size: ProductOutputSize, layout: PageLayout): ProductOutputSize {
  if (layout === 'custom') return { ...size, layout }
  const [width, height] = layoutSizes[layout]
  return { layout, width, height }
}
export function containProductImage(width: number, height: number, size: ProductOutputSize) {
  const problem = pageSizeProblem(size)
  if (problem) throw new Error(problem)
  if (![width, height].every(value => Number.isInteger(value) && value > 0)) throw new Error('原图尺寸无效。')
  const scale = Math.min(size.width / width, size.height / height)
  const fittedWidth = width * scale, fittedHeight = height * scale
  return { left: (size.width - fittedWidth) / 2, top: (size.height - fittedHeight) / 2, width: fittedWidth, height: fittedHeight }
}
export function productSizePrompt(size: ProductOutputSize) {
  const problem = pageSizeProblem(size)
  if (problem) throw new Error(problem)
  return `Requested output composition: ${size.width} x ${size.height} px, aspect ratio ${size.width}:${size.height}. Compose for this canvas, keeping the complete product, callouts and all sketch cells inside the frame. Do not stretch, crop or redesign the product to fit. The service may return its supported native resolution; exact canvas dimensions are handled during export.`
}
