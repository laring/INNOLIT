import type { ModelSettings } from './modelGeneration.ts'
import { imageSizes } from './imageGeneration.ts'
import type { ImageSettings } from './imageGeneration.ts'
import { createEmptyWorkflowRouting, workflowTasks } from './aiModelRouter.ts'
import type { WorkflowModelRouting, WorkflowTask } from './aiModelRouter.ts'
export type ModelCenterConfig = { text: ModelSettings; image: ImageSettings; workflow: WorkflowModelRouting }
export const modelConfigStorageKey = 'inno-lit-model-center-encrypted-v1'
export function emptyModelConfig(): ModelCenterConfig {
  return { text:{baseUrl:'',model:'',apiKey:''}, image:{baseUrl:'',model:'',apiKey:'',protocol:'siliconflow',size:'1024x1024'}, workflow:createEmptyWorkflowRouting() }
}
function record(value: unknown): Record<string, unknown> { if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('模型配置格式无效。');return value as Record<string,unknown> }
function textSettings(value:unknown):ModelSettings{
  const data=record(value)
  for(const [key,max] of [['baseUrl',1000],['model',200],['apiKey',2048]] as const)if(typeof data[key]!=='string'||data[key].length>max)throw new Error('模型配置字段无效。')
  return {baseUrl:data.baseUrl as string,model:data.model as string,apiKey:data.apiKey as string}
}
function imageSettings(value:unknown):ImageSettings{
  const data=record(value),text=textSettings(data)
  if(!['siliconflow','openrouter','images','openai'].includes(String(data.protocol))||!imageSizes.includes(data.size as ImageSettings['size']))throw new Error('图片配置协议或尺寸无效。')
  return {...text,protocol:data.protocol as ImageSettings['protocol'],size:data.size as ImageSettings['size']}
}
export function validateModelConfig(value:unknown):ModelCenterConfig{
  const data=record(value),saved=record(data.workflow),workflow=createEmptyWorkflowRouting()
  for(const task of Object.keys(workflowTasks) as WorkflowTask[]) {
    if(saved[task]===undefined||saved[task]===null)continue
    if(task==='visual')workflow.visual=imageSettings(saved[task]);else workflow[task]=textSettings(saved[task])
  }
  return {text:textSettings(data.text),image:imageSettings(data.image),workflow}
}
function bytes64(bytes:Uint8Array){return btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''))}
function from64(value:unknown,max:number){if(typeof value!=='string'||value.length>max||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new Error('已保存配置的数据无效。');return Uint8Array.from(atob(value),char=>char.charCodeAt(0))}
let cachedKey:Promise<CryptoKey>|undefined
export function localModelConfigKey():Promise<CryptoKey>{
  cachedKey??=(async()=>{
    const candidate=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt'])
    const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('inno-lit-settings',1);request.onupgradeneeded=()=>request.result.createObjectStore('keys');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('无法打开本机配置存储。'))})
    return new Promise<CryptoKey>((resolve,reject)=>{
      const transaction=database.transaction('keys','readwrite'),store=transaction.objectStore('keys'),request=store.get('model-config')
      let key:CryptoKey
      request.onsuccess=()=>{key=request.result??candidate;if(!request.result)store.put(key,'model-config')}
      transaction.oncomplete=()=>{database.close();resolve(key)}
      transaction.onerror=transaction.onabort=()=>{database.close();reject(new Error('无法保存本机加密密钥。'))}
    })
  })().catch(error=>{cachedKey=undefined;throw error})
  return cachedKey
}
type ConfigStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>
export async function saveModelConfig(config:ModelCenterConfig,storage:ConfigStorage=localStorage,getKey:()=>Promise<CryptoKey>=localModelConfigKey,signal?:AbortSignal){
  const clean=validateModelConfig(config),key=await getKey(),iv=crypto.getRandomValues(new Uint8Array(12))
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(clean)))
  signal?.throwIfAborted()
  storage.setItem(modelConfigStorageKey,JSON.stringify({version:1,iv:bytes64(iv),ciphertext:bytes64(new Uint8Array(ciphertext))}))
}
export async function loadModelConfig(storage:ConfigStorage=localStorage,getKey:()=>Promise<CryptoKey>=localModelConfigKey):Promise<ModelCenterConfig|null>{
  const raw=storage.getItem(modelConfigStorageKey);if(!raw)return null
  if(raw.length>150000)throw new Error('已保存配置过大。')
  const payload=record(JSON.parse(raw));if(payload.version!==1)throw new Error('已保存配置版本不支持。')
  const iv=from64(payload.iv,24),bytes=from64(payload.ciphertext,140000);if(iv.length!==12)throw new Error('已保存配置的加密参数无效。')
  const decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv},await getKey(),bytes)
  return validateModelConfig(JSON.parse(new TextDecoder().decode(decoded)))
}
export function forgetModelConfig(storage:ConfigStorage=localStorage){storage.removeItem(modelConfigStorageKey)}
