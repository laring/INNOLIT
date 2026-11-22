export const panelLayoutKey='inno-lit-panel-widths-v1'
export type PanelWidths={left:number;right:number}
export const defaultPanels:PanelWidths={left:248,right:290}
export function readPanelWidths(storage:Pick<Storage,'getItem'>):PanelWidths {
  try {const value=JSON.parse(storage.getItem(panelLayoutKey)??'null');if(value&&Number.isFinite(value.left)&&Number.isFinite(value.right))return {left:Math.max(180,Math.min(480,value.left)),right:Math.max(200,Math.min(600,value.right))}}catch{/* Use defaults when storage is unavailable. */}
  return {...defaultPanels}
}
export function fitPanelWidths(value:PanelWidths,total:number,showRight:boolean):PanelWidths {
  const available=Math.max(0,total-320-(showRight?16:8))
  const right=showRight?Math.max(200,Math.min(600,value.right,available-180)):value.right
  const left=Math.max(180,Math.min(480,value.left,available-(showRight?right:0)))
  return {left,right}
}
