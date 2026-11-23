import { useState, useEffect, useRef } from 'react'
import { draftSolids, primitiveKinds, writeAppearanceStep } from './appearanceStep'
import type { DraftPart } from './appearanceStep'
import { zipFiles } from './productionFiles'
import { downloadBlob } from './conceptBoard'

const labels = {box:'长方体','cylinder-z':'圆柱 · Z 向','cylinder-y':'圆柱 · Y 向'}
type Row = DraftPart & { id: number }

export function AppearanceStepPanel({appearanceId, productName, explodedId, suggest}: {
  appearanceId: string; productName: string; explodedId?: string; suggest?: (signal: AbortSignal) => Promise<DraftPart[]>
}) {
  const [parts,setParts] = useState<Row[]>([])
  const nextId = useRef(0)
  const row = (part: DraftPart): Row => ({...part,id:++nextId.current})
  function update(id: number, patch: Partial<DraftPart>) {
    setParts(current=>current.map(part=>part.id===id ? {...part,...patch} : part))
    setConfirmed(false)
  }
  const [notice,setNotice] = useState('')
  const [confirmed,setConfirmed] = useState(false)
  const [busy,setBusy] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  async function fill() {
    if (!suggest || request.current || parts.length) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setNotice('正在分析当前效果图…')
    try {
      const draft = await suggest(controller.signal)
      if (controller.signal.aborted) return
      setParts(draft.map(row))
      setConfirmed(false)
      setNotice('AI 已生成零件参数草稿。请按实物或规格修正。')
    } catch (error) {
      if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : '生成参数草稿失败。')
    } finally {
      request.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  const rowsForExport = () => parts.map(({name,kind,origin,size})=>({name,kind,origin,size}))
  function generate(parts: boolean) {
    try {
      if (!confirmed || (parts && !explodedId)) throw new Error('请先确认零件参数。逐件导出需要对应版本的爆炸图。')
      const confirmedParts = rowsForExport()
      const solids = draftSolids(confirmedParts)
      if (!parts) {
        downloadBlob(new Blob([writeAppearanceStep(solids)],{type:'model/step'}),'appearance-draft.step')
      } else {
        const files = solids.map(solid=>({name:solid.id+'.step', data:writeAppearanceStep([solid])}))
        const manifest = {targetStage:'04', status:'concept-draft', units:'mm', appearanceId, explodedId,
          coordinateSystem:'X width, Y front to rear, Z up; assembled positions',
          productName, parts:confirmedParts.map((part,i)=>({...part,file:files[i].name}))}
        downloadBlob(new Blob([zipFiles([...files,{name:'appearance-manifest.json',data:JSON.stringify(manifest,null,2)}])],
          {type:'application/zip'}),'part-step-drafts.zip')
      }
      setNotice(parts ? '零件 STEP 草模已导出，保留整机装配坐标。' : '整机 STEP 草模已导出。')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '生成 STEP 失败。')
    }
  }
  return <details className="studio-refinement">
    <summary>生成 STEP · {productName.trim() || '当前产品'}草模</summary>
    <p>按当前造型建立零件。坐标是零件包围盒最小点，X 为宽、Y 为深、Z 为高，单位为毫米。</p>
    <button type="button" className="studio-button" disabled={!suggest || busy || parts.length > 0} onClick={() => void fill()}>AI 生成零件参数草稿</button>
    {!suggest && <p>请在 AI 模型中心的「工业设计 · STEP 参数草稿」配置支持图片输入的模型。</p>}
    <fieldset className="development-fields" disabled={busy}>
      {parts.map((part,index)=><fieldset key={part.id} className="workflow-parameter-grid">
        <legend>零件 {index+1}</legend>
        <label className="studio-field">名称<input value={part.name} maxLength={80} onChange={e=>update(part.id,{name:e.target.value})}/></label>
        <label className="studio-field">形体<select value={part.kind} onChange={e=>update(part.id,{kind:e.target.value as DraftPart['kind']})}>
          {primitiveKinds.map(kind=><option key={kind} value={kind}>{labels[kind]}</option>)}
        </select></label>
        {(['origin','size'] as const).flatMap(key=>['X','Y','Z'].map((axis,i)=>
          <label className="studio-field" key={key+axis}>{key==='origin'?'位置':'尺寸'} {axis}（mm）
            <input type="number" min={key==='origin'?-2000:1} max={2000} step="any" value={Number.isFinite(part[key][i])?part[key][i]:''} onChange={e=>{
              const vector: DraftPart[typeof key] = [...part[key]]
              vector[i] = e.target.valueAsNumber
              update(part.id,{[key]:vector})
            }}/>
          </label>))}
        <button type="button" className="studio-button" onClick={()=>{setParts(current=>current.filter(item=>item.id!==part.id));setConfirmed(false)}}>移除零件</button>
      </fieldset>)}
      <button type="button" className="studio-button" disabled={parts.length>=24} onClick={()=>{
        const part = row({name:'新零件',kind:'box',origin:[0,0,0],size:[NaN,NaN,NaN]})
        setParts(current=>[...current,part]);setConfirmed(false)
      }}>添加零件</button>
    </fieldset>
    <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)} /> 已按选定造型核对尺寸和零件划分</label>
    <div className="studio-actions">
      <button type="button" className="studio-button primary" disabled={!confirmed || busy || !parts.length} onClick={()=>generate(false)}>生成整机 STEP 草模</button>
      <button type="button" className="studio-button" disabled={!confirmed || busy || !parts.length || !explodedId} onClick={()=>generate(true)}>生成逐件 STEP 包</button>
    </div>
    {!explodedId && <p>生成当前版本的爆炸图后，可下载逐件 STEP。爆炸图作为零件划分参考。</p>}
    <p role="status">{notice}</p>
  </details>
}
