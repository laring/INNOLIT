import type { ProductOutputSize } from './productImageLayout.ts'
import { pageSizeProblem } from './conceptVisuals.ts'
export type PcbSpec = {
  length: number; width: number; thickness: string; copper: string; finish: string; tolerance: string
  drawingNo: string; revision: string; designer: string
  holes: string; pads: string; tracks: string; components: string; notes: string; analysis: string
}
export const emptyPcb: PcbSpec = { length: 0, width: 0, thickness: '', copper: '', finish: '', tolerance: '', drawingNo: '', revision: '', designer: '', holes: '', pads: '', tracks: '', components: '', notes: '', analysis: '' }
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const rows = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => line.split('|').map(item => item.trim()))
export function pcbGeometry(spec: PcbSpec) {
  if (![spec.length, spec.width].every(value => Number.isFinite(value) && value >= 5 && value <= 500)) throw new Error('请填写 5–500 mm 的矩形 PCB 板长与板宽。')
  for (const [key, value] of Object.entries(spec)) if (typeof value === 'string' && value.length > (['holes','pads','tracks','components','notes','analysis'].includes(key) ? 8000 : 35)) throw new Error('PCB 字段过长，请精简。')
  const bounds = (x: number, y: number, rx = 0, ry = rx) => {
    if (![x,y,rx,ry].every(Number.isFinite) || x - rx < 0 || y - ry < 0 || x + rx > spec.length || y + ry > spec.width || rx < 0 || ry < 0) throw new Error('PCB 孔、焊盘、元件或线路超出板框，或坐标无效。')
  }
  const positive = (value: number) => { if (!Number.isFinite(value) || value <= 0 || value > 100) throw new Error('孔径、焊盘、元件和线宽应为有效正数。') }
  const unique = (values: string[]) => { if (values.some(value => !value || value.length > 30) || new Set(values).size !== values.length) throw new Error('孔号、焊盘号或位号为空、重复或过长。') }
  const holes = rows(spec.holes).map(parts => {
    if (parts.length !== 6 || !['PTH','NPTH'].includes(parts[1])) throw new Error('孔格式：孔号|PTH或NPTH|X|Y|孔径|焊盘外径（NPTH填0）。')
    if(parts.slice(2).some(value=>!value))throw new Error('孔坐标与孔径不能留空。')
    const [id,kind] = parts, [x,y,drill,pad] = parts.slice(2).map(Number)
    positive(drill)
    if (kind === 'PTH' && (!Number.isFinite(pad) || pad <= drill) || kind === 'NPTH' && pad !== 0) throw new Error('PTH 焊盘外径应大于孔径；NPTH 不带铜焊盘，外径填 0。')
    bounds(x,y,Math.max(drill,pad)/2)
    return {id,kind,x,y,drill,pad}
  })
  const pads = rows(spec.pads).map(parts => {
    if (parts.length !== 7) throw new Error('焊盘格式：编号|X|Y|宽|高|极性（无则-）|网络名。')
    if(parts.slice(1,5).some(value=>!value))throw new Error('图元坐标与尺寸不能留空。')
    const [id] = parts, [x,y,w,h] = parts.slice(1,5).map(Number), [polarity,net] = parts.slice(5)
    positive(w);positive(h);bounds(x,y,w/2,h/2)
    if (polarity.length > 10 || net.length > 30 || !net) throw new Error('请填写有效的焊盘极性和网络名。')
    return {id,x,y,w,h,polarity,net}
  })
  const components = rows(spec.components).map(parts => {
    if (parts.length !== 6) throw new Error('元件格式：位号|X|Y|宽|高|极性（无则-）。')
    if(parts.slice(1,5).some(value=>!value))throw new Error('图元坐标与尺寸不能留空。')
    const [id] = parts, [x,y,w,h] = parts.slice(1,5).map(Number), polarity = parts[5]
    positive(w);positive(h);bounds(x,y,w/2,h/2)
    if (polarity.length > 10) throw new Error('极性标识过长。')
    return {id,x,y,w,h,polarity}
  })
  const tracks = rows(spec.tracks).map(parts => {
    if (parts.length !== 3 || !parts[0] || parts[0].length > 30) throw new Error('线路格式：网络名|线宽|X,Y;X,Y;…（顶层）。')
    if(!parts[1])throw new Error('线路宽度不能留空。')
    const [net] = parts, width = Number(parts[1]); positive(width)
    const points = parts[2].split(';').map(pair => { const xy=pair.split(','); if(xy.length!==2 || xy.some(value=>!value.trim())) throw new Error('线路坐标需为 X,Y。'); const [x,y]=xy.map(Number);bounds(x,y,width/2);return [x,y] })
    if (points.length < 2 || points.length > 100) throw new Error('每条线路需要 2–100 个坐标点。')
    return { net,width,points }
  })
  if ([holes,pads,tracks,components].some(items=>items.length>100)) throw new Error('每种 PCB 图元最多 100 条，请拆分大型工程图。')
  unique(holes.map(item=>item.id));unique(pads.map(item=>item.id));unique(components.map(item=>item.id))
  return { holes,pads,components,tracks }
}
export function pcbSvg(productName: string, spec: PcbSpec, size: ProductOutputSize) {
  const problem = pageSizeProblem(size);if(problem) throw new Error(problem)
  const geometry = pcbGeometry(spec)
  const W=297,H=W*size.height/size.width, frame=8, top=28, bottom=H-65
  if (H<140) throw new Error('PCB 图纸需要容纳标题栏，请增加高度或选择横版／竖版。')
  const scale = Math.min((W-70)/spec.length,(bottom-top-18)/spec.width)
  const ox=(W-spec.length*scale)/2,oy=top+8
  const x=(value:number)=>ox+value*scale,y=(value:number)=>oy+value*scale
  const text=(label:string,px:number,py:number,sz=2.6)=>`<text x="${px}" y="${py}" font-size="${sz}" fill="black" stroke="none">${escape(label)}</text>`
  const line=(x1:number,y1:number,x2:number,y2:number,weight=.18)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${weight}"/>`
  const rect=(rx:number,ry:number,rw:number,rh:number,weight=.18)=>`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" stroke-width="${weight}"/>`
  let drawing=rect(ox,oy,spec.length*scale,spec.width*scale,.5)
  drawing+=line(ox,oy-5,x(spec.length),oy-5)+line(ox,oy-7,ox,oy)+line(x(spec.length),oy-7,x(spec.length),oy)+text(`${spec.length} mm ${spec.tolerance || ''}`,ox,oy-8)
  drawing+=line(ox-7,oy,ox-7,y(spec.width))+line(ox-9,oy,ox,oy)+line(ox-9,y(spec.width),ox,y(spec.width))+text(`${spec.width} mm ${spec.tolerance || ''}`,ox-37,oy+spec.width*scale/2)
  for(const hole of geometry.holes){drawing+=`<g id="hole-${escape(hole.id)}"><circle cx="${x(hole.x)}" cy="${y(hole.y)}" r="${hole.drill*scale/2}" stroke-width=".25"/>${hole.kind==='PTH'?`<circle cx="${x(hole.x)}" cy="${y(hole.y)}" r="${hole.pad*scale/2}" stroke-width=".18"/>`:''}${line(x(hole.x)-2,y(hole.y),x(hole.x)+2,y(hole.y),.1)}${line(x(hole.x),y(hole.y)-2,x(hole.x),y(hole.y)+2,.1)}${text(`${hole.id} ${hole.kind} Ø${hole.drill}`,x(hole.x)+2,y(hole.y)-2,2.1)}</g>`}
  for(const track of geometry.tracks) drawing+=`<polyline data-net="${escape(track.net)}" points="${track.points.map(([px,py])=>`${x(px)},${y(py)}`).join(' ')}" stroke-width="${Math.max(.12,track.width*scale)}"/>`
  for(const pad of geometry.pads) drawing+=`<g id="pad-${escape(pad.id)}" data-net="${escape(pad.net)}">${rect(x(pad.x-pad.w/2),y(pad.y-pad.h/2),pad.w*scale,pad.h*scale,.22)}${text(`${pad.id}${pad.polarity==='-'?'':` ${pad.polarity}`}`,x(pad.x)+1,y(pad.y)-1,2)}</g>`
  for(const component of geometry.components) drawing+=`<g id="silk-${escape(component.id)}">${rect(x(component.x-component.w/2),y(component.y-component.h/2),component.w*scale,component.h*scale,.13)}${text(`${component.id}${component.polarity==='-'?'':` ${component.polarity}`}`,x(component.x-component.w/2),y(component.y+component.h/2)+3,2.4)}</g>`
  const tx=W-145,ty=H-51
  let title=rect(tx,ty,137,43,.35)
  for(let row=1;row<5;row++) title+=line(tx,ty+row*8.6,tx+137,ty+row*8.6)
  const titles=[productName.slice(0,35)+' · PCB 顶视装配线稿',`图号：${spec.drawingNo||'—'}    版本：${spec.revision||'—'}`,`板厚：${spec.thickness||'—'}    铜厚：${spec.copper||'—'}`,`表面工艺：${spec.finish||'—'}    设计者：${spec.designer||'—'}`,`矩形板mm，原始图幅297mm宽：比例${scale.toFixed(3)}:1；缩放打印另计`]
  titles.forEach((label,index)=>{const chars=Array.from(label);for(let offset=0;offset<chars.length;offset+=50)title+=text(chars.slice(offset,offset+50).join(''),tx+2,ty+3.5+index*8.6+offset/50*3.2,2.3)})
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}"><title>${escape(productName)} 二维 PCB 工程审查线稿</title><rect width="${W}" height="${H}" fill="white"/><g fill="none" stroke="black">${rect(frame,frame,W-frame*2,H-frame*2,.35)}${drawing}${title}</g><g fill="black" font-family="Microsoft YaHei, sans-serif">${text('二维 PCB 顶视装配图',12,17,4)}${text('PTH：电镀孔（双圆）  NPTH：非电镀孔（单圆）',12,H-44,2.1)}${text('坐标：左上角原点，X向右、Y向下，单位mm',12,H-38,2.1)}${text('顶视正投影，无3D、光影或照片效果',12,H-32,2.1)}</g></svg>`
}
