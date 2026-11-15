import type { Concept } from './concepts.ts'
import { visualSubjectOf } from './conceptVisuals.ts'

export const productStages = {
  sketches: { title: '十款设计草图', role: '资深工业设计师' },
  render: { title: '选款与产品效果图', role: '资深工业设计师' },
  structure: { title: '结构爆炸图', role: '资深结构、模具工程师' },
  tooling: { title: '注塑模具与 DFM', role: '资深结构与注塑模具工程师' },
  packaging: { title: '品牌与包装打样', role: '资深品牌视觉传达设计师' },
} as const
export type ProductStage = keyof typeof productStages
export type ProductAsset = 'style' | 'sheet' | 'selected' | 'hero' | 'exploded' | 'package'
export const styleDirections = {
  marker: { name: '工业马克笔', color: '#517e92', description: 'Professional pencil and cool grey marker sketches, subtle blue shading, white paper, precise contour lines.' },
  space: { name: '轻盈太空风', color: '#7a70ae', description: 'Youthful space-age industrial design, lightweight floating volumes, restrained silver and pale violet accents, precise sketch lines.' },
  organic: { name: '自然与人文', color: '#76875c', description: 'Human-centered organic shapes, warm paper, muted green accents, visible material-conscious construction, refined hand-drawn lines.' },
  minimal: { name: '极简工程线稿', color: '#465258', description: 'Minimal black technical pencil linework, clean perspective, restrained shading, crisp readable white background.' },
} as const
export type StyleDirection = keyof typeof styleDirections
export type EngineeringFile = { id: string; name: string; size: number; digest: string; role: 'product' | 'mould' | 'drawing' | 'other' }
export type ProductWorkflow = {
  stage: ProductStage
  style: StyleDirection
  productName: string
  brand: string
  brandColor: string
  functions: string
  direction: string
  renderNotes: string
  assets: Partial<Record<ProductAsset, string>>
  selection?: number
  confirmedHero?: string
  components: string
  printWidth: number
  engineering: { length: number; width: number; height: number; material: string; wall: number; shrinkage: string; tolerance: string; cavities: number; notes: string; files: EngineeringFile[]; review: string; reviewer: string; confirmedContext?: string }
  packaging: { length: number; width: number; height: number; glue: number; flap: number; bleed: number; stock: string; copy: string; notes: string; reviewer: string; confirmedContext?: string }
}

export function workflowOf(concept: Concept): ProductWorkflow {
  const subject = visualSubjectOf(concept)
  const saved = concept.productWorkflow
  const defaults: ProductWorkflow = {
    stage: 'sketches', style: 'space', productName: subject.title, brand: '', brandColor: '#193c32', functions: subject.sentences.interaction,
    direction: '时尚、前卫、年轻、轻盈、独特的太空风格；重视独创、绿色制造、情感、人文、美学、社会与环境责任。', renderNotes: '',
    assets: {}, components: '', printWidth: 80,
    engineering: { length: 0, width: 0, height: 0, material: '', wall: 0, shrinkage: '', tolerance: '', cavities: 1, notes: '', files: [], review: '', reviewer: '' },
    packaging: { length: 0, width: 0, height: 0, glue: 15, flap: 20, bleed: 3, stock: '', copy: '', notes: '', reviewer: '' },
  }
  return { ...defaults, ...saved, assets: { ...saved?.assets }, engineering: { ...defaults.engineering, ...saved?.engineering }, packaging: { ...defaults.packaging, ...saved?.packaging } }
}

export function workflowContext(concept: Concept, step: ProductAsset): string {
  const data = workflowOf(concept)
  const subject = visualSubjectOf(concept)
  const common = { concept: { title: subject.title, format: subject.format, sentences: subject.sentences, identity: subject.identity }, name: data.productName, brand: data.brand, brandColor: data.brandColor, functions: data.functions, direction: data.direction }
  if (step === 'sheet') return JSON.stringify({ ...common, style: data.style, styleImage: data.assets.style })
  if (step === 'selected') return JSON.stringify({ sheet: data.assets.sheet, selection: data.selection, sheetContext: workflowContext(concept, 'sheet') })
  if (step === 'hero') return JSON.stringify({ ...common, selected: data.assets.selected, selectionContext: workflowContext(concept, 'selected'), renderNotes: data.renderNotes })
  if (step === 'exploded') return JSON.stringify({ ...common, hero: data.assets.hero, heroContext: workflowContext(concept, 'hero'), components: data.components, engineering: { ...data.engineering, files: undefined, review: undefined, reviewer: undefined, confirmedContext: undefined } })
  if (step === 'package') return JSON.stringify({ ...common, hero: data.assets.hero, heroContext: workflowContext(concept, 'hero'), packaging: packagingContext(data) })
  return ''
}

export function engineeringContext(data: ProductWorkflow) {
  const { reviewer: _reviewer, confirmedContext: _confirmed, ...spec } = data.engineering
  return JSON.stringify({ name: data.productName, brand: data.brand, hero: data.assets.hero, selected: data.assets.selected, functions: data.functions, direction: data.direction, components: data.components, spec })
}
export function packagingContext(data: ProductWorkflow) {
  const { confirmedContext: _confirmed, ...spec } = data.packaging
  return JSON.stringify({ name: data.productName, brand: data.brand, brandColor: data.brandColor, hero: data.assets.hero, spec })
}

export function workflowImagePrompt(concept: Concept, step: 'sheet' | 'hero' | 'exploded' | 'package') {
  const data = workflowOf(concept)
  const subject = visualSubjectOf(concept)
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
      'The input reference is ONLY a visual style board, not a product to copy. Explore ten different silhouettes while following the same brief. Professional, readable industrial design sketches.',
      styleDirections[data.style].description,
    ],
    hero: [
      `Development notes (proposals, not verified claims): ${data.renderNotes}`,
      'The reference is ONE selected product sketch. Develop ONLY that chosen design into ONE polished realistic product rendering; do not create a collage or switch to another design.',
      'Preserve its silhouette, proportions, main construction and interaction. Refine plausible material finishes and details. One full product, refined studio lighting, credible joints, light visual weight. Apply only the exact supplied product and brand names.',
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
