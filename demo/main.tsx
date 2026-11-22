import {createRoot} from 'react-dom/client'
import App from '../src/App'
import '../src/index.css'
import {demoProjects} from './fixture.mjs'
import {STORAGE_KEY} from '../src/projects'
import {emptyModelConfig,saveModelConfig} from '../src/modelConfigStore'
if(import.meta.env.MODE!=='demo')throw new Error('演示入口只能使用 demo 模式。')
async function start(){
 const saved=localStorage.getItem(STORAGE_KEY)
 if(saved&&!localStorage.getItem('inno-lit-demo-origin'))throw new Error('此来源已有个人项目，请使用独立演示端口。')
 if(!saved)localStorage.setItem(STORAGE_KEY,JSON.stringify(demoProjects()))
 localStorage.setItem('inno-lit-demo-origin','v1')
 const config=emptyModelConfig();config.text={baseUrl:'https://demo.invalid/v1',model:'DEMO-模拟模型',apiKey:'demo-not-a-real-key'};config.image={...config.text,protocol:'openai',baseUrl:'https://api.openai.com/v1',model:'DEMO-模拟图片',size:'1024x1024'}
 await saveModelConfig(config)
 const banner=document.createElement('div');banner.textContent='固定演示 · 所有模型结果为模拟数据 · 不调用外部 API';banner.style.cssText='background:#fff4cf;padding:6px;text-align:center;font-size:13px';document.body.prepend(banner)
 createRoot(document.getElementById('root')!).render(<App/> )
}
void start().catch(error=>{document.getElementById('root')!.textContent=error.message})
