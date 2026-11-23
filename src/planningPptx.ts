import { zipFiles } from './productionFiles.ts'
import type { BundleFile } from './productionFiles.ts'
import { officialReferences, planningTitles } from './planningReport.ts'
import type { PlanningDraft, PlanningInputs, PlanningKind } from './planningReport.ts'

export type ReportPicture = { title: string; data: Uint8Array; width: number; height: number }
export type ReportSlide = { title: string; lines: string[]; diagram?: string[]; picture?: ReportPicture }
// Fixed-width line wrapping prevents long CJK paragraphs from overflowing editable text boxes.
export function wrapReportText(text: string, width = 33): string[] {
  return text.split(/\r?\n/).flatMap(paragraph => {
    if (!paragraph) return ['']
    const chars = Array.from(paragraph), lines: string[] = []
    let line = '', units = 0
    for (const char of chars) {
      const size = char.codePointAt(0)! < 128 ? .55 : 1
      if (units + size > width) { lines.push(line); line = ''; units = 0 }
      line += char; units += size
    }
    if (line) lines.push(line)
    return lines
  })
}
export function planningSlides(kind: PlanningKind, draft: PlanningDraft, inputs: PlanningInputs, pictures: ReportPicture[] = [], stale = false): ReportSlide[] {
  const slides: ReportSlide[] = [{ title: planningTitles[kind], lines: wrapReportText(`${inputs.product.slice(0, 60) || '产品待确认'}\n内部评审草稿\n${draft.source.slice(0, 80)}\n销售地区：${inputs.markets.slice(0, 40) || '待确认'}\n${stale ? '依据已变化，请复核正文' : '市场、成本及认证结论须结合证据确认'}`).slice(0, 10) }]
  for (const picture of pictures.slice(0, 2)) slides.push({ title: picture.title, lines: ['引用当前概念已保存的产品图，图片不代表工程验证或认证通过。'], picture })
  for (const section of draft.sections) {
    const lines = wrapReportText(section.body)
    for (let offset = 0; offset < lines.length; offset += 10) slides.push({ title: section.title + (offset ? `（续 ${offset / 10 + 1}）` : ''), lines: lines.slice(offset, offset + 10) })
    if (kind === 'product' && section.title === '硬件架构与 PCB 工程') slides.push({ title: 'PCB 硬件架构讨论图', lines: ['功能分区示意，器件、连接关系、参数与电路须由工程师确认。'], diagram: ['输入／传感', '主控与固件', '交互／通信', '供电与保护'] })
    if (section.title === '营销物料与法务预审') slides.push({ title: '营销内容法务预审流程', lines: ['每一项性能、环保和比较性主张均需证据。变更后重新审批并保留发布版本。'], diagram: ['内容与证据', '市场核对', '法务审批', '发布与复审'] })
    if (section.title === '版本规划与落地时间线' || section.title === '认证实施时间表与预算') slides.push({ title: '阶段评审与实施门槛', lines: ['顺序为讨论框架，日期、费用、责任人和适用测试范围需在项目评审中确认。'], diagram: kind === 'product' ? ['MVP', 'EVT／DVT', 'PVT', '量产批准'] : ['适用性评估', '预测试整改', '正式评定', '档案与变更'] })
  }
  for (const reference of officialReferences) slides.push({ title: '官方核查来源', lines: wrapReportText(`${reference.title}\n${reference.url}\n法规入口不是产品认证结论。标准版本、限值、豁免和目标地区的额外义务须单独核实。`, 33) })
  if (slides.length > 100) throw new Error('报告过长，请精简正文后导出。')
  return slides
}
const xml = (text: string) => Array.from(text).filter(char => char.codePointAt(0)! >= 32 || '\t\n\r'.includes(char)).join('').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const emu = (value: number) => Math.round(value * 914400)
const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const ns = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const group = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
function textBox(id: number, text: string[], x: number, y: number, w: number, h: number, size: number, color = '142D3A', fill?: string) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>'}<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="none" lIns="91440" rIns="91440" tIns="91440" bIns="91440"/><a:lstStyle/>${text.map(line => `<a:p><a:pPr><a:lnSpc><a:spcPct val="125000"/></a:lnSpc></a:pPr><a:r><a:rPr lang="zh-CN" sz="${size * 100}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/></a:rPr><a:t xml:space="preserve">${xml(line)}</a:t></a:r><a:endParaRPr lang="zh-CN" sz="${size * 100}"/></a:p>`).join('')}</p:txBody></p:sp>`
}
function rels(items: { id: string; type: string; target: string }[]) {
  return head + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(item => `<Relationship Id="${item.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${item.type}" Target="${xml(item.target)}"/>`).join('')}</Relationships>`
}
export function buildPlanningPptx(slides: ReportSlide[]): Uint8Array<ArrayBuffer> {
  if (!slides.length || slides.length > 100) throw new Error('演示稿页数无效。')
  const files: BundleFile[] = []
  const add = (name: string, data: string | Uint8Array) => files.push({ name, data })
  add('_rels/.rels', rels([{ id: 'rId1', type: 'officeDocument', target: 'ppt/presentation.xml' }]))
  add('ppt/presentation.xml', head + `<p:presentation ${ns}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rMaster"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`)
  add('ppt/_rels/presentation.xml.rels', rels([{ id: 'rMaster', type: 'slideMaster', target: 'slideMasters/slideMaster1.xml' }, ...slides.map((_, i) => ({ id: `rId${i + 1}`, type: 'slide', target: `slides/slide${i + 1}.xml` }))]))
  add('ppt/slideMasters/slideMaster1.xml', head + `<p:sldMaster ${ns}><p:cSld><p:spTree>${group}</p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rLayout"/></p:sldLayoutIdLst></p:sldMaster>`)
  add('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([{ id: 'rLayout', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' }, { id: 'rTheme', type: 'theme', target: '../theme/theme1.xml' }]))
  add('ppt/slideLayouts/slideLayout1.xml', head + `<p:sldLayout ${ns} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${group}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`)
  add('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([{ id: 'rMaster', type: 'slideMaster', target: '../slideMasters/slideMaster1.xml' }]))
  add('ppt/theme/theme1.xml', head + `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="INNO LIT"><a:themeElements><a:clrScheme name="Review">${['dk1','lt1','dk2','lt2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'].map((key,i)=>`<a:${key}><a:srgbClr val="${['142D3A','FFFFFF','235563','F5F7F8','247F84','A66E39','526F8E','828C47','9A6280','77818A','0563C1','954F72'][i]}"/></a:${key}>`).join('')}</a:clrScheme><a:fontScheme name="YaHei"><a:majorFont><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Default"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`)
  slides.forEach((slide, index) => {
    let shapes = textBox(2, wrapReportText(slide.title, index === 0 ? 21 : 27), .65, .5, 12, 1.25, index === 0 ? 36 : 28)
    const relations = [{ id: 'rLayout', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' }]
    if (slide.picture) {
      const picture = slide.picture
      if (!(picture.width > 0 && picture.height > 0) || picture.data.length > 20000000) throw new Error('报告配图尺寸或大小无效。')
      const scale = Math.min(11.8 / picture.width, 4.6 / picture.height), w = picture.width * scale, h = picture.height * scale
      add(`ppt/media/image${index}.png`, picture.data)
      relations.push({ id: 'rImage', type: 'image', target: `../media/image${index}.png` })
      shapes += `<p:pic><p:nvPicPr><p:cNvPr id="3" name="${xml(slide.title)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rImage"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${emu((13.333-w)/2)}" y="${emu(1.65)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
      shapes += textBox(4, slide.lines, .7, 6.35, 12, .55, 13)
    } else {
      shapes += textBox(3, slide.lines, .7, 1.9, 12, slide.diagram ? 2.1 : 4.85, slide.diagram ? 21 : 23)
      if (slide.title === 'PCB 硬件架构讨论图' && slide.diagram) {
        slide.diagram.slice(0, 3).forEach((label, i) => { shapes += textBox(10 + i, [label], 1.2 + i * 4, 3.9, 2.8, .8, 20, 'FFFFFF', '235563'); if (i < 2) shapes += textBox(20 + i, ['→'], 4.15 + i * 4, 4, .7, .6, 20) })
        shapes += textBox(14, ['↑'], 6.2, 4.9, .6, .6, 20) + textBox(15, ['供电与保护'], 5.2, 5.6, 2.8, .8, 20, 'FFFFFF', '235563')
      } else slide.diagram?.forEach((label, i) => { shapes += textBox(10 + i, [label], .8 + i * 3.08, 4.35, 2.65, 1, 20, 'FFFFFF', '235563'); if (i < 3) shapes += textBox(20 + i, ['→'], 3.48 + i * 3.08, 4.45, .4, .7, 20) })
    }
    shapes += textBox(50, [`INNO LIT  /  内部评审草稿                                         ${index + 1} / ${slides.length}`], .7, 7, 12, .35, 11, '536976')
    add(`ppt/slides/slide${index+1}.xml`, head + `<p:sld ${ns}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="F5F7F8"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${group}${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`)
    add(`ppt/slides/_rels/slide${index+1}.xml.rels`, rels(relations))
  })
  add('[Content_Types].xml', head + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((_,i)=>`<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`)
  return zipFiles(files)
}
