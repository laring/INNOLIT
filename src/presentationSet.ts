import type {Concept} from './concepts.ts'
import {visualSubjectOf} from './conceptVisuals.ts'
import {workflowOf,workflowContext} from './productWorkflow.ts'
export const presentationSpecs = [
 {id:'landscape',title:'Landscape Entry Image',width:4750,height:3167,dpi:300,task:'WHY + WHAT + Hero Scene. Lead with the problem, product and a believable real-use hero scene.'},
 {id:'portrait',title:'Portrait Entry Image',width:3167,height:4750,dpi:300,task:'HOW + product structure and key interaction. Use an explanatory vertical composition and accurate interaction sequence of the SAME product.'},
 {id:'poster',title:'Poster Area 1',width:8400,height:4300,dpi:254,task:'Problem + Insight + Solution + Mechanism + Use Flow + Value. Plan the real-use hero scene to occupy at least 75% of the generated board, allowing for final title margins. One real-use scene MUST occupy more than 50% of the entire board and be its dominant visual; diagrams and exploded views must remain secondary.'},
] as const
export function presentationKey(concept:Concept){return JSON.stringify({freeze:concept.development?.frozen,hero:workflowOf(concept).confirmedHero,heroContext:workflowContext(concept,'hero'),name:workflowOf(concept).productName,version:1})}
export function presentationPrompt(concept:Concept,index:number){
 const freeze=concept.development?.frozen
 if(!freeze)throw new Error('请先冻结概念。')
 const spec=presentationSpecs[index];if(!spec)throw new Error('未知展示图。')
 return [
 'Senior industrial designer and visual communication designer. Produce ONE distinct editorial board, not three views cropped from one layout. The supplied image is the APPROVED PRODUCT MASTER. Freeze is immutable; do not redesign.',
 'LOCK all silhouette, structure, proportions, materials, colors, key interactions, marking system and title typography across all three deliverables. Never invent an alternative product or feature. Preserve every visible part of the reference product.',
 'No iF logo, no award badges, no SDG symbols, no SDG content. Modern minimalist grid, clear information hierarchy, restrained captions and generous white space. Do not render a title: a consistent title is added by the application. Leave the upper 8% clear. Keep all content within safety margins.',
 `${spec.title}: ${spec.task} Compose for ${spec.width}:${spec.height}.`,
 index===2&&freeze.sceneException?`Scene exception recorded in the freeze: ${freeze.sceneException}. Only use a different dominant visual if this explicitly makes scene expression unsuitable.`:'',
 `Immutable Concept Freeze: ${JSON.stringify(visualSubjectOf(concept))}`,
 ].join('\n')
}
// Insert a JFIF density record so physical poster dimensions survive JPG export.
export function jpegDensity(bytes:Uint8Array,dpi:number){
 if(bytes[0]!==255||bytes[1]!==216)throw new Error('无效的 JPG。')
 const head=new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,1,1,1,dpi>>8,dpi&255,dpi>>8,dpi&255,0,0])
 let start=2
 if(bytes[2]===255&&bytes[3]===224&&bytes[6]===74&&bytes[7]===70)start=4+((bytes[4]<<8)|bytes[5])
 const result=new Uint8Array(head.length+bytes.length-start);result.set(head);result.set(bytes.subarray(start),head.length);return result
}
export async function presentationJpg(blob:Blob,index:number,title:string,font:string){
 const spec=presentationSpecs[index],bitmap=await createImageBitmap(blob)
 const canvas=document.createElement('canvas');canvas.width=spec.width;canvas.height=spec.height
 try{
 const ctx=canvas.getContext('2d',{colorSpace:'srgb'});if(!ctx)throw new Error('无法创建画布。')
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height)
 const scale=Math.min(canvas.width/bitmap.width,canvas.height*.9/bitmap.height),w=bitmap.width*scale,h=bitmap.height*scale
 ctx.drawImage(bitmap,(canvas.width-w)/2,canvas.height*.09+(canvas.height*.9-h)/2,w,h)
 ctx.fillStyle='#193c32';ctx.font=`600 ${Math.round(canvas.width*.027)}px "${font.replace(/["\\]/g,'')}", sans-serif`;ctx.fillText(title,canvas.width*.045,canvas.height*.06,canvas.width*.91)
 for(const quality of [.94,.86,.76,.64,.5,.36,.22,.12]){
 const jpg=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('JPG 导出失败。')),'image/jpeg',quality))
 const bytes=jpegDensity(new Uint8Array(await jpg.arrayBuffer()),spec.dpi)
 if(bytes.length<=5_000_000)return new Blob([bytes],{type:'image/jpeg'})
 }
 throw new Error('文件仍超过 5 MB，请减少画面细节后重试。')
 }finally{bitmap.close();canvas.width=1;canvas.height=1}
}
