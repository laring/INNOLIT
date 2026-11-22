import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyModelConfig,saveModelConfig,loadModelConfig,forgetModelConfig,modelConfigStorageKey,validateModelConfig } from '../src/modelConfigStore.ts'
const memory=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)}}
const key=()=>crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt'])
function fixture(){const config=emptyModelConfig();config.text={baseUrl:'https://example.com/v1',model:'default-text-test',apiKey:'fixture-default-private-key'};config.image={...config.image,baseUrl:'https://images.example.com/v1',model:'image-test',apiKey:'fixture-image-private-key',protocol:'openrouter'};config.workflow.engineering={...config.text,model:'engineering-test',apiKey:'fixture-engineering-private-key'};config.workflow.visual={...config.image,model:'dedicated-image',apiKey:'fixture-dedicated-image-key'};config.workflow.report={...config.text,model:'report-test',apiKey:''};return config}
test('encrypted model settings restore defaults, overrides, protocols and exact independent keys',async()=>{
 const storage=memory(),secret=await key(),config=fixture()
 assert.equal(secret.extractable,false)
 await saveModelConfig(config,storage,async()=>secret)
 const first=storage.getItem(modelConfigStorageKey)
 for(const needle of ['fixture-','example.com','engineering-test','default-text-test','image-test'])assert.ok(!first.includes(needle))
 assert.deepEqual(await loadModelConfig(storage,async()=>secret),config)
 await saveModelConfig(config,storage,async()=>secret)
 assert.notEqual(storage.getItem(modelConfigStorageKey),first)
 assert.deepEqual(config,fixture())
 forgetModelConfig(storage)
 assert.equal(await loadModelConfig(storage,async()=>secret),null)
})
test('damaged ciphertext, wrong keys and invalid configuration cannot restore or override valid data',async()=>{
 const storage=memory(),secret=await key();await saveModelConfig(fixture(),storage,async()=>secret)
 const original=storage.getItem(modelConfigStorageKey)
 await assert.rejects(loadModelConfig(storage,key))
 const envelope=JSON.parse(original);envelope.ciphertext='AAAA'+envelope.ciphertext.slice(4);storage.setItem(modelConfigStorageKey,JSON.stringify(envelope));await assert.rejects(loadModelConfig(storage,async()=>secret))
 assert.throws(()=>validateModelConfig({...fixture(),image:{...fixture().image,protocol:'invalid'}}))
 assert.throws(()=>validateModelConfig({...fixture(),text:{...fixture().text,apiKey:'x'.repeat(2049)}}))
 const legacy=fixture();delete legacy.workflow.engineering;assert.equal(validateModelConfig(legacy).workflow.engineering,null)
})
test('aborted writes do not repopulate cleared credentials and storage errors are surfaced',async()=>{
 const storage=memory(),secret=await key(),controller=new AbortController();controller.abort()
 await assert.rejects(saveModelConfig(fixture(),storage,async()=>secret,controller.signal))
 assert.equal(storage.getItem(modelConfigStorageKey),null)
 await assert.rejects(saveModelConfig(fixture(),{...storage,setItem:()=>{throw new Error('quota')}},async()=>secret),/quota/)
})
