import { emptyPcb } from './pcbDrawing.ts'
import type { PcbSpec } from './pcbDrawing.ts'
import type { PageLayout } from './visualStudioTypes.ts'
import type { Concept } from './concepts.ts'
import { visualSubjectOf } from './conceptVisuals.ts'

export const productStages = {
  sketches: { title: '十款设计草图', role: '资深工业设计师' },
  render: { title: '产品效果图（草图可选）', role: '资深工业设计师' },
  pcb: { title: '二维 PCB 工程图', role: '资深电子工程师' },
  structure: { title: '结构爆炸图', role: '资深结构、模具工程师' },
  tooling: { title: '注塑模具与 DFM', role: '资深结构与注塑模具工程师' },
  packaging: { title: '品牌与包装打样', role: '资深品牌视觉传达设计师' },
} as const
export type ProductStage = keyof typeof productStages
export type ProductAsset = 'style' | 'sheet' | 'selected' | 'hero' | 'pcb' | 'exploded' | 'package'
export type EngineeringFile = { id: string; name: string; size: number; digest: string; role: 'product' | 'mould' | 'drawing' | 'other' }
export type ProductWorkflow = {
  outputSizes?: Partial<Record<ProductStage, { layout: PageLayout; width: number; height: number }>>
  stage: ProductStage
  style?: string // Legacy saved preference; no built-in style generator.
  productName: string
  brand: string
  brandColor: string
  functions: string
  direction: string
  heroMode?: 'free' | 'sketch'
  renderNotes: string
  assets: Partial<Record<ProductAsset, string>>
  selection?: number
  confirmedHero?: string
  components: string
  pcb: PcbSpec
  pcbPrintWidth?: number
  printWidth: number
  engineering: { length: number; width: number; height: number; material: string; wall: number; shrinkage: string; tolerance: string; cavities: number; notes: string; files: EngineeringFile[]; review: string; reviewer: string; confirmedContext?: string }
  packaging: { length: number; width: number; height: number; glue: number; flap: number; bleed: number; stock: string; copy: string; notes: string; reviewer: string; confirmedContext?: string }
}

export function workflowOf(concept: Concept): ProductWorkflow {
  const subject = visualSubjectOf(concept)
  const saved = concept.productWorkflow
  const defaults: ProductWorkflow = {
    stage: 'sketches', productName: subject.title, brand: '', brandColor: '#193c32', functions: subject.sentences.interaction,
    direction: '时尚、前卫、年轻、轻盈、独特的太空风格；重视独创、绿色制造、情感、人文、美学、社会与环境责任。', renderNotes: '',
    assets: {}, components: '', printWidth: 80, pcb: { ...emptyPcb },
    engineering: { length: 0, width: 0, height: 0, material: '', wall: 0, shrinkage: '', tolerance: '', cavities: 1, notes: '', files: [], review: '', reviewer: '' },
    packaging: { length: 0, width: 0, height: 0, glue: 15, flap: 20, bleed: 3, stock: '', copy: '', notes: '', reviewer: '' },
  }
  return { ...defaults, ...saved, assets: { ...saved?.assets }, pcb: { ...emptyPcb, ...saved?.pcb }, engineering: { ...defaults.engineering, ...saved?.engineering }, packaging: { ...defaults.packaging, ...saved?.packaging } }
}

export function heroUsesSketch(concept: Concept): boolean {
  const data = workflowOf(concept)
  return data.heroMode === 'sketch' || (data.heroMode !== 'free' && Boolean(data.assets.selected))
}

export function workflowContext(concept: Concept, step: ProductAsset): string {
  const data = workflowOf(concept)
  const subject = visualSubjectOf(concept)
  const common = { concept: { title: subject.title, format: subject.format, sentences: subject.sentences, identity: subject.identity }, name: data.productName, brand: data.brand, brandColor: data.brandColor, functions: data.functions, direction: data.direction }
  if (step === 'sheet') return JSON.stringify({ ...common, styleImage: data.assets.style })
  if (step === 'selected') return JSON.stringify({ sheet: data.assets.sheet, selection: data.selection })
  if (step === 'hero') return JSON.stringify(heroUsesSketch(concept) ? { ...common, selected: data.assets.selected, selectionContext: workflowContext(concept, 'selected'), renderNotes: data.renderNotes } : { ...common, mode: 'free', renderNotes: data.renderNotes })
  if (step === 'pcb') return JSON.stringify({ ...common, hero: data.assets.hero, heroContext: workflowContext(concept, 'hero'), pcb: { ...data.pcb, analysis: undefined } })
  if (step === 'exploded') return JSON.stringify({ ...common, hero: data.assets.hero, heroContext: workflowContext(concept, 'hero'), components: data.components, engineering: { ...data.engineering, files: undefined, review: undefined, reviewer: undefined, confirmedContext: undefined } })
  if (step === 'package') return JSON.stringify({ ...common, hero: data.assets.hero, heroContext: workflowContext(concept, 'hero'), packaging: packagingContext(data) })
  return ''
}

