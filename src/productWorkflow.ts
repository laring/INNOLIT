import { emptyPcb } from './pcbDrawing.ts'
import type { PcbSpec } from './pcbDrawing.ts'
import type { PageLayout } from './visualStudioTypes.ts'
import type { Concept } from './concepts.ts'
import { visualSubjectOf } from './conceptVisuals.ts'

export const productStages = {
  design: { title: '工业设计与视觉定义', role: '工业设计师、产品经理' },
  structure: { title: '结构爆炸图', role: '资深结构、模具工程师' },
  drawings: { title: '五张结构工程图', role: '资深结构工程师' },
  pcb: { title: '二维 PCB 工程图', role: '资深电子工程师' },
  firmware: { title: '嵌入式软件与工程文档', role: '硬件、嵌入式工程师' },
  packaging: { title: '视觉包装与量产成本', role: '视觉设计师、量产产品经理' },
  compliance: { title: '全球推广与合规', role: '市场、法务经理' },
} as const
export const engineeringViews = { orthographic: '三视图', axonometric: '轴测图', assembly: '装配结构图', section: '局部剖视图', detail: '关键连接与局部详图' } as const
export type EngineeringView = keyof typeof engineeringViews
export type LegacyProductStage = 'sketches' | 'render' | 'tooling'
export function activeProductStage(stage: ProductStage | LegacyProductStage): ProductStage {
  return stage === 'sketches' || stage === 'render' ? 'design' : stage === 'tooling' ? 'structure' : stage in productStages ? stage : 'design'
}
export type ProductStage = keyof typeof productStages
export type ProductAsset = 'style' | 'sheet' | 'selected' | 'hero' | 'presentation' | 'pcb' | 'exploded' | 'package' | EngineeringView
export type EngineeringFile = { id: string; name: string; size: number; digest: string; role: 'product' | 'mould' | 'drawing' | 'other' }
export type SketchArea = { left: number; top: number; width: number; height: number }
export type ProductWorkflow = {
  outputSizes?: Partial<Record<ProductStage | LegacyProductStage, { layout: PageLayout; width: number; height: number }>>
  stage: ProductStage | LegacyProductStage
  designPhase?: 'sketches' | 'render'
  costs?: { values: string[]; fixed: string; quantity: string; yield: string; price: string; notes: string }
  drawingNotes?: string
  firmware?: { mcu: string; toolchain: string; pinMap: string; interfaces: string; requirements: string; draft: string; contextKey?: string; files?: { name: string; data: string }[] }
  style?: string // Legacy saved preference; no built-in style generator.
  productName: string
  brand: string
  brandColor: string
  functions: string
  direction: string
  heroMode?: 'free' | 'sketch'
  englishPrompt?: string
  englishPromptSource?: string
  useEnglishPrompt?: boolean
  renderNotes: string
  assets: Partial<Record<ProductAsset, string>>
  selection?: number
  selectionArea?: SketchArea
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
    stage: 'sketches', designPhase: saved?.stage === 'render' ? 'render' : 'sketches', productName: subject.title, brand: '', brandColor: '#193c32', functions: subject.sentences.interaction,
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
  if (data.useEnglishPrompt !== false && data.englishPrompt) Object.assign(common, { englishPrompt: data.englishPrompt, promptSource: englishPromptSource(concept) })
  if (step === 'presentation') return JSON.stringify({ ...common, hero: data.assets.hero, heroContext: workflowContext(concept, 'hero') })
  if (step === 'sheet') return JSON.stringify({ ...common, styleImage: data.assets.style })
  if (step === 'selected') return JSON.stringify({ sheet: data.assets.sheet, selection: data.selection, area: data.selectionArea })
  if (step === 'hero') return JSON.stringify(heroUsesSketch(concept) ? { ...common, selected: data.assets.selected, selectionContext: workflowContext(concept, 'selected'), renderNotes: data.renderNotes } : { ...common, mode: 'free', renderNotes: data.renderNotes })
  if (step in engineeringViews) return JSON.stringify({ ...common, hero: data.assets.hero, heroContext: workflowContext(concept, 'hero'), drawingNotes: data.drawingNotes, engineering: data.engineering, view: step })
  if (step === 'pcb') return JSON.stringify({ ...common, hero: data.assets.hero, heroContext: workflowContext(concept, 'hero'), pcb: { ...data.pcb, analysis: undefined } })
  if (step === 'exploded') return JSON.stringify({ ...common, hero: data.assets.hero, heroContext: workflowContext(concept, 'hero'), components: data.components, engineering: { ...data.engineering, files: undefined, review: undefined, reviewer: undefined, confirmedContext: undefined } })
  if (step === 'package') return JSON.stringify({ ...common, hero: data.assets.hero, heroContext: workflowContext(concept, 'hero'), packaging: packagingContext(data) })
  return ''
}

