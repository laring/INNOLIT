import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderConceptBoard, wrapBoardText } from '../src/conceptBoard.ts'
import { generateConceptBatch } from '../src/concepts.ts'
import { visualKey } from '../src/visualStore.ts'

test('board text wraps CJK and emoji without breaking characters and truncates within its box', () => {
  const measure = value => [...value].length * 10
  assert.deepEqual(wrapBoardText('目标用户\n课间放松', 40, measure, 4), ['目标用户', '课间放松'])
  assert.deepEqual(wrapBoardText('一二三四五六七八九', 40, measure, 2), ['一二三四', '五六七…'])
  assert.deepEqual(wrapBoardText('学生😀休息', 20, measure, 3), ['学生', '😀休', '息'])
  assert.deepEqual(wrapBoardText('一二三四。', 40, measure, 2), ['一二三', '四。'])
})

test('boards export the chosen dimensions and label only images used in the layout', () => {
  const round = generateConceptBatch({ problem: '课间放松', audience: '中学生', scenario: '教室', count: 3 })
  const calls = []
  const context = new Proxy({ measureText: value => ({ width: [...value].length * 12 }) }, {
    get(target, key) { return key in target ? target[key] : (...args) => calls.push([key, ...args]) },
  })
  const canvas = { getContext: () => context }
  const data = { projectName: '测试项目', roundNumber: 2, round, concept: round.concepts[0], image: { width: 100, height: 200 }, imageSource: { kind: 'model', model: 'fixture-model', provider: 'example.com' } }
  for (const [layout, dimensions] of [['diagram', [1400, 1000]], ['landscape', [1600, 1100]], ['portrait', [1200, 1600]]]) {
    calls.length = 0
    renderConceptBoard(canvas, data, layout)
    assert.deepEqual([canvas.width, canvas.height], dimensions)
    assert.equal(calls.filter(call => call[0] === 'drawImage').length, layout === 'diagram' ? 0 : 1)
    const source = calls.find(call => call[0] === 'fillText' && call[1].includes(' | '))[1]
    assert.match(source, layout === 'diagram' ? /本地概念结构图/ : /AI 生成概念图 · fixture-model/)
    assert.match(source, /非 AI/)
  }
})

test('saved image identities distinguish projects, rounds, concepts and delimiter-like IDs', () => {
  const identities = [['p', 1, 'c'], ['p', 2, 'c'], ['q', 1, 'c'], ['p', 1, 'd'], ['p:1', 1, 'c'], ['p', 1, '1:c']]
  assert.equal(new Set(identities.map(args => visualKey(...args))).size, identities.length)
  assert.deepEqual(JSON.parse(visualKey(...identities[0])), identities[0])
})