export function selectedSketchMatches(concept: Concept, savedContext: string | undefined) {
  if (!savedContext) return false
  try {
    const saved = JSON.parse(savedContext) as { sheet?: string; selection?: number }
    const current = workflowOf(concept)
    return saved.sheet === current.assets.sheet && saved.selection === current.selection
  } catch { return false }
}

export function engineeringContext(data: ProductWorkflow) {
  const { reviewer: _reviewer, confirmedContext: _confirmed, ...spec } = data.engineering
  return JSON.stringify({ name: data.productName, brand: data.brand, hero: data.assets.hero, selected: data.assets.selected, functions: data.functions, direction: data.direction, components: data.components, spec })
}
export function packagingContext(data: ProductWorkflow) {
  const { confirmedContext: _confirmed, ...spec } = data.packaging
  return JSON.stringify({ name: data.productName, brand: data.brand, brandColor: data.brandColor, hero: data.assets.hero, spec })
}

export function workflowImagePrompt(concept: Concept, step: 'sheet' | 'hero' | 'pcb' | 'exploded' | 'package') {
  const data = workflowOf(concept)
  const subject = visualSubjectOf(concept)
  if (step === 'pcb') {
    const prompt = [
    'ROLE: Senior electronics engineer. Generate a strictly orthographic TWO-DIMENSIONAL PCB top-view engineering assembly drawing. Vector-style technical linework, BLACK LINES ONLY on pure WHITE background. Absolutely NO 3D, perspective, shadows, gradients, photorealism, product hero rendering or decorative space-age styling.',
    `PRODUCT: ${data.productName}; exact brand/name: ${data.brand}. FUNCTIONS: ${data.functions}.`,
    'The reference is the approved exterior product, used ONLY to maintain product identity, enclosure interfaces and plausible PCB fit. It is NOT an existing PCB, schematic, netlist or measured interior. Do not redraw the exterior product as the PCB. Do not invent verified circuit connections or manufacturing readiness.',
    'Show PCB outline and supplied dimensions/tolerances, separately identify PTH plated through holes and NPTH non-plated holes, pads, supplied TOP-layer traces, silkscreen reference designators and component polarity. Use different line weights for outline, copper, silkscreen and dimension lines, tidy leaders and no overlapping callouts. Equal X/Y scale, top orthographic projection only.',
    'Place a clean engineering title block in the BOTTOM RIGHT with drawing number, revision, board thickness, copper thickness, surface finish and designer. Use only supplied values; unknown values must say TO BE CONFIRMED. Do not fabricate dimensions, tolerances, pads, tracks, component values or electrical validation.',
    'High native resolution, legible fine linework. 300 dpi depends on native pixels and print size, not a text label. Mark incomplete input as ENGINEERING REVIEW DRAFT, NOT FOR FABRICATION. Final manufacturing requires verified EDA design, netlist, ERC/DRC, Gerber and drill data.',
    `Supplied PCB data (millimetres, x right/y down, rectangular board; only explicitly supplied entities are authoritative): ${JSON.stringify({ ...data.pcb, analysis: undefined })}`,
  ].join('\n')
    if (prompt.length > 13000) throw new Error('PCB资料过长，请精简后生成示意图，完整图元可通过矢量线稿导出。')
    return prompt
  }
  const common = [
    `ROLE: ${step === 'exploded' ? 'Senior product structure and mould engineer' : step === 'package' ? 'Senior brand and visual communication designer' : 'Senior industrial designer'}.`,
    `PRODUCT: ${data.productName}. BRAND / LOGO TEXT (exact spelling, do not invent): ${data.brand || 'No brand mark supplied; do not invent a logo'}.`,
    `Shared brand accent color: ${data.brandColor}. Keep branding consistent across product and packaging.`,
    `BRIEF: ${subject.sentences.idea}. USER: ${subject.sentences.audience}. SCENE: ${subject.sentences.scenario}.`,
    `FUNCTIONS AND INTERACTION: ${data.functions}. DESIGN DIRECTION: ${data.direction}.`,
    'Distinctive, youthful, fashionable, avant-garde, lightweight space-age design with emotional, humanistic and aesthetic value. Consider inclusive use, repairability, reduced material use, ethical production and environmental responsibility. Treat these as design goals, not certifications or proven claims.',
    'Do not invent technical specifications, performance, certifications, sustainability claims or verified originality. Preserve supplied product identity.',
  ]
  const tasks = {
    sheet: [
      'Create ONE single sketch sheet containing EXACTLY TEN genuinely differentiated product designs, arranged in EXACTLY 2 rows by 5 columns, equal cells, no header or outer margins. Label cells 01–10 at the top left. Keep each product inside its cell, with gutters between cells.',
      data.assets.style ? 'The input reference is ONLY a visual style board, not a product to copy. Explore ten different silhouettes while following the same brief.' : 'No style reference image is supplied. Generate ten differentiated designs directly from the product brief.',
      data.assets.style ? 'Follow the uploaded style reference only. No built-in visual style is applied.' : 'Use professional, readable industrial design sketch linework. No built-in style preset is applied.',
    ],
    hero: [
      `Development notes (proposals, not verified claims): ${data.renderNotes}`,
      heroUsesSketch(concept) ? 'The reference is ONE selected product sketch. Develop ONLY that chosen design into ONE polished realistic product rendering; do not create a collage or switch to another design.' : 'No sketch or reference image is supplied. Design ONE suitable product freely from the concept, actual functions, brand information and rendering notes. Create ONE polished realistic product rendering, not a collage. Do not claim to have read a sketch or image.',
      heroUsesSketch(concept) ? 'Preserve its silhouette, proportions, main construction and interaction. Refine plausible material finishes and details. One full product, refined studio lighting, credible joints, light visual weight. Apply only the exact supplied product and brand names.' : 'Develop a suitable silhouette, proportions, construction and interaction consistent with the concept and actual functions. One full product, refined studio lighting, plausible materials and joints. Apply only the exact supplied product and brand names.',
      'User will review the resulting appearance before it becomes the reference for all downstream drawings and packaging.',
    ],
    exploded: [
      'Use the reference as the approved product appearance. Produce a rigorous, complex, detailed exploded assembly illustration of THE SAME PRODUCT. Preserve external shells, proportions, materials, colors, logo and interfaces exactly. Do not redesign.',
      `Numbered part list supplied by the user (do not invent measured dimensions): ${data.components || 'No verified BOM supplied. Show a conceptual decomposition only, mark all internal details as proposals.'}`,
      `Known engineering inputs: ${JSON.stringify({ ...data.engineering, files: undefined, review: undefined, reviewer: undefined, confirmedContext: undefined })}`,
      'Clear isometric exploded stack, non-overlapping parts, logical assembly axes, numbered callouts and leaders. No fabricated tolerances or machining dimensions. High native resolution, crisp edges. This is an assembly illustration, not production CAD or a verified engineering drawing.',
    ],
    package: [
      'Design ONE realistic exterior packaging mockup consistent with this product design and the supplied brand. The reference is the exact product that must appear on the packaging; no substitute product or newly designed silhouette.',
      `Use ONLY this approved copy: ${data.packaging.copy}. Stock: ${data.packaging.stock}. Presentation notes: ${data.packaging.notes}.`,
      'Fashionable, beautiful, avant-garde brand communication. Show a clear box mockup. This is a visual preview only; manufacturing artwork and dielines are exported separately as editable vector files.',
    ],
  }
  return [...common, ...tasks[step]].join('\n').slice(0, 13800)
}