export function selectedSketchMatches(concept: Concept, savedContext: string | undefined) {
  if (!savedContext) return false
  try {
    const saved = JSON.parse(savedContext) as { sheet?: string; selection?: number; area?: SketchArea }
    const current = workflowOf(concept)
    return saved.sheet === current.assets.sheet && saved.selection === current.selection && JSON.stringify(saved.area ?? null) === JSON.stringify(current.selectionArea ?? null)
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

export function englishPromptSource(concept: Concept) {
  const data=workflowOf(concept)
  return JSON.stringify({templateVersion:2,renderSize:data.outputSizes?.design??data.outputSizes?.render,subject:visualSubjectOf(concept),name:data.productName,functions:data.functions,direction:data.direction,notes:data.renderNotes})
}

export function fillEnglishPrompt(current: Concept, source: string, englishPrompt: string): Concept {
  const data=workflowOf(current)
  return englishPromptSource(current)===source&&!data.englishPrompt?.trim()&&data.useEnglishPrompt!==false ? {...current,productWorkflow:{...data,englishPrompt,englishPromptSource:source}} : current
}

export function workflowImagePrompt(concept: Concept, step: 'sheet' | 'hero' | 'presentation' | 'pcb' | 'exploded' | 'package' | EngineeringView | EngineeringView) {
  const data = workflowOf(concept)
  const subject = visualSubjectOf(concept)
  const professional = data.useEnglishPrompt !== false && data.englishPrompt ? `ENGLISH DESIGN BRIEF (identity only; engineering constraints take priority): ${data.englishPrompt}` : ''
  if (step in engineeringViews) return [
    professional,
    'COMPOSITION: Fit the COMPLETE drawing, every view, dimension, leader and title block within the central 80% of the canvas. Leave a blank safety margin of at least 10% on all four sides. Reduce the entire drawing scale to fit; never clip a part, annotation or frame.',
    'ROLE: Senior mechanical and mould engineer. Produce ONE independent black-and-white mechanical engineering drawing file. White background, black technical linework, clear line weights, orthographic proportions, legible annotations. No collage combining the five deliverables.',
    `VIEW: ${engineeringViews[step as EngineeringView]}. Orthographic sheet: aligned front/top/side views in this single file; axonometric: line-only isometric; assembly: assembly relationships; section: a labelled local cutaway; detail: critical joints and interfaces. Render only the selected VIEW.`,
    `PRODUCT: ${data.productName}. Reference is the exact approved exterior. Preserve shape, proportions, construction, interfaces and materials. No redesign.`,
    `Supplied dimensions, materials, tolerances: ${JSON.stringify(data.engineering)}. Components: ${data.components}. Additional drawing instructions: ${data.drawingNotes || 'Not supplied'}.`,
    'Draw and annotate using the supplied dimensions, materials, tolerances and drawing notes as the current design parameters, regardless of whether they originated from AI or manual entry. Do not print recommendation/estimate/confirmation categories, review-status labels or warning watermarks. Omit unspecified dimensions instead of inventing values. High native resolution; actual 300dpi is checked against print width.',
  ].join('\n').slice(0,13000)
  if (step === 'pcb') {
    const prompt = [
    professional,
    'COMPOSITION: Fit the COMPLETE board outline, all dimension lines, labels and the bottom-right title block within the central 80% of the canvas. Leave a blank 10% safety margin on every side. Reduce scale to fit; no cropped edges or off-canvas annotations.',
    'ROLE: Senior electronics engineer. Generate a strictly orthographic TWO-DIMENSIONAL PCB top-view engineering assembly drawing. Vector-style technical linework, BLACK LINES ONLY on pure WHITE background. Absolutely NO 3D, perspective, shadows, gradients, photorealism, product hero rendering or decorative space-age styling.',
    `PRODUCT: ${data.productName}; exact brand/name: ${data.brand}. FUNCTIONS: ${data.functions}.`,
    'The reference is the approved exterior product, used ONLY to maintain product identity, enclosure interfaces and plausible PCB fit. It is NOT an existing PCB, schematic, netlist or measured interior. Do not redraw the exterior product as the PCB. Do not invent verified circuit connections or manufacturing readiness.',
    'Show PCB outline and supplied dimensions/tolerances, separately identify PTH plated through holes and NPTH non-plated holes, pads, supplied TOP-layer traces, silkscreen reference designators and component polarity. Use different line weights for outline, copper, silkscreen and dimension lines, tidy leaders and no overlapping callouts. Equal X/Y scale, top orthographic projection only.',
    'Place a clean engineering title block in the BOTTOM RIGHT with drawing number, revision, board thickness, copper thickness, surface finish and designer. Use only supplied values; leave unspecified fields blank. Do not print recommendation, estimate or confirmation-status labels. Do not fabricate dimensions, tolerances, pads, tracks, component values or electrical validation.',
    'High native resolution, legible fine linework. 300 dpi depends on native pixels and print size, not a text label. Render supplied PCB parameters directly without review-status banners, disclaimers or warning watermarks. Do not invent missing electrical data or claim validation.',
    `Supplied PCB data (millimetres, x right/y down, rectangular board; only explicitly supplied entities are authoritative): ${JSON.stringify({ ...data.pcb, analysis: undefined })}`,
  ].join('\n')
    if (prompt.length > 13000) throw new Error('PCB资料过长，请精简后生成示意图，完整图元可通过矢量线稿导出。')
    return prompt
  }
  if(step === 'presentation') return [
    'ROLE: Senior industrial designer and visual communication designer. Create ONE modern, minimal product concept presentation board inspired by international design-award editorial layouts. Not an official iF template or award submission guarantee. No iF logo, award badges or invented certification.',
    'The reference is the APPROVED product. Preserve EXACT silhouette, structure, proportions, materials, colors, interfaces and identity. No redesign, no new features. The primary image must be a real-use hero scene occupying over 50% of the board; supporting close-ups show the same product.',
    'Clean modular grid, generous white space, restrained accent color, consistent modern sans-serif typography. Explain Problem, Insight, Solution, Mechanism, Use Flow and Value with brief accurate captions. No unsupported claims. Keep all product edges and text inside a 10% safety margin.',
    data.useEnglishPrompt !== false && data.englishPrompt ? data.englishPrompt : JSON.stringify(visualSubjectOf(concept)),
  ].join('\n')
  const common = [
    step === 'sheet' ? 'COMPOSITION: Every product must be fully visible within its own equal grid cell, including base, accessories and annotations. Leave at least 10% empty space inside all four edges of EACH cell. Never let a product cross a cell boundary.' : step === 'hero' ? 'COMPOSITION: One intact assembled product only, with a 10% safety margin on all sides; no annotations or additional views.' : 'COMPOSITION: Show the COMPLETE product or exploded assembly including every part, base, accessory, shadow and annotation. Fit the entire composition within the central 80% of the canvas, leaving at least 10% blank safety margin on all four sides. Zoom out and reduce subject scale rather than cutting anything off. No close-up, edge-to-edge framing or cropped product.',
    `ROLE: ${step === 'exploded' ? 'Senior product structure and mould engineer' : step === 'package' ? 'Senior brand and visual communication designer' : 'Senior industrial designer'}.`,
    `PRODUCT: ${data.productName}. ${step === 'sheet' || step === 'hero' ? 'No logos, brand marks or title logos anywhere on this industrial-design image.' : `BRAND / LOGO TEXT: ${data.brand || 'No brand mark supplied'}.`}`,
    `Shared brand accent color: ${data.brandColor}. Keep branding consistent across product and packaging.`,
    data.useEnglishPrompt !== false && data.englishPrompt ? `PROFESSIONAL DESIGN BRIEF: ${data.englishPrompt}` : `BRIEF: ${subject.sentences.idea}. USER: ${subject.sentences.audience}. SCENE: ${subject.sentences.scenario}.`,
    data.useEnglishPrompt !== false && data.englishPrompt ? 'Follow the professional brief above; stage-specific constraints below take precedence.' : `FUNCTIONS AND INTERACTION: ${data.functions}. DESIGN DIRECTION: ${data.direction}.`,
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
      'HIGHEST PRIORITY FOR THIS RENDER: Exactly ONE complete assembled product, ONE static state, ONE 3/4 perspective. Photorealistic materials, soft natural studio lighting and a clean light-colored background. No multiple products, alternate positions, before/after states, split screens, diagrams, cutaways, transparent housings, exploded parts, arrows, callouts, text or logos. If the brief or reference shows multiple states or internal mechanisms, use identity only and show just one intact product. Keep all edges inside the central 80% of the canvas.',
      'Deliver the FINAL selected smart-product HIGH-RESOLUTION hero rendering as a separate image, not a sketch sheet. Fine credible structural details and materials, complete product in frame. Target high industrial-design quality inspired by iF design ambitions without claiming an award, verified originality or production validation. Native pixel resolution must support the selected print size; do not merely print 300dpi as text.',
      `Development notes (proposals, not verified claims): ${data.renderNotes}`,
      heroUsesSketch(concept) ? 'The reference is ONE selected product sketch. Develop ONLY that chosen design into ONE polished realistic product rendering; do not create a collage or switch to another design.' : 'No sketch or reference image is supplied. Design ONE suitable product freely from the concept, actual functions, brand information and rendering notes. Create ONE polished realistic product rendering, not a collage. Do not claim to have read a sketch or image.',
      heroUsesSketch(concept) ? 'Preserve its silhouette, proportions, main construction and interaction. Refine plausible material finishes and details. One full product, refined studio lighting, credible joints, light visual weight. Apply only the exact supplied product and brand names.' : 'Develop a suitable silhouette, proportions, construction and interaction consistent with the concept and actual functions. One full product, refined studio lighting, plausible materials and joints. Apply only the exact supplied product and brand names.',
      'User will review the resulting appearance before it becomes the reference for all downstream drawings and packaging.',
    ],
    exploded: [
      'Use the reference as the approved product appearance. Produce a rigorous, complex, detailed exploded assembly illustration of THE SAME PRODUCT. Preserve external shells, proportions, materials, colors, logo and interfaces exactly. Do not redesign.',
      `Numbered part list supplied by the user (do not invent measured dimensions): ${data.components || 'No verified BOM supplied. Show a conceptual decomposition only, mark all internal details as proposals.'}`,
      `Current design parameters (use provided values directly; no recommendation or confirmation-status labels): ${JSON.stringify({ ...data.engineering, files: undefined, review: undefined, reviewer: undefined, confirmedContext: undefined })}`,
      'Clear isometric exploded stack, non-overlapping parts, logical assembly axes, numbered callouts and leaders. No fabricated tolerances or machining dimensions. High native resolution, crisp edges. This is an assembly illustration, not production CAD or a verified engineering drawing.',
    ],
    package: [
      'Design ONE realistic exterior packaging mockup consistent with this product design and the supplied brand. The reference is the exact product that must appear on the packaging; no substitute product or newly designed silhouette.',
      `Use ONLY this approved copy: ${data.packaging.copy}. Stock: ${data.packaging.stock}. Presentation notes: ${data.packaging.notes}.`,
      'Fashionable, beautiful, avant-garde brand communication. Show a clear box mockup. This is a visual preview only; manufacturing artwork and dielines are exported separately as editable vector files.',
    ],
  }
  return [...common, ...tasks[step as keyof typeof tasks]].join('\n').slice(0, 13800)
}

export function sketchCell(index: number, width: number, height: number) {
  if (!Number.isInteger(index) || index < 0 || index > 9 || !Number.isFinite(width) || !Number.isFinite(height) || width < 5 || height < 2) throw new Error('请选择 01–10 中的一款草图。')
  const left = Math.round(index % 5 * width / 5), right = Math.round((index % 5 + 1) * width / 5)
  const top = Math.round(Math.floor(index / 5) * height / 2), bottom = Math.round((Math.floor(index / 5) + 1) * height / 2)
  return { left, top, width: right - left, height: bottom - top }
}

export function sketchAreaRect(index: number, width: number, height: number, area?: SketchArea) {
  const fallback = sketchCell(index, width, height)
  if (!area) return fallback
  if (![area.left, area.top, area.width, area.height].every(Number.isFinite) || area.left < 0 || area.top < 0 || area.width < 1 || area.height < 1 || area.left + area.width > 100.001 || area.top + area.height > 100.001) throw new Error('请框选原图内的完整草图，宽高至少为原图的 1%。')
  const left = Math.round(width * area.left / 100), top = Math.round(height * area.top / 100)
  const right = Math.min(width, Math.round(width * (area.left + area.width) / 100)), bottom = Math.min(height, Math.round(height * (area.top + area.height) / 100))
  if (right <= left || bottom <= top) throw new Error('框选区域过小，请重新选择。')
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
