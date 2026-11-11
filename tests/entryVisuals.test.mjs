import assert from 'node:assert/strict'
import { test } from 'node:test'
import { freezeConcept } from '../src/conceptDevelopment.ts'
import { entryBoardGeometry, posterSceneShare, renderEntryBoard } from '../src/entryBoards.ts'
import { consistencyChecks, entryImagePrompt, entryVisualKey, visualProblems } from '../src/entryVisuals.ts'
import { imageRequest, supportsImageReference } from '../src/imageGeneration.ts'
import { developedConcept } from './fixtures/development.mjs'

const frozen = freezeConcept(developedConcept(), 'freeze-1', 1000).development.frozen
function visual(role, digest = role) {
  return { id: role, projectId: 'project', blob: new Blob(['fixture']), source: { kind: 'upload' }, prompt: '', frozenId: frozen.id, role, digest, masterDigest: 'master',
    approval: { checks: Object.fromEntries(Object.keys(consistencyChecks).map(key => [key, true])), composition: `${role} 独立构图`, scene: true, digest, masterDigest: role === 'master' ? digest : 'master', at: 1000 } }
}

test('three-image production blocks missing approvals, stale masters, repeated images and missing poster scenes', () => {
  const records = Object.fromEntries(['master', 'landscape', 'portrait', 'poster'].map(role => [role, visual(role)]))
  for (const role of Object.keys(records)) assert.deepEqual(visualProblems(frozen, role, records[role], records.master, records), [])
  delete records.portrait.approval
  assert.ok(visualProblems(frozen, 'portrait', records.portrait, records.master, records).some(item => item.includes('八项')))
  records.portrait = visual('portrait', 'landscape')
  assert.ok(visualProblems(frozen, 'portrait', records.portrait, records.master, records).some(item => item.includes('重复')))
  records.portrait = visual('portrait')
  records.poster.approval.scene = false
  assert.ok(visualProblems(frozen, 'poster', records.poster, records.master, records).some(item => item.includes('真实使用情境')))
  assert.deepEqual(visualProblems({ ...frozen, sceneException: '此项目为抽象数据编码协议，无实体或使用者场景。' }, 'poster', records.poster, records.master, records), [])
  records.master = visual('master', 'new-master')
  assert.ok(visualProblems(frozen, 'landscape', records.landscape, records.master, records).some(item => item.includes('母版已变化')))
  assert.ok(visualProblems({ ...frozen, id: 'other-freeze' }, 'master', records.master, records.master, records).some(item => item.includes('不属于')))
})

test('image requests require a real reference for derivative entries and never send an unsupported Kolors edit', () => {
  const settings = { baseUrl: 'https://api.siliconflow.cn/v1', model: 'Kwai-Kolors/Kolors', protocol: 'siliconflow', size: '1024x1024', prompt: '冻结设计' }
  const reference = 'data:image/png;base64,iVBORw0KGgo='
  assert.throws(() => imageRequest({ ...settings, purpose: 'portrait' }), /必须携带/)
  assert.throws(() => imageRequest({ ...settings, model: 'Qwen/Qwen-Image-Edit-2509' }), /需要母版图片/)
  assert.throws(() => imageRequest({ ...settings, purpose: 'poster', reference }), /Qwen Image Edit/)
  assert.equal(supportsImageReference(settings), false)
  const edited = imageRequest({ ...settings, model: 'Qwen/Qwen-Image-Edit-2509', purpose: 'landscape', reference })
  assert.equal(edited.payload.image, reference)
  assert.equal('image_size' in edited.payload, false)
  assert.equal('size' in edited.payload, false)
  assert.throws(() => imageRequest({ ...settings, model: 'Qwen/Qwen-Image-Edit-2509', purpose: 'portrait', reference: 'https://private.example/image' }), /格式无效/)
  assert.throws(() => imageRequest({ ...settings, purpose: 'other' }), /未知/)
})

test('frozen prompts share exact product specifications while assigning distinct information roles', () => {
  const prompts = ['landscape', 'portrait', 'poster'].map(role => entryImagePrompt(frozen, role))
  assert.equal(new Set(prompts).size, 3)
  for (const prompt of prompts) {
    for (const value of Object.values(frozen.identity)) assert.ok(prompt.includes(value))
    assert.match(prompt, /不得重新设计/)
    assert.match(prompt, /不要在图片内绘制标题/)
    assert.ok(prompt.length < 14000)
  }
  assert.match(prompts[0], /WHY \+ WHAT \+ Hero Scene/)
  assert.match(prompts[1], /HOW \+ 产品结构/)
  assert.match(prompts[2], /禁止用爆炸图/)
  const identities = [entryVisualKey('p', 1, 'c', 'f1', 'landscape'), entryVisualKey('p', 1, 'c', 'f2', 'landscape'), entryVisualKey('p', 1, 'c', 'f1', 'portrait'), entryVisualKey('q', 1, 'c', 'f1', 'landscape')]
  assert.equal(new Set(identities).size, 4)
})

test('entry boards share title/font, use distinct structures, and give the poster a majority scene image', () => {
  assert.ok(posterSceneShare() > 0.5)
  const calls = []
  const context = new Proxy({ measureText: value => ({ width: [...value].length * 12 }) }, {
    get(target, key) { return key in target ? target[key] : (...args) => calls.push([key, ...args]) },
    set(target, key, value) { target[key] = value; calls.push(['set', key, value]); return true },
  })
  const canvas = { getContext: () => context }
  for (const role of ['landscape', 'portrait', 'poster']) {
    calls.length = 0
    renderEntryBoard(canvas, frozen, role, { width: 1024, height: 1024 }, { kind: 'upload' })
    assert.deepEqual([canvas.width, canvas.height], entryBoardGeometry[role].size)
    assert.ok(calls.some(call => call[0] === 'fillText' && call[1] === frozen.design.title))
    assert.ok(calls.some(call => call[0] === 'set' && call[1] === 'font' && call[2].includes(frozen.identity.titleFont)))
    const image = calls.find(call => call[0] === 'drawImage')
    assert.deepEqual(image.slice(-4), entryBoardGeometry[role].hero)
    const labels = calls.filter(call => call[0] === 'fillText').map(call => call[1]).join('\n')
    if (role === 'landscape') assert.match(labels, /WHY · 为什么需要/)
    if (role === 'portrait') assert.match(labels, /HOW · 产品结构/)
    if (role === 'poster') for (const word of ['PROBLEM', 'INSIGHT', 'SOLUTION', 'MECHANISM', 'USE FLOW', 'VALUE']) assert.ok(labels.includes(word))
  }
})
