import assert from 'node:assert/strict'
import {test} from 'node:test'
import {viteLaunch,isMainModule} from '../scripts/start-vite.mjs'
test('local Vite launch enables the configured proxy without routing localhost or changing provider credentials',()=>{
 const env={HTTPS_PROXY:'http://127.0.0.1:7890',NO_PROXY:'.example.com',OPENAI_API_KEY:'fixture-key'}
 const result=viteLaunch('D:/project',['preview','--port','5173'],env,true)
 assert.equal(result.args[0],'--use-env-proxy')
 assert.ok(result.args.includes('--port'));assert.ok(result.args.includes('5173'))
 assert.match(result.env.NO_PROXY,/localhost,127\.0\.0\.1,::1/)
 assert.equal(result.env.OPENAI_API_KEY,'fixture-key')
 assert.deepEqual(env,{HTTPS_PROXY:'http://127.0.0.1:7890',NO_PROXY:'.example.com',OPENAI_API_KEY:'fixture-key'})
})
test('launch preserves direct connections and explicit opt-out, and does not silently ignore an unsupported proxy runtime',()=>{
 assert.ok(!viteLaunch('D:/project',[],{},false).args.includes('--use-env-proxy'))
 assert.ok(!viteLaunch('D:/project',[],{HTTPS_PROXY:'http://127.0.0.1:7890',NODE_USE_ENV_PROXY:'0'},false).args.includes('--use-env-proxy'))
 assert.throws(()=>viteLaunch('D:/project',[],{HTTPS_PROXY:'http://127.0.0.1:7890'},false),/Node.js/)
})


test('launcher recognizes its entry through a directory junction or symlink',async context=>{
 const {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync}=await import('node:fs')
 const {tmpdir}=await import('node:os'),{join}=await import('node:path'),{pathToFileURL}=await import('node:url')
 const root=mkdtempSync(join(tmpdir(),'inno-launch-'));context.after(()=>rmSync(root,{recursive:true,force:true}))
 mkdirSync(join(root,'real'));writeFileSync(join(root,'real','entry.mjs'),'export {}')
 symlinkSync(join(root,'real'),join(root,'alias'),process.platform==='win32'?'junction':'dir')
 assert.equal(isMainModule(pathToFileURL(join(root,'real','entry.mjs')).href,join(root,'alias','entry.mjs')),true)
 assert.equal(isMainModule(pathToFileURL(join(root,'real','entry.mjs')).href,join(root,'missing')),false)
})
