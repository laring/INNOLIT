import {useEffect,useState,useRef} from 'react'
import type {Concept} from './concepts'
import type {ImageSettings} from './imageGeneration'
import {generateConceptImage,supportsImageReference} from './imageGeneration'
import {workflowOf,workflowContext} from './productWorkflow'
import {presentationSpecs,presentationKey,presentationPrompt,presentationJpg} from './presentationSet'
import {getVisual,putVisual} from './visualStore'
import type {SavedVisual} from './visualTypes'
import {imageDataUrl} from './productWorkflowImages'
import {downloadBlob} from './conceptBoard'
import {zipFiles} from './productionFiles'
import {useModelTask} from './useModelTask'
export function PresentationSetPanel({concept,projectId,roundNumber,settings,hero,onChange}:{concept:Concept;projectId:string;roundNumber:number;settings:ImageSettings;hero?:SavedVisual;onChange:(update:(current:Concept)=>Concept)=>void}){
 const saved=concept.productWorkflow?.presentationSet,key=presentationKey(concept),current=saved?.key===key
 const [records,setRecords]=useState<SavedVisual[]>([]),[progress,setProgress]=useState('')
 const {pending,notice,run,cancel}=useModelTask(900000)
 const ids=JSON.stringify(saved?.ids??[])
 useEffect(()=>{let live=true;void Promise.all((JSON.parse(ids) as string[]).map(getVisual)).then(items=>{if(live)setRecords(items.every((item):item is SavedVisual=>Boolean(item))?items:[])}).catch(()=>{if(live)setRecords([])});return()=>{live=false}},[ids])
 const ready=Boolean(concept.development?.frozen&&hero&&workflowOf(concept).confirmedHero===hero.id&&hero.conceptKey===workflowContext(concept,'hero'))
 function generate(){void run(async signal=>{
 if(!ready||!hero)throw new Error('请先冻结概念，并确认当前产品外观。')
 if(!supportsImageReference(settings))throw new Error('三件套需要支持参考图的图片模型。')
 const reference=await imageDataUrl(hero.blob),result:SavedVisual[]=[]
 for(const [index,spec] of presentationSpecs.entries()){
 signal.throwIfAborted();setProgress(`正在制作 ${spec.title}（${index+1}/3）`)
 const prompt=presentationPrompt(concept,index),ratio=spec.width/spec.height
 const config=settings.protocol==='openai'?{...settings,size:(ratio>1?'1536x1024':'1024x1536') as ImageSettings['size']}:settings
 const generated=await generateConceptImage(config,prompt,signal,{purpose:'master',reference})
 const blob=await presentationJpg(generated,index,workflowOf(concept).productName,concept.development!.frozen!.identity.titleFont)
 signal.throwIfAborted()
 result.push(await putVisual({id:JSON.stringify([projectId,roundNumber,concept.id,'presentation-set',spec.id,crypto.randomUUID()]),projectId,blob,source:{kind:'model',model:settings.model,provider:new URL(settings.baseUrl).hostname},prompt,conceptKey:key,workflowKind:'presentation-'+spec.id},signal))
 }
 return result
 },result=>{setRecords(result);onChange(value=>presentationKey(value)===key?{...value,productWorkflow:{...workflowOf(value),presentationSet:{key,ids:result.map(item=>item.id),approved:false}}}:value);setProgress('')},'三件套已生成，请核对三张产品一致性后下载。')}
 return <section className="studio-refinement"><h4>三件套输出</h4><p>三件套 · 同一冻结概念与产品外观 · RGB JPG · 每张 ≤5 MB</p><p>横版 4750×3167；竖版 3167×4750；Poster Area 1：840×430 mm（254 dpi）。</p>
 {!ready&&<p>请先冻结概念并确认产品外观。</p>}
 <button className="studio-button primary" disabled={pending||!ready} onClick={generate}>生成三件套</button>{pending&&<button className="studio-button" onClick={cancel}>取消</button>}
 <p role="status">{pending?progress:notice}</p>
 {saved&&!current&&<p>冻结版本或产品外观已变化，请重新生成三件套。</p>}
 {records.map((record,index)=><figure key={record.id}><figcaption>{presentationSpecs[index].title} · {(record.blob.size/1000000).toFixed(2)} MB</figcaption><Preview record={record} label={index===0?'产品概念展示图':presentationSpecs[index].title}/></figure>)}
 {records.length===3&&current&&<><label><input type="checkbox" disabled={pending} checked={saved?.approved??false} onChange={event=>{const approved=event.target.checked;onChange(value=>value.productWorkflow?.presentationSet?.key===key?{...value,productWorkflow:{...workflowOf(value),presentationSet:{...saved!,approved}}}:value)}}/>三张产品造型、CMF、交互与标识一致，Poster 场景主图超过 50%（或符合冻结例外）</label>
 <div className="studio-actions">{records.map((record,index)=><button key={record.id} className="studio-button" disabled={!saved?.approved||pending} onClick={()=>downloadBlob(record.blob,presentationSpecs[index].title+'.jpg')}>下载 {presentationSpecs[index].title}</button>)}<button className="studio-button" disabled={!saved?.approved||pending} onClick={()=>void run(async()=>{const files=await Promise.all(records.map(async(record,index)=>({name:presentationSpecs[index].title+'.jpg',data:new Uint8Array(await record.blob.arrayBuffer())})));downloadBlob(new Blob([zipFiles(files)],{type:'application/zip'}),'产品概念三件套.zip')},()=>{},'三件套已下载。')}>下载三件套 ZIP</button></div></>}
 </section>
}
function Preview({record,label}:{record:SavedVisual;label:string}){const ref=useRef<HTMLImageElement>(null);useEffect(()=>{const value=URL.createObjectURL(record.blob);if(ref.current)ref.current.src=value;return()=>URL.revokeObjectURL(value)},[record.blob]);return <img ref={ref} alt={label} className="workflow-product-image"/>}
