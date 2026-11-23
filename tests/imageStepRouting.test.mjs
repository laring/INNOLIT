import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createEmptyRouting,createEmptyWorkflowRouting,resolveWorkflowModels} from '../src/aiModelRouter.ts'
import {emptyModelConfig,validateModelConfig} from '../src/modelConfigStore.ts'
test('three image tasks inherit, override whole configurations and restore independently',()=>{
 const config=emptyModelConfig();config.image={baseUrl:'https://default.example/v1',apiKey:'default-fixture',model:'default',protocol:'images',size:'1024x1024'}
 const workflow=createEmptyWorkflowRouting(),legacy=createEmptyRouting()
 const resolve=()=>resolveWorkflowModels(workflow,legacy,config.text,config.image)
 assert.deepEqual(resolve().sketchImage,config.image)
 workflow.visual={...config.image,model:'visual-default'}
 assert.equal(resolve().heroImage.model,'visual-default')
 for(const task of ['sketchImage','heroImage','presentationImage'])workflow[task]={...config.image,baseUrl:'https://'+task.toLowerCase()+'.example/v1',apiKey:task+'-fixture',model:task,protocol:'openai'}
 for(const task of ['sketchImage','heroImage','presentationImage'])assert.deepEqual(resolve()[task],workflow[task])
 const restored=validateModelConfig({...config,workflow})
 assert.deepEqual(restored.workflow,workflow)
 workflow.heroImage=null
 assert.equal(resolve().heroImage.model,'visual-default');assert.equal(resolve().sketchImage.model,'sketchImage');assert.equal(resolve().presentationImage.model,'presentationImage')
 const old=validateModelConfig(config)
 assert.equal(resolveWorkflowModels(old.workflow,legacy,old.text,old.image).presentationImage.model,'default')
 assert.throws(()=>validateModelConfig({...config,workflow:{...workflow,presentationImage:{...workflow.presentationImage,protocol:'unknown'}}}),/协议/)
})
