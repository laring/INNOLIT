import assert from 'node:assert/strict'
import {test} from 'node:test'
import {imageConnectionMessage,fetchImageService,safeImageFailure} from '../server/imageConnection.ts'
import {generateOpenRouterImage} from '../server/openrouterImageAdapter.ts'
import {generateOpenAIImage} from '../server/openaiImageAdapter.ts'
import {generateConceptImage} from '../src/imageGeneration.ts'
const signal=()=>new AbortController().signal
const failure=code=>new TypeError('fetch failed',{cause:Object.assign(new Error('private upstream detail'),{code})})
test('image network failures distinguish DNS, TLS, timeout and interrupted upstream requests without leaking URLs',()=>{
 for(const [code,expected] of [['ENOTFOUND',/域名解析/],['CERT_HAS_EXPIRED',/证书/],['UND_ERR_CONNECT_TIMEOUT',/超时/],['ECONNRESET',/中断/],['ECONNREFUSED',/被拒绝/]]){
  const message=imageConnectionMessage(failure(code),'https://api.example.com/v1/images?private=secret','请求模型绘图')
  assert.match(message,expected);assert.match(message,/api.example.com/);assert.doesNotMatch(message,/private|secret/)
 }
 assert.equal(imageConnectionMessage(new Error('模型不支持参考图'),'https://example.com','请求模型绘图'),null)
 assert.doesNotMatch(safeImageFailure(new Error('token fixture-secret Bearer fixture-secret'),'https://example.com','请求模型绘图','fixture-secret'),/fixture-secret/)
})
test('OpenAI and OpenRouter connection errors identify the failed stage and never retry paid requests',async context=>{
 let calls=0
 context.mock.method(globalThis,'fetch',async()=>{calls++;throw failure('UND_ERR_CONNECT_TIMEOUT')})
 await assert.rejects(generateOpenAIImage({model:'gpt-image-1.5',prompt:'test',size:'1024x1024'},'fixture-key',signal()),/请求模型绘图.*api.openai.com.*超时/)
 assert.equal(calls,1)
 await assert.rejects(generateOpenRouterImage({model:'fixture',prompt:'test',size:'1024x1024',reference:'data:image/png;base64,iVBORw0KGgo='},'fixture-key',signal()),/查询参考图能力.*openrouter.ai.*超时/)
 assert.equal(calls,2)
 await assert.rejects(fetchImageService('https://example.com/images',{signal:signal()},'下载生成结果'),/下载生成结果.*超时/)
 assert.equal(calls,3)
})
test('a disconnected local image relay produces a local-service message rather than a model capability error',async context=>{
 context.mock.method(globalThis,'fetch',async()=>{throw new TypeError('Failed to fetch')})
 await assert.rejects(generateConceptImage({baseUrl:'https://api.example.com/v1',model:'fixture',apiKey:'fixture-key',size:'1024x1024',protocol:'images'},'sketch',signal()),/本机图片转发服务/)
})

test('OpenAI image authentication errors explain the active provider and never disclose upstream credentials or retry',async context=>{
 const key='fixture-private-api-key'
 const reference='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII='
 let calls=0,code='invalid_api_key',isJson=true
 context.mock.method(globalThis,'fetch',async(url,options)=>{
  calls++
  assert.equal(options.headers.Authorization,`Bearer ${key}`)
  assert.equal(url,options.body instanceof FormData?'https://api.openai.com/v1/images/edits':'https://api.openai.com/v1/images/generations')
  return isJson?Response.json({error:{code,message:`Incorrect API key ${key}, private provider details`}},{status:401}):new Response('private proxy response '+key,{status:401})
 })
 const input={model:'gpt-image-1.5',prompt:'test',size:'1024x1024'}
 for(const value of [undefined,reference]){
  await assert.rejects(generateOpenAIImage({...input,reference:value},key,signal()),error=>{
   assert.match(error.message,/认证失败.*401.*密钥无效/)
   assert.match(error.message,/当前生效.*OpenAI 兼容接口/)
   assert.doesNotMatch(error.message,new RegExp(key+'|private provider'))
   return true
  })
 }
 assert.equal(calls,2)
 code='ip_not_authorized'
 await assert.rejects(generateOpenAIImage(input,key,signal()),/出口 IP.*白名单/)
 isJson=false
 await assert.rejects(generateOpenAIImage(input,key,signal()),error=>{
  assert.match(error.message,/认证失败.*401/);assert.doesNotMatch(error.message,/fixture-private|private proxy/);return true
 })
 assert.equal(calls,4)
})