export function sketchCell(index: number, width: number, height: number) {
  if (!Number.isInteger(index) || index < 0 || index > 9 || !Number.isFinite(width) || !Number.isFinite(height) || width < 5 || height < 2) throw new Error('请选择 01–10 中的一款草图。')
  const left = Math.round(index % 5 * width / 5), right = Math.round((index % 5 + 1) * width / 5)
  const top = Math.round(Math.floor(index / 5) * height / 2), bottom = Math.round((Math.floor(index / 5) + 1) * height / 2)
  return { left, top, width: right - left, height: bottom - top }
}

export function printResolution(pixels: number, widthMm: number) {
  if (!Number.isFinite(widthMm) || widthMm <= 0 || !Number.isFinite(pixels) || pixels < 1) throw new Error('请填写有效的印刷宽度。')
  return pixels * 25.4 / widthMm
}

export function engineeringProblems(data: ProductWorkflow) {
  const spec = data.engineering
  return [
    ![spec.length, spec.width, spec.height, spec.wall].every(value => Number.isFinite(value) && value > 0 && value <= 3000) && '补齐毫米制外形尺寸与壁厚',
    !spec.material.trim() && '填写具体塑料牌号', !spec.shrinkage.trim() && '填写材料供应商确认的收缩率', !spec.tolerance.trim() && '填写关键尺寸与公差要求',
    (!Number.isInteger(spec.cavities) || spec.cavities < 1 || spec.cavities > 128) && '填写 1–128 的整数穴数',
    !spec.files.some(file => file.role === 'product' && /\.(step|stp|iges|igs|x_t|sldprt|prt)$/iu.test(file.name)) && '上传产品三维几何文件',
    !spec.files.some(file => file.role === 'mould' && /\.(step|stp|iges|igs|sldasm|asm)$/iu.test(file.name)) && '上传模具三维总装',
    !spec.files.some(file => file.role === 'drawing' && /\.(dxf|dwg|pdf)$/iu.test(file.name)) && '上传正式加工图纸',
    !spec.review.trim() && '补充 DFM 审查记录',
  ].filter((item): item is string => Boolean(item))
}
