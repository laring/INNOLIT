import { useState } from 'react'
import type { Concept } from './concepts'
import type { ModelSettings } from './modelGeneration'
import { hasModelSettings } from './modelGeneration'
import { workflowOf } from './productWorkflow'
import type { PcbSpec } from './pcbDrawing'
import { pcbSvg, pcbGeometry } from './pcbDrawing'
import type { ProductOutputSize } from './productImageLayout'
import { useModelTask } from './useModelTask'
import { analyzeEngineering } from './engineeringModel'
import { downloadBlob, canvasBlob } from './conceptBoard'
import { pngDensity } from './productionFiles'
import { printResolution } from './productWorkflow'

const metadataFields = { tolerance: '板框尺寸公差', thickness: '板厚（含单位）', copper: '铜厚／叠层（含单位）', finish: '表面工艺', drawingNo: '图号', revision: '版本', designer: '设计者' } as const
const geometryFields = {
  holes: ['PTH／NPTH 孔位', '孔号|PTH或NPTH|X|Y|孔径|焊盘外径（NPTH填0）'],
  pads: ['顶层焊盘', '编号|X|Y|宽|高|极性（无则-）|网络名'],
  tracks: ['顶层线路', '网络名|线宽|X,Y;X,Y;…'],
  components: ['元件轮廓与丝印', '位号|X|Y|宽|高|极性（无则-）'],
} as const
export function PcbDrawingPanel({ concept, settings, outputSize, disabled, heroReady, onEdit }: { concept: Concept; settings: ModelSettings; outputSize: ProductOutputSize; disabled: boolean; heroReady: boolean; onEdit: (update: (current: Concept) => Concept) => void }) {
  const spec = workflowOf(concept).pcb
  const task = useModelTask()
  const [compiled, setCompiled] = useState<{ svg: string; key: string }>()
  const [notice, setNotice] = useState('')
  const key = JSON.stringify([workflowOf(concept).productName, spec, outputSize, workflowOf(concept).assets.hero, heroReady])
  const fresh = compiled?.key === key && heroReady
  function save(patch: Partial<PcbSpec>) { onEdit(current => ({ ...current, productWorkflow: { ...workflowOf(current), pcb: { ...workflowOf(current).pcb, ...patch } } })) }
  function compile() {
    try { if(!heroReady) throw new Error('请先在第一步确认产品外观。'); const geometry=pcbGeometry(spec); setCompiled({svg:pcbSvg(workflowOf(concept).productName,spec,outputSize),key});setNotice(`矢量审查稿已生成：${geometry.holes.length} 个孔、${geometry.pads.length} 个焊盘、${geometry.tracks.length} 条顶层线路、${geometry.components.length} 个元件；仅绘制已输入图元。`) }
    catch(error){setNotice(error instanceof Error?error.message:'PCB 图纸生成失败。')}
  }
  async function rasterize() {
    if(!compiled || !fresh) return
    const widthMm=workflowOf(concept).pcbPrintWidth || 80
    const dpi=printResolution(outputSize.width,widthMm)
    if(dpi<300) throw new Error('当前输出像素与印刷宽度不足300dpi，请增加像素宽度或缩小印刷宽度。')
    const url=URL.createObjectURL(new Blob([compiled.svg],{type:'image/svg+xml'}))
    try {
      const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('矢量图无法转成PNG。'));image.src=url})
      const canvas=document.createElement('canvas');canvas.width=outputSize.width;canvas.height=outputSize.height
      const context=canvas.getContext('2d');if(!context)throw new Error('无法创建PCB图纸画布。')
      context.drawImage(image,0,0,canvas.width,canvas.height)
      downloadBlob(new Blob([pngDensity(new Uint8Array(await(await canvasBlob(canvas)).arrayBuffer()),dpi)],{type:'image/png'}),'INNO-LIT-PCB-二维工程审查稿-300dpi.png')
    } finally {URL.revokeObjectURL(url)}
  }
  return <section className="studio-refinement" aria-labelledby="pcb-data-heading"><h4 id="pcb-data-heading">PCB 参数与矢量工程线稿</h4>
    <p>单位 mm，原点在左上，X 向右、Y 向下；仅绘制录入的真实数据。</p>
    <fieldset disabled={disabled || task.pending} className="development-fields">
      <div className="workflow-parameter-grid">{(['length','width'] as const).map(field=><label className="studio-field" key={field}>{field==='length'?'PCB 板长（mm）':'PCB 板宽（mm）'}<input type="number" min={5} max={500} step="any" value={spec[field]||''} onChange={event=>save({[field]:event.target.valueAsNumber||0})}/></label>)}
        {Object.entries(metadataFields).map(([field,label])=><label className="studio-field" key={field}>{label}<input maxLength={35} value={spec[field as keyof typeof metadataFields]} onChange={event=>save({[field]:event.target.value})}/></label>)}
      </div>
      {Object.entries(geometryFields).map(([field,[label,format]])=><label className="studio-field" key={field}>{label}<textarea rows={3} maxLength={8000} value={spec[field as keyof typeof geometryFields]} placeholder={format+'；每行一项，数值为毫米'} onChange={event=>save({[field]:event.target.value})}/></label>)}
      <label className="studio-field">电子工程要求与装配约束<textarea rows={4} maxLength={8000} value={spec.notes} onChange={event=>save({notes:event.target.value})}/></label>
    </fieldset>
    <div className="studio-actions"><button type="button" className="studio-button" disabled={disabled||task.pending||!hasModelSettings(settings)} onClick={()=>void task.run(signal=>analyzeEngineering(concept,'pcb',settings,signal),analysis=>save({analysis:`模型建议（${settings.model}，仅基于文字参数，待人工核对）：\n${analysis}`.slice(0,8000)}),'电子工程审查建议已保存，请人工核对。')}>AI 审查参数</button>{task.pending&&<button type="button" className="studio-button" onClick={task.cancel}>取消审查</button>}
      <button type="button" className="studio-button primary" disabled={disabled||task.pending||!heroReady} onClick={compile}>生成矢量线稿</button></div>
    <label className="studio-field">AI 分析与人工修正<textarea rows={6} maxLength={8000} disabled={disabled||task.pending} value={spec.analysis} onChange={event=>save({analysis:event.target.value})}/></label>
    <p role="status" className="studio-hint">{task.notice||notice}</p>
    {compiled&&<><p className="studio-hint">{fresh?'矢量稿使用当前输入。':'输入、产品基准或版式已变化，请重新生成矢量线稿。'}</p><PcbSvgPreview svg={compiled.svg}/><div className="studio-actions"><button type="button" className="studio-button" disabled={!fresh||disabled} onClick={()=>downloadBlob(new Blob([compiled.svg],{type:'image/svg+xml'}),'INNO-LIT-PCB-二维工程审查稿.svg')}>下载可编辑 SVG</button><button type="button" className="studio-button" disabled={!fresh||disabled} onClick={()=>downloadBlob(new Blob([JSON.stringify({status:'engineering-review-draft-not-for-fabrication',unit:'mm',origin:'top-left; x right, y down',outline:'rectangle',productName:workflowOf(concept).productName,referenceHero:workflowOf(concept).assets.hero,pcb:spec},null,2)],{type:'application/json'}),'INNO-LIT-PCB-工程参数.json')}>下载 PCB 参数 JSON</button><button type="button" className="studio-button" disabled={!fresh||disabled||task.pending} onClick={()=>void task.run(rasterize,()=>{},'已导出不少于300dpi的矢量转PNG图纸。')}>导出矢量转 PNG（≥300 dpi）</button></div></>}
    <details><summary>制图与投产说明</summary><p className="studio-hint">SVG 原始图幅宽297mm，图纸比例按该图幅标注；PNG或缩放打印需另计实际比例。SVG 为可编辑矢量线稿，右下角含工程信息栏；不等于已通过电子制图标准审查或 PCB 生产光绘文件。投产前还需原理图、网表、叠层、ERC／DRC、Gerber、钻孔文件和板厂审核。</p>
    <a href="https://docs.kicad.org/9.0/en/pcbnew/pcbnew.html" target="_blank" rel="noreferrer">查看 EDA 制造输出与设计规则检查说明</a></details>
  </section>
}
function PcbSvgPreview({svg}:{svg:string}){
  return <img className="workflow-artwork-preview" src={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)} alt="PCB二维矢量工程审查稿预览"/>
}
