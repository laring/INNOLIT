import assert from 'node:assert/strict'
import { test } from 'node:test'
import { productOutputSize, productOutputLayout, containProductImage, productSizePrompt } from '../src/productImageLayout.ts'
import { workflowOf, workflowContext } from '../src/productWorkflow.ts'
import { generateConceptBatch } from '../src/concepts.ts'
import { loadProjects } from '../src/projects.ts'
const conceptOf = () => generateConceptBatch({ problem: '休息', audience: '学生', scenario: '桌面', count: 3 }).concepts[0]
test('five design steps keep independent layout preferences across project reloads without invalidating product identity', () => {
  const concept = conceptOf(), workflow = workflowOf(concept)
  const key = workflowContext(concept, 'hero')
  assert.deepEqual(productOutputSize(concept, 'render'), { layout: 'landscape', width: 1600, height: 1000 })
  concept.productWorkflow = { ...workflow, outputSizes: { render: { layout: 'custom', width: 700, height: 1100 } } }
  assert.equal(workflowContext(concept, 'hero'), key)
  assert.equal(productOutputSize(concept, 'sketches').width, 1600)
  const project = { id: 'layout-test', name: 'test', messages: [], conceptStudio: { rounds: [{ concepts: [concept] }] } }
  const restored = loadProjects({ getItem: () => JSON.stringify([project]) })[0].conceptStudio.rounds[0].concepts[0]
  assert.deepEqual(productOutputSize(restored, 'render'), { layout: 'custom', width: 700, height: 1100 })
  assert.deepEqual(productOutputLayout(productOutputSize(concept, 'render'), 'portrait'), { layout: 'portrait', width: 1000, height: 1600 })
  assert.equal(productOutputLayout(productOutputSize(concept, 'render'), 'square').width, 1200)
})
test('exact-size exports contain the entire product without cropping or distortion and reject unsafe dimensions', () => {
  const size = { layout: 'custom', width: 700, height: 1100 }
  const rect = containProductImage(1536, 1024, size)
  assert.equal(rect.width, 700)
  assert.equal(rect.height, 700 * 1024 / 1536)
  assert.ok(rect.top > 0)
  assert.equal(rect.left, 0)
  assert.match(productSizePrompt(size), /700 x 1100 px/)
  for (const [width,height] of [[0,1000],[320.5,1000],[6000,6000],[320,2000],[Infinity,1000]]) {
    assert.throws(() => containProductImage(1000,1000,{...size,width,height}))
    assert.throws(() => productSizePrompt({...size,width,height}))
  }
  assert.throws(() => containProductImage(0,1000,size))
})
