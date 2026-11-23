import assert from 'node:assert/strict'
import { test } from 'node:test'
import { productImageMessage } from '../src/iiinnowImages.ts'

test('only linked, model-generated product art is offered to the workbench', () => {
  const blob = new Blob(['bytes'], {type:'image/png'})
  const visual = {id:'v1', projectId:'iiinnow-project', blob, workflowKind:'hero',
    prompt:'private prompt', source:{kind:'model', model:'fixture', provider:'example.invalid'}}
  const message = productImageMessage(visual,'iiinnow-project','project')
  assert.equal(message.projectId,'project')
  assert.equal(message.blob,blob)
  assert.equal(message.prompt,undefined)
  assert.equal(productImageMessage(visual,'iiinnow-other','other'),null)
  assert.equal(productImageMessage({...visual,workflowKind:'pcb'},'iiinnow-project','project'),null)
  assert.equal(productImageMessage({...visual,source:{kind:'upload'}},'iiinnow-project','project'),null)
})

