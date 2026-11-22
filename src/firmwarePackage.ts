import type { Concept } from './concepts.ts'
import { engineeringInput } from './engineeringModel.ts'
import { requestModel, modelDevelopmentPath } from './modelGeneration.ts'
import type { ModelSettings } from './modelGeneration.ts'
import { parseModelObject } from './modelJson.ts'
export const firmwareFiles = ['hal/hal.h','drivers/drivers.h','business/control.c','app/main.c','CMakeLists.txt','CHANGELOG.md','docs/interfaces.md','docs/flashing.md','docs/risks.md','tests/test_validation.c','README.md']
export function validateFirmwareFiles(raw:string){
 const files=parseModelObject(raw,'嵌入式工程模型').files
 if(!Array.isArray(files)||files.length<11||files.length>40)throw new Error('工程包需要11–40个文本文件。')
 let total=0
 const result=files.map(item=>{
  if(!item||typeof item.name!=='string'||! /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(item.name)||item.name.includes('..')||! /\.(?:c|h|cpp|hpp|txt|md|json|cmake)$/i.test(item.name)||typeof item.data!=='string'||item.data.length>20000)throw new Error('工程文件路径、格式或长度无效。')
  total+=item.data.length;return {name:item.name,data:item.data}
 })
 if(total>120000||new Set(result.map(item=>item.name.toLowerCase())).size!==result.length||firmwareFiles.some(name=>!result.some(item=>item.name===name)))throw new Error('工程包缺少必需交付物、存在重复或过长。')
 return result.map(item=>item.name==='README.md'?{...item,data:'# AI工程草稿，待验证\n\n未执行编译、单测、烧录或硬件验证，不作为已认证量产固件。\n\n'+item.data}:item)
}
export async function generateFirmware(concept:Concept,settings:ModelSettings,signal:AbortSignal){
 const spec=concept.productWorkflow?.firmware
 if(!spec||[spec.mcu,spec.toolchain,spec.pinMap,spec.interfaces,spec.requirements].some(value=>!value.trim()))throw new Error('请先补齐MCU、工具链、引脚、接口和实际需求。')
 return validateFirmwareFiles(await requestModel(modelDevelopmentPath,engineeringInput(concept,'firmware'),settings,signal))
}

export function firmwareContext(concept:Concept){
 const data=concept.productWorkflow,spec=data?.firmware
 return JSON.stringify([concept.title,concept.sentences,data?.productName,data?.functions,data?.assets.hero,data?.pcb,spec?.mcu,spec?.toolchain,spec?.pinMap,spec?.interfaces,spec?.requirements])
}
