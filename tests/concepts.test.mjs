import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appendConceptRound, averageScore, generateConceptBatch, sentenceLabels } from '../src/concepts.ts'
import { getProjectStudio, loadProjects, STORAGE_KEY } from '../src/projects.ts'

const brief = {
  problem: '  如何让学生在课间放松？  ',
  audience: '  高中生  ',
  scenario: '  教室课间  ',
  count: 3,
}

test('generates 3–6 distinct, deterministic concepts with nine labeled sentences', () => {
  for (const count of [3, 4, 5, 6]) {
    const input = { ...brief, count }
    const batch = generateConceptBatch(input)
    assert.deepEqual(batch, generateConceptBatch(input))
    assert.equal(batch.concepts.length, count)
    assert.equal(new Set(batch.concepts.map(concept => concept.id)).size, count)
    assert.equal(new Set(batch.concepts.map(concept => concept.format)).size, count)
    assert.equal(new Set(batch.concepts.map(concept => concept.sentences.difference)).size, count)
    assert.equal(batch.selectedId, null)
    assert.equal(batch.brief.problem, brief.problem.trim())

    for (const concept of batch.concepts) {
      assert.deepEqual(Object.keys(concept.sentences), Object.keys(sentenceLabels))
      assert.ok(Object.values(concept.sentences).every(sentence => sentence.endsWith('。')))
      assert.match(concept.sentences.audience, /高中生/)
      assert.match(concept.sentences.scenario, /教室课间/)
      assert.deepEqual(concept.scores, { novelty: null, feasibility: null, value: null })
      assert.equal(concept.notes, '')
    }
  }
})

test('uses different mechanisms and validation measures for matching problems and a fallback', () => {
  const cases = [
    ['课间放松', /一分钟计时/, /恢复原活动/],
    ['一次性水杯', /可清洗套件/, /完成归还/],
    ['启蒙声音玩具', /手摇声音盒/, /匹配声音与来源/],
    ['解决钥匙太难找的问题', /便携工具/, /关键步骤的次数和耗时/],
  ]
  for (const [problem, mechanism, measure] of cases) {
    const [concept] = generateConceptBatch({ ...brief, problem }).concepts
    assert.match(concept.sentences.idea, mechanism)
    assert.match(concept.sentences.test, measure)
  }
})

test('rejects incomplete briefs and counts outside the supported range', () => {
  for (const field of ['problem', 'audience', 'scenario']) {
    assert.throws(() => generateConceptBatch({ ...brief, [field]: '   ' }))
  }
  for (const count of [2, 3.5, 7, NaN]) {
    assert.throws(() => generateConceptBatch({ ...brief, count }))
  }
})

test('reports an equal-weight average only after all manual scores are filled', () => {
  assert.equal(averageScore({ novelty: null, feasibility: 4, value: 5 }), null)
  assert.equal(averageScore({ novelty: 1, feasibility: 3, value: 5 }), 3)
  assert.equal(averageScore({ novelty: 5, feasibility: 4, value: 4 }).toFixed(1), '4.3')
})

test('loads V0.1 conversations and keeps studio state with its owning project', () => {
  const legacyProject = {
    id: 'old-project',
    name: '已有设计项目',
    messages: [
      { id: 'first', role: 'user', content: '较早的想法' },
      { id: 'latest', role: 'user', content: brief.problem.trim() },
      { id: 'reply', role: 'assistant', content: '已记录你的设计想法' },
    ],
    updatedAt: 1,
  }
  let saved = JSON.stringify([legacyProject])
  const storage = {
    getItem(key) {
      assert.equal(key, STORAGE_KEY)
      return saved
    },
  }
  const [loaded] = loadProjects(storage)
  assert.deepEqual(loaded, legacyProject)
  assert.deepEqual(getProjectStudio(loaded), {
    draft: { problem: brief.problem.trim(), audience: '', scenario: '', count: 3 },
    rounds: [],
    activeRound: -1,
  })

  const batch = generateConceptBatch(brief)
  batch.selectedId = batch.concepts[1].id
  batch.concepts[1].scores.value = 4
  batch.concepts[1].notes = '记录触发提示后是否自主完成'
  const studio = { draft: { ...batch.brief, count: 6 }, batch }
  const upgraded = { ...loaded, conceptStudio: studio }
  const other = { id: 'new-project', name: '另一个项目', messages: [], updatedAt: 2 }
  saved = JSON.stringify([upgraded, other])
  const [reopened, reopenedOther] = loadProjects(storage)
  assert.deepEqual(reopened.messages, legacyProject.messages)
  const migrated = getProjectStudio(reopened)
  assert.deepEqual(migrated, { draft: studio.draft, rounds: [batch], activeRound: 0 })
  assert.deepEqual(getProjectStudio(reopenedOther).rounds, [])
  assert.equal(getProjectStudio(reopenedOther).draft.problem, '')

  const updated = appendConceptRound(migrated)
  assert.equal(updated.activeRound, 1)
  assert.equal(updated.rounds[1].concepts.length, 6)
  assert.equal(updated.rounds[1].selectedId, null)
  assert.equal(updated.rounds[1].concepts[1].scores.value, null)
  assert.equal(updated.rounds[1].concepts[1].notes, '')
  assert.deepEqual(updated.rounds[0], batch)
  assert.equal(updated.rounds[0].brief.count, 3)

  // Opening an older round must persist without changing the draft for the next round.
  const browsingHistory = { ...updated, activeRound: 0 }
  saved = JSON.stringify([{ ...upgraded, conceptStudio: browsingHistory }, other])
  const [savedHistory, savedOther] = loadProjects(storage)
  assert.deepEqual(getProjectStudio(savedHistory), browsingHistory)
  assert.deepEqual(getProjectStudio(savedOther).rounds, [])
})

test('appends a new round when viewing an older one without replacing any saved round', () => {
  const first = appendConceptRound({ draft: brief, rounds: [], activeRound: -1 })
  const second = appendConceptRound({ ...first, draft: { ...brief, count: 4 } })
  const third = appendConceptRound({ ...second, activeRound: 0, draft: { ...brief, count: 5 } })
  assert.equal(third.activeRound, 2)
  assert.deepEqual(third.rounds.map(round => round.concepts.length), [3, 4, 5])
  assert.deepEqual(third.rounds.slice(0, 2), second.rounds)
})
