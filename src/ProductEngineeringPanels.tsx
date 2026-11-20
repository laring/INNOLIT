import { useEffect, useState, useRef } from 'react'
import type { Concept } from './concepts'
import type { ModelSettings } from './modelGeneration'
import { hasModelSettings } from './modelGeneration'
import {fillPackagingDefaults} from './packagingDefaults'
import { analyzeEngineering, recommendPackagingSpec } from './engineeringModel'
import { engineeringContext, engineeringProblems, packagingContext, workflowOf } from './productWorkflow'
import type { ProductWorkflow, EngineeringFile } from './productWorkflow'
import type { SavedVisual } from './visualTypes'
import { getVisual, putVisual } from './visualStore'
import { downloadBlob } from './conceptBoard'
import { engineeringEnvelope, packagingFiles, packagingProblem, zipFiles } from './productionFiles'
import type { BundleFile } from './productionFiles'
import { imageDataUrl, imageDigest } from './productWorkflowImages'
import { useModelTask } from './useModelTask'

type PanelProps = { concept: Concept; settings: ModelSettings; projectId: string; hero?: SavedVisual; heroReady: boolean; onEdit: (update: (current: ProductWorkflow) => ProductWorkflow) => void }
function safeFilename(value: string) { return Array.from(value).map(char => char.codePointAt(0)! < 32 || /[\\/:*?"<>|]/u.test(char) ? '_' : char).join('').slice(0, 160) || 'document' }
function bundleDownload(files: BundleFile[], name: string) { downloadBlob(new Blob([zipFiles(files)], { type: 'application/zip' }), name) }
export function EngineeringPanel({ concept, settings, projectId, onEdit, heroReady }: PanelProps) {
  const data = workflowOf(concept), spec = data.engineering
  const { pending, notice, run, cancel } = useModelTask()
  const [role, setRole] = useState<EngineeringFile['role']>('product')
  const problems = engineeringProblems(data), context = engineeringContext(data)
  const confirmed = spec.confirmedContext === context && Boolean(spec.reviewer.trim()) && !problems.length && heroReady
  function edit(change: Partial<ProductWorkflow['engineering']>) { onEdit(current => ({ ...current, engineering: { ...current.engineering, ...change } })) }
  async function exportBundle() {
    void run(async () => {
      const files: BundleFile[] = [{ name: 'DFM-specification.json', data: JSON.stringify({ productName: data.productName, brand: data.brand, ...spec, status: confirmed ? 'engineer-reviewed-handoff' : 'review-draft', missing: problems, note: 'AI has not parsed or validated CAD geometry. Supplier must validate manufacturing data.' }, null, 2) },
        { name: 'BOM-notes.txt', data: data.components || '尚未提供经过核对的 BOM。' },
        { name: 'DFM-review.md', data: spec.review || '尚未填写审查记录。' },
        { name: 'README.md', data: `# ${data.productName} 模具工程资料\n\n${confirmed ? '含工程师确认记录，供模具厂复核和接收。' : '待审工程准备包，缺少完整资料时不可直接拆图加工。'}\n\n本应用不从图片推导可加工型腔、冷却水路或加工公差，也未转换或验证附件几何。三维产品/模具与正式加工图来自上传的工程文件。STEP/IGES 为中性几何交换，DXF 为二维图纸；不等同于 SolidWorks、UG/NX、Creo 原生特征树，须由接收方检验。\n\nproduct-envelope.dxf 若存在，仅表达用户填写的外形包络，绝不是模具型腔或加工图。\n\n待补齐：${problems.join('；') || '基础目录完整，仍需厂方校核文件内容、机台、仿真与加工条件。'}\n工程师：${spec.reviewer || '尚未确认'}\n` }]
      if ([spec.length, spec.width, spec.height].every(value => value > 0)) files.push({ name: 'product-envelope.dxf', data: engineeringEnvelope(data) })
      for (const [index, file] of spec.files.entries()) {
        const record = await getVisual(file.id)
        if (!record) throw new Error(`附件 ${file.name} 无法读取，请重新上传。`)
        if (await imageDigest(record.blob) !== file.digest) throw new Error(`附件 ${file.name} 校验失败，请重新上传。`)
        files.push({ name: `CAD/${index + 1}-${safeFilename(file.name)}`, data: new Uint8Array(await record.blob.arrayBuffer()) })
      }
      bundleDownload(files, `INNO-LIT-${confirmed ? '工程师确认交付包' : '模具待审资料包'}.zip`)
    }, () => {}, '模具资料包已导出。')
  }
  return <div className="studio-refinement">
    <p>填写真实参数并上传 CAD，供 DFM 审查；AI 不验证 CAD 几何。</p>
    <fieldset className="development-fields workflow-parameter-grid" disabled={pending}>
      {(['length', 'width', 'height', 'wall'] as const).map((key, index) => <label className="studio-field" key={key}>{['产品长（mm）', '产品宽（mm）', '产品高（mm）', '壁厚（mm）'][index]}<input type="number" min={0} max={3000} step="any" value={spec[key] || ''} onChange={event => edit({ [key]: event.target.valueAsNumber || 0 })} /></label>)}
      <label className="studio-field">塑料牌号<input value={spec.material} maxLength={200} onChange={event => edit({ material: event.target.value })} /></label>
      <label className="studio-field">供应商收缩率<input value={spec.shrinkage} maxLength={200} onChange={event => edit({ shrinkage: event.target.value })} /></label>
      <label className="studio-field">关键尺寸与公差<input value={spec.tolerance} maxLength={1000} onChange={event => edit({ tolerance: event.target.value })} /></label>
      <label className="studio-field">模具穴数<input type="number" min={1} max={128} value={spec.cavities} onChange={event => edit({ cavities: event.target.valueAsNumber || 0 })} /></label>
    </fieldset>
    <label className="studio-field">工程要求与已知限制<textarea rows={4} maxLength={6000} value={spec.notes} disabled={pending} onChange={event => edit({ notes: event.target.value })} /></label>
    <div className="studio-actions"><button type="button" className="studio-button" disabled={pending || !hasModelSettings(settings)} onClick={() => void run(signal => analyzeEngineering(concept, 'dfm', settings, signal), text => edit({ review: `模型建议（${settings.model}，需工程核对）：\n${text}` }), 'DFM 建议已保存，请工程师修正。')}>AI 协助 DFM 审查</button>{pending && <button type="button" className="studio-button" onClick={cancel}>取消</button>}</div>
    <label className="studio-field">DFM 审查与人工修正<textarea rows={9} maxLength={16000} value={spec.review} disabled={pending} onChange={event => edit({ review: event.target.value })} /></label>
    <h3>工程文件</h3><p className="studio-hint">STEP／IGES、DXF／DWG、原生 CAD；单文件 ≤30 MB，总计 ≤90 MB。</p>
    <div className="studio-actions"><label className="studio-field">文件用途<select value={role} disabled={pending} onChange={event => setRole(event.target.value as EngineeringFile['role'])}><option value="product">产品三维</option><option value="mould">模具总装</option><option value="drawing">正式加工图</option><option value="other">其他工程资料</option></select></label>
      <label className="studio-button visual-upload">添加工程文件<input type="file" aria-label="添加工程文件" disabled={pending || spec.files.length >= 12} accept=".step,.stp,.iges,.igs,.stl,.x_t,.sldprt,.sldasm,.prt,.asm,.dxf,.dwg,.pdf,.csv" onChange={event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
        void run(async signal => {
          if (!/\.(step|stp|iges|igs|stl|x_t|sldprt|sldasm|prt|asm|dxf|dwg|pdf|csv)$/iu.test(file.name) || !file.size || file.size > 30 * 1024 * 1024 || spec.files.reduce((total, item) => total + item.size, file.size) > 90 * 1024 * 1024) throw new Error('请使用支持的工程格式，单文件不超过 30 MB，总计不超过 90 MB。')
          const digest = await imageDigest(file), id = JSON.stringify([projectId, concept.id, 'engineering-file', crypto.randomUUID()])
          await putVisual({ id, projectId, blob: file, source: { kind: 'upload' }, prompt: '', workflowKind: 'engineering-file', filename: file.name, digest }, signal)
          return { id, name: file.name, size: file.size, digest, role }
        }, entry => onEdit(current => ({ ...current, engineering: { ...current.engineering, files: [...current.engineering.files, entry] } })), '工程附件已保存在本项目。')
      }} /></label>
    </div>
    <ul className="studio-evidence-list">{spec.files.map(file => <li key={file.id}><span>{file.role} · {file.name} · {(file.size / 1024).toFixed(0)} KB</span><button type="button" className="studio-button" disabled={pending} onClick={() => edit({ files: spec.files.filter(item => item.id !== file.id) })}>移出目录</button></li>)}</ul>
    <details><summary>交付检查 · {problems.length ? `${problems.length} 项待补齐` : '基础资料目录完整'}</summary><ul>{problems.map(item => <li key={item}>{item}</li>)}</ul><p>型腔／型芯、分型与侧抽、进胶排气、冷却顶出、模架标准件、钢材热处理、尺寸链、公差、机台匹配和工艺仿真仍须由工程师及模具厂校核。目录齐全不代表文件几何已通过验证。</p></details>
    <label className="studio-field">工程确认人<input value={spec.reviewer} maxLength={100} disabled={pending} onChange={event => edit({ reviewer: event.target.value, confirmedContext: undefined })} /></label>
    <div className="studio-actions"><button type="button" className="studio-button" disabled={pending || problems.length > 0 || !spec.reviewer.trim() || !heroReady} onClick={() => edit({ confirmedContext: context })}>{confirmed ? '当前工程资料已人工确认' : '工程师确认当前资料'}</button><button type="button" className="studio-button primary" disabled={pending} onClick={() => void exportBundle()}>导出{confirmed ? '工程师确认交付包' : '待审工程资料包'}</button></div>
    <p className="studio-hint" role="status">{notice || '缺少真实三维与工程图时，生成的是审查准备资料，不能直接拆图加工。'}</p>
  </div>
}

export function PackagingPanel({ concept, settings, hero, heroReady, onEdit }: PanelProps) {
  const data = workflowOf(concept), spec = data.packaging, context = packagingContext(data), problem = packagingProblem(data)
  const { pending, notice, run, cancel } = useModelTask()
  const [compiled, setCompiled] = useState<{ context: string; files: BundleFile[] }>()
  const fresh = compiled?.context === context && heroReady
  function edit(change: Partial<ProductWorkflow['packaging']>) { onEdit(current => ({ ...current, packaging: { ...current.packaging, ...change } })) }
  const filledDefaults=useRef(false)
  useEffect(()=>{if(filledDefaults.current)return;const timer=setTimeout(()=>{filledDefaults.current=true;onEdit(current=>{const packaging=fillPackagingDefaults(current);return JSON.stringify(packaging)===JSON.stringify(current.packaging)?current:{...current,packaging}})},0);return()=>clearTimeout(timer)},[onEdit])
  return <div className="studio-refinement">
    
    <fieldset className="development-fields workflow-parameter-grid" disabled={pending}>
      {(['length', 'width', 'height', 'glue', 'flap', 'bleed'] as const).map((key, index) => <label className="studio-field" key={key}>{['盒体内长（mm）', '盒体内深（mm）', '盒体内高（mm）', '粘口（mm）', '插舌（mm）', '出血（mm）'][index]}<input type="number" min={0} max={1200} step="any" value={spec[key] || ''} onChange={event => edit({ [key]: event.target.valueAsNumber || 0 })} /></label>)}
    </fieldset>
    
    <label className="studio-field">纸材、克重与厚度<input value={spec.stock} maxLength={300} disabled={pending} onChange={event => edit({ stock: event.target.value })} /></label>
    <label className="studio-field">包装文案<textarea rows={4} maxLength={1500} value={spec.copy} disabled={pending} onChange={event => edit({ copy: event.target.value })} /></label>
    <div className="studio-actions"><button type="button" className="studio-button" disabled={pending || !hasModelSettings(settings)} onClick={() => void run(signal => recommendPackagingSpec(concept,settings,signal), packaging=>edit(packaging), '包装参数已填入。')}>AI 填写包装参数</button>{pending && <button type="button" className="studio-button" onClick={cancel}>取消</button>}</div>
    <label className="studio-field">设计理念与打样备注<textarea rows={5} maxLength={12000} value={spec.notes} disabled={pending} onChange={event => edit({ notes: event.target.value })} /></label>
    <details><summary>签署记录</summary><label className="studio-field">记录人<input value={spec.reviewer} maxLength={100} disabled={pending} onChange={event => edit({ reviewer: event.target.value, confirmedContext: undefined })} /></label>
    <div className="studio-actions"><button type="button" className="studio-button" disabled={pending || Boolean(problem) || !heroReady || !spec.reviewer.trim()} onClick={() => edit({ confirmedContext: context })}>{spec.confirmedContext === context ? '记录已保存' : '保存记录'}</button></div></details><div className="studio-actions">
      <button type="button" className="studio-button primary" disabled={pending || Boolean(problem) || !heroReady || !hero} onClick={() => void run(async () => ({ context, files: packagingFiles(data, await imageDataUrl(hero!.blob)) }), setCompiled, '打样文件已生成。')}>生成打样文件</button></div>
    <p className="studio-hint" role="status">{notice || problem || (!heroReady ? '请先在第一步确认外观。' : '')}</p>
    {compiled && !fresh && <p className="studio-hint">产品或包装资料已变化，请重新排版后导出。</p>}
    {compiled && <><div className="studio-actions"><button type="button" className="studio-button primary" disabled={!fresh || pending} onClick={() => bundleDownload(compiled.files, 'INNO-LIT-包装打样资料.zip')}>下载打样资料 ZIP</button><details><summary>单独下载文件</summary>{compiled.files.filter(file => /\.(svg|dxf)$/u.test(file.name)).map(file => <button key={file.name} type="button" className="studio-button" disabled={!fresh || pending} onClick={() => downloadBlob(new Blob([file.data as string], { type: file.name.endsWith('.svg') ? 'image/svg+xml' : 'application/dxf' }), file.name)}>{file.name}</button>)}</details></div>
      <PackagingPreview key={compiled.context} file={compiled.files.find(file => file.name === 'artwork.svg')!} />
    </>}
  </div>
}
function PackagingPreview({ file }: { file: BundleFile }) {
  const [url] = useState(() => URL.createObjectURL(new Blob([file.data as string], { type: 'image/svg+xml' })))
  // Revoke the SVG resource when its compiled layout is replaced.
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return <img className="workflow-artwork-preview" src={url} alt="可编辑包装展开稿预览" />
}
