import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateConceptBatch } from '../src/concepts.ts'
import { freezeConcept } from '../src/conceptDevelopment.ts'
import { pageSizeProblem, productSketchOf, setPageLayout, simpleVisualKey, visualImagePrompt, visualPageRoles, visualSettingsOf, visualSubjectOf } from '../src/conceptVisuals.ts'
import { renderVisualPage, visualGeometry } from '../src/visualIllustration.ts'
import { imageRequest } from '../src/imageGeneration.ts'
import { getProjectStudio, loadProjects } from '../src/projects.ts'
import { brief, developedConcept } from './fixtures/development.mjs'

test('visual studio opens with three local pages without requiring AI configuration or a freeze', () => {
  const concept = generateConceptBatch(brief).concepts[0]
  const prefs = visualSettingsOf(concept)
  assert.equal(prefs.count, 3)
  assert.equal(prefs.mode, 'local')
  assert.equal(concept.development, undefined)
  assert.equal(visualSubjectOf(concept).title, concept.title)
  assert.equal(visualSubjectOf(concept).version, '当前概念')
  concept.visualStudio = { ...prefs, count: 2, active: 'interaction', pages: { ...prefs.pages, interaction: setPageLayout(prefs.pages.interaction, 'square') } }
  const batch = generateConceptBatch(brief); batch.concepts[0] = concept
  const project = { id: 'p', name: '视觉测试', messages: [], updatedAt: 1, conceptStudio: { draft: brief, rounds: [batch], activeRound: 0 } }
  const [saved] = loadProjects({ getItem: () => JSON.stringify([project]) })
  assert.deepEqual(visualSettingsOf(getProjectStudio(saved).rounds[0].concepts[0]), concept.visualStudio)
  assert.equal(visualSettingsOf(batch.concepts[1]).count, 3)
})

test('page layouts preserve captions and custom pixel dimensions while rejecting unsafe canvas sizes', () => {
  const page = { layout: 'custom', width: 1800, height: 900, description: '保留这条说明' }
  assert.deepEqual(setPageLayout(page, 'portrait'), { layout: 'portrait', width: 1000, height: 1600, description: page.description })
  assert.deepEqual(setPageLayout(page, 'custom'), page)
  for (const size of [[1800, 900], [3508, 4961], [320, 320], [6000, 1000]]) {
    const error = pageSizeProblem({ width: size[0], height: size[1] })
    assert.equal(error, size[0] / size[1] > 4 ? '宽高比请保持在 1:4 到 4:1 之间。' : '')
  }
  for (const [width, height] of [[0, 1000], [Infinity, 1000], [900.5, 1200], [6001, 1000], [6000, 6000], [320, 6000]]) {
    assert.ok(pageSizeProblem({ width, height }))
  }
})

test('local sketches and shared AI prompts use the same chosen concept identity across the three views', () => {
  const concept = developedConcept()
  const subject = visualSubjectOf(concept)
  assert.equal(subject.version, '完善稿')
  const frozen = freezeConcept(concept, 'f1', 1)
  const fixed = visualSubjectOf(frozen)
  assert.equal(fixed.version, '冻结 V1')
  assert.equal(fixed.title, frozen.development.frozen.design.title)
  assert.equal(productSketchOf(fixed).main, '#234235')
  const prompts = visualPageRoles.map(role => visualImagePrompt(fixed, role))
  assert.equal(new Set(prompts).size, 3)
  for (const prompt of prompts) {
    assert.ok(prompt.includes(fixed.title))
    assert.ok(prompt.includes(fixed.identity.proportions))
    assert.match(prompt, /不得为不同图片重新设计/)
  }
  concept.notes += '改变简报记录'
  assert.equal(visualSubjectOf(concept).version, '当前概念')
  assert.notEqual(simpleVisualKey('p', 1, 'c', 'draft', 'overview'), simpleVisualKey('p', 1, 'c', 'f1', 'overview'))
  assert.notEqual(simpleVisualKey('p', 1, 'c', 'draft', 'overview'), simpleVisualKey('p', 1, 'c', 'draft', 'story'))
})

test('built-in renderer produces distinct compositions at exact requested dimensions with non-AI labels', () => {
  const concept = generateConceptBatch(brief).concepts[0]
  const subject = visualSubjectOf(concept)
  const prefs = visualSettingsOf(concept)
  const compositions = []
  for (const role of visualPageRoles) {
    const calls = []
    const context = new Proxy({ measureText: value => ({ width: [...value].length * 10 }) }, {
      get(target, key) { return key in target ? target[key] : (...args) => calls.push([key, ...args]) },
    })
    const canvas = { getContext: () => context }
    renderVisualPage(canvas, subject, role, prefs.pages[role])
    assert.deepEqual([canvas.width, canvas.height], [prefs.pages[role].width, prefs.pages[role].height])
    const copy = calls.filter(call => call[0] === 'fillText').map(call => call[1]).join('\n')
    assert.match(copy, /本地概念示意 · 非 AI/)
    assert.ok(copy.includes(subject.title))
    assert.equal(calls.filter(call => call[0] === 'drawImage').length, 0)
    compositions.push(JSON.stringify(calls))
  }
  assert.equal(new Set(compositions).size, 3)
  const custom = { layout: 'custom', width: 1800, height: 1200, description: '' }
  const geometry = visualGeometry(custom, 'story')
  assert.ok(geometry.hero[2] * geometry.hero[3] / (custom.width * custom.height) > .5)
  assert.throws(() => visualGeometry({ ...custom, width: 0 }, 'overview'), /宽和高/)
})

test('simple AI mode permits ordinary Kolors generation while preserving reference-edit validation', () => {
  const input = { baseUrl: 'https://api.siliconflow.cn/v1', model: 'Kwai-Kolors/Kolors', protocol: 'siliconflow', size: '1024x1024', prompt: '概念场景', purpose: 'concept' }
  const request = imageRequest(input)
  assert.equal(request.payload.image_size, '1024x1024')
  assert.equal('image' in request.payload, false)
  assert.throws(() => imageRequest({ ...input, model: 'Qwen/Qwen-Image-Edit-2509' }), /需要.*(?:母版|参考).*图/)
  assert.throws(() => imageRequest({ ...input, purpose: 'portrait' }), /必须携带/)
})
