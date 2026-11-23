import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readWorkbenchBrief, workbenchOrigin } from '../src/iiinnowBridge.ts'

test('embedded bridge admits explicit loopback workbench origins', () => {
  const location = value => ({search: '?iiinnowOrigin=' + encodeURIComponent(value)})
  assert.equal(workbenchOrigin(location('http://127.0.0.1:8765'), true), 'http://127.0.0.1:8765')
  assert.equal(workbenchOrigin(location('http://127.0.0.1:8765'), false), null)
  assert.equal(workbenchOrigin(location('https://example.invalid:8765'), true), null)
  assert.equal(workbenchOrigin(location('http://localhost:8765/path'), true), null)
})

test('embedded bridge accepts only bounded project briefs', () => {
  const data = {type:'iiinnow:brief', id:'p-1', name:'Fixture', intent:'Design brief', audience:'Designers'}
  assert.deepEqual(readWorkbenchBrief({...data, extra:'ignored'}), {
    id:'p-1', name:'Fixture', intent:'Design brief', audience:'Designers',
  })
  assert.equal(readWorkbenchBrief({...data, intent:'x'.repeat(12001)}), null)
  assert.equal(readWorkbenchBrief({...data, type:'other'}), null)
})


test('creative bridge keeps the unsent prompt distinct from the intent', () => {
  const data = {type:'iiinnow:brief', id:'p-2', name:'Fixture', intent:'Baseline', audience:'Designers'}
  assert.deepEqual(readWorkbenchBrief({...data, view:'creative', creativePrompt:'Review current direction'}), {
    id:'p-2', name:'Fixture', intent:'Baseline', audience:'Designers',
    view:'creative', creativePrompt:'Review current direction',
  })
  assert.equal(readWorkbenchBrief({...data, view:'creative', creativePrompt:'x'.repeat(12001)}), null)
  assert.equal(readWorkbenchBrief({...data, view:'unsupported'}), null)
})

