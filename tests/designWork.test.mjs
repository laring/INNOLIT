import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateConceptBatch } from '../src/concepts.ts'
import { buildDesignReport, emptyValidation, evidenceUrl, formatDesignReport, updateValidation } from '../src/designWork.ts'
import { searchPapers } from '../src/paperSearch.ts'
import { getProjectStudio, loadProjects } from '../src/projects.ts'

const brief = {
  problem: '学生如何在课间放松？',
  audience: '备考高中生',
  scenario: '课间教室桌面',
  count: 3,
}

test('requires a threshold and observations before recording a validation result', () => {
  const plan = updateValidation(emptyValidation, { outcome: 'pass' })
  assert.equal(plan.outcome, 'pending')
  const judged = updateValidation(plan, { criteria: '5 人中 4 人完成', observations: '5 人中 4 人完成', outcome: 'pass' })
  assert.equal(judged.outcome, 'pass')
  assert.equal(updateValidation(judged, { observations: '复测 5 人中 2 人完成' }).outcome, 'pending')
  assert.equal(updateValidation(judged, { observations: '  ' }).outcome, 'pending')
  assert.equal(emptyValidation.observations, '')
})

test('normalizes web evidence and rejects non-web or credential-bearing links', () => {
  assert.equal(evidenceUrl('  https://example.com  '), 'https://example.com/')
  for (const url of ['javascript:alert(1)', 'file:///notes', 'data:text/html,test', 'example.com', 'https://user:secret@example.com']) {
    assert.equal(evidenceUrl(url), null)
  }
})

test('exports the chosen round and concept, including manual validation and linked evidence', () => {
  const round = generateConceptBatch(brief)
  const [concept, other] = round.concepts
  concept.notes = '原型笔记\n<script>内容</script>'
  concept.scores = { novelty: 5, feasibility: null, value: 4 }
  concept.validation = updateValidation(emptyValidation, {
    prototype: '可翻面小牌', criteria: '至少 4 人完成', observations: '实测 4 人完成', outcome: 'pass',
  })
  concept.research = {
    keywords: '课间放松 计时器',
    evidence: [
      { id: 'paper', title: '已核对论文', source: 'paper', url: 'https://doi.org/10.1234/demo', comparison: '计时方式不同' },
    ],
  }
  other.notes = '另一个方案的笔记'

  const report = buildDesignReport('设计演示', round, 2, concept)
  assert.equal(report.sections.find(section => section.heading === '九句话概念').entries.length, 9)
  const markdown = formatDesignReport(report)
  for (const text of ['第 2 轮', '课间教室桌面', '原型笔记', '未评分', '未完成评分', '实测 4 人完成', '达到标准', '计时方式不同', '<https://doi.org/10.1234/demo>']) {
    assert.ok(markdown.includes(text), text)
  }
  assert.ok(markdown.includes('&lt;script&gt;'))
  assert.ok(!markdown.includes('<script>'))
  assert.ok(!markdown.includes(other.notes))
})

test('restores validation and evidence alongside old concepts without inventing results', () => {
  const round = generateConceptBatch(brief)
  const [concept, oldConcept] = round.concepts
  concept.validation = updateValidation(emptyValidation, { method: '测量操作耗时' })
  concept.research = { keywords: '桌面 计时器', evidence: [] }
  const stored = { id: 'demo', name: '验证项目', messages: [], updatedAt: 1, conceptStudio: { draft: brief, rounds: [round], activeRound: 0 } }
  const [project] = loadProjects({ getItem: () => JSON.stringify([stored]) })
  assert.deepEqual(getProjectStudio(project).rounds[0], round)

  const oldReport = formatDesignReport(buildDesignReport('验证项目', round, 1, oldConcept))
  assert.match(oldReport, /待验证/)
  assert.match(oldReport, /尚未记录参考来源/)
  assert.doesNotMatch(oldReport, /测量操作耗时/)
})

test('requests public Crossref metadata and ignores malformed or duplicate records', async context => {
  const controller = new AbortController()
  context.mock.method(globalThis, 'fetch', async (endpoint, options) => {
    assert.equal(endpoint.origin, 'https://api.crossref.org')
    assert.equal(endpoint.searchParams.get('query.bibliographic'), 'classroom breaks')
    assert.equal(options.credentials, 'omit')
    assert.equal(options.signal, controller.signal)
    return Response.json({ message: { items: [
      { DOI: '10.1234/test#result', title: ['  A study  '] },
      { DOI: '10.1234/test#result', title: ['Duplicate'] },
      { DOI: 'not-a-doi', title: ['Invalid'] },
      { DOI: '10.1234/empty', title: [] },
      { DOI: '10.1234/wrong-type', title: 'Malformed' },
      null,
    ] } })
  })
  assert.deepEqual(await searchPapers('classroom breaks', controller.signal), [
    { title: 'A study', url: 'https://doi.org/10.1234/test%23result' },
  ])
})

test('reports a failed Crossref request so the interface can offer manual entry', async context => {
  context.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429 }))
  await assert.rejects(searchPapers('timer', new AbortController().signal), /暂不可用/)
})
