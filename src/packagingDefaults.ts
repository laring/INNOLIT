import type {ProductWorkflow} from './productWorkflow.ts'
export function fillPackagingDefaults(data:ProductWorkflow) {
  const spec=data.packaging,engineering=data.engineering
  const defaults={length:Math.min(1200,Math.max(80,(engineering.length||130)+20)),width:Math.min(1200,Math.max(50,(engineering.width||80)+20)),height:Math.min(1200,Math.max(50,(engineering.height||60)+20)),glue:15,flap:20,bleed:3,stock:'350 g/m² 白卡纸，厚度 0.45 mm，哑光表面',copy:data.productName,notes:'反插口纸盒；四周出血 3 mm，文字距刀线至少 5 mm；产品图居中，正面突出产品名称，背面简洁呈现使用说明。'}
  return {...spec,...Object.fromEntries(Object.entries(defaults).filter(([key])=>{const value=spec[key as keyof typeof defaults];return typeof value==='number'?!(value>0):!value.trim()}))}
}
