import type {Plugin} from 'vite'
import {readJson} from '../server/providerHttp.ts'
import {send,isLocalRequest} from '../server/modelApi.ts'
import {planningModules} from '../src/planningReport.ts'
import {responseFor} from '../tests/fixtures/development.mjs'
import {demoInputs} from './fixture.mjs'
import {deflateSync} from 'node:zlib'
import {crc32} from '../src/productionFiles.ts'
function picture(sheet:boolean){
 const width=1000,height=600,rows=Buffer.alloc((width*4+1)*height,255)
 for(let y=0;y<height;y++){rows[y*(width*4+1)]=0;for(let x=0;x<width;x++){const col=Math.floor(x/(width/(sheet?5:1))),row=Math.floor(y/(height/(sheet?2:1))),cx=x-col*width/(sheet?5:1),cy=y-row*height/(sheet?2:1),cw=width/(sheet?5:1),ch=height/(sheet?2:1);if(cx>cw*.2&&cx<cw*.8&&cy>ch*.25&&cy<ch*.75){const offset=y*(width*4+1)+1+x*4;rows[offset]=50+col*15;rows[offset+1]=100+row*30;rows[offset+2]=85}}}
 function chunk(name:string,data:Buffer){const result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);result.write(name,4);data.copy(result,8);result.writeUInt32BE(crc32(result.subarray(4,-4)),result.length-4);return result}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))])
}
export function demoApi():Plugin{return {name:'demo-only-api',configureServer(server){server.middlewares.use((req,res,next)=>{
 if(!req.url?.startsWith('/api/inno-lit/'))return next()
 if(!isLocalRequest(req))return send(res,403,{error:'演示仅接受本机页面请求。'})
 void (async()=>{const input=await readJson(req,384*1024) as Record<string,any>
 if(req.url?.endsWith('/image')){res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});res.end(picture(String(input.prompt).includes('EXACTLY TEN')));return}
 let content:unknown
 if(req.url?.endsWith('/chat'))return send(res,200,{content:'演示模拟回复：建议采用翻面启动的无声休息牌，便于课间安静使用。'})
 if(input.kind==='planning-inputs')content={inputs:demoInputs}
 else if(input.kind==='planning')content={sections:planningModules[input.reportKind as keyof typeof planningModules].map(([title])=>({title,body:'演示报告：'+title+'。本段用于验证编辑和导出，不包含真实调研结论。'}))}
 else if(input.action==='image-prompt')content={prompt:'A quiet classroom flip timer, compact rounded rectangular body with matte wood surfaces and a dark green accent. Show the complete product with generous margins and a simple interaction.'}
 else if(input.action==='drawing-parameters')content={recommendations:'外形：90 × 60 × 12 mm；材质：桦木；连接：可拆卸外壳；图幅：A4横版。'}
 else if(input.action==='packaging-spec')content={packaging:{length:150,width:100,height:80,glue:15,flap:20,bleed:3,stock:'350g白卡纸，0.45mm',copy:'无声休息牌，翻面开始',notes:'简洁居中排版'}}
 else if(input.stage==='report')content={report:'演示设计总结：用户问题、产品交互与下一步行动。'}
 else if(['notes','validation','research','synthesis'].includes(input.stage))content=responseFor(input.stage,input)
 else content={analysis:'演示模型分析',draft:'演示组件与设计建议',missing:[]}
 send(res,200,{content:JSON.stringify(content)})
 })().catch(()=>send(res,400,{error:'演示请求无效。'}))
 })}}}
