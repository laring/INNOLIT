import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addChatConcept, draftFromConcept, generateConceptBatch, maxRoundConcepts } from '../src/concepts.ts'
import { buildDesignReport, formatDesignReport } from '../src/designWork.ts'
import { generateWithModel, modelExtractPath, modelGenerationPath, modelPrompt, modelReviewPath } from '../src/modelGeneration.ts'
import { extractPrompt, extractWithModel, reviewPrompt, reviewWithModel } from '../src/modelStudio.ts'

const brief = { problem: '设计课间放松工具', audience: '中学生', scenario: '课间教室', count: 3 }
const settings = { baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', apiKey: 'fixture-only-token' }
const source = { model: settings.model, provider: 'api.deepseek.com' }
const ratings = {
  novelty: { score: 4, reason: '翻面动作与普通按钮不同。' },
  feasibility: { score: 3, reason: '仍需测试传感器误触。' },
  value: { score: 5, reason: '可减少启动休息的步骤。' },
}

test('model review receives the concepts without human ratings and validates every rating and reason', async context => {
  const batch = generateConceptBatch(brief)
  batch.concepts[0].scores.novelty = 1
  batch.concepts[0].notes = 'private test note'
  let reviews = batch.concepts.map(({ id }) => ({ id, ratings }))
  context.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, modelReviewPath)
    const body = JSON.parse(options.body)
    assert.deepEqual(body.concepts.map(concept => concept.id), batch.concepts.map(concept => concept.id))
    assert.doesNotMatch(options.body, /"scores"|private test note|fixture-only-token/)
    const prompt = reviewPrompt(body, settings.model)
    assert.equal(prompt.response_format.type, 'json_object')
    assert.match(prompt.messages[1].content, /创新性.*可行性|可行性/)
    return Response.json({ content: JSON.stringify({ reviews }) })
  })
  const signal = new AbortController().signal
  const result = await reviewWithModel(batch, settings, signal)
  assert.deepEqual(result.get(batch.concepts[0].id), { ratings, source })
  assert.equal(batch.concepts[0].scores.novelty, 1)
  const good = reviews
  for (const invalid of [
    good.slice(1),
    [good[0], good[0], good[2]],
    [{ ...good[0], ratings: { ...ratings, novelty: { score: 6, reason: '越界' } } }, ...good.slice(1)],
    [{ ...good[0], ratings: { ...ratings, value: { score: 2, reason: ' ' } } }, ...good.slice(1)],
  ]) {
    reviews = invalid
    await assert.rejects(reviewWithModel(batch, settings, signal), /完整的评分和理由/)
  }
})

test('model extraction produces an editable candidate from one selected reply', async context => {
  context.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, modelExtractPath)
    const { reply, focus } = JSON.parse(options.body)
    assert.equal(reply, '试试一块翻面的计时小牌。')
    assert.equal(focus, '翻面')
    const concept = {
      title: '翻面计时牌', format: '桌面工具', idea: reply, interaction: '翻面开始计时。',
      difference: '用朝向触发。', value: '可简化启动。', risk: '需验证误触。', test: '做纸板原型并观察。',
    }
    return Response.json({ content: JSON.stringify({ concept }) })
  })
  const result = await extractWithModel(brief, '试试一块翻面的计时小牌。', '翻面', settings, new AbortController().signal)
  assert.equal(result.candidate.title, '翻面计时牌')
  assert.equal(result.candidate.sentences.scenario, '概念用于「课间教室」这一情境。')
  assert.deepEqual(result.source, source)
})

test('chat imports preserve prior selections and scores and include source and separate model reasons in the report', () => {
  const round = generateConceptBatch(brief)
  round.concepts[0].scores.novelty = 1
  round.concepts[0].modelReview = { ratings, source }
  round.selectedId = round.concepts[0].id
  const state = { draft: brief, rounds: [round], activeRound: 0 }
  const candidate = {
    id: 'chat-card',
    title: '来自对话的方案',
    format: round.concepts[0].format,
    sentences: round.concepts[0].sentences,
    chatOrigin: { messageId: 'assistant-1', source, organizedBy: source },
  }
  const otherBrief = { ...brief, audience: '不同用户' }
  const merged = addChatConcept(state, 0, otherBrief, candidate)
  const active = merged.rounds[0]
  assert.equal(active.selectedId, round.selectedId)
  assert.equal(active.concepts.length, 4)
  assert.equal(active.concepts[0], round.concepts[0])
  assert.equal(active.concepts[3].scores.novelty, null)
  assert.equal(active.concepts[3].modelReview, undefined)
  assert.match(active.concepts[3].sentences.audience, /中学生/)
  assert.equal(active.concepts[3].chatOrigin.messageId, 'assistant-1')

  const report = formatDesignReport(buildDesignReport('项目', active, 1, active.concepts[0]))
  assert.match(report, /人工评分与深化/)
  assert.match(report, /创新性\*\* 1 \/ 5/)
  assert.match(report, /模型评分与理由/)
  assert.match(report, /4 \/ 5 · 翻面动作与普通按钮不同/)

  const separate = addChatConcept(state, null, otherBrief, candidate)
  assert.equal(separate.draft, state.draft)
  assert.equal(separate.rounds[1].origin, 'chat')
  assert.equal(separate.rounds[1].concepts.length, 1)
  assert.match(formatDesignReport(buildDesignReport('项目', separate.rounds[1], 2, separate.rounds[1].concepts[0])), /来自创意对话/)
  const full = { ...state, rounds: [{ ...round, concepts: Array(maxRoundConcepts).fill(round.concepts[0]) }] }
  assert.equal(addChatConcept(full, 0, brief, candidate), full)
})

test('the model can organize a concept and a brief before the user has supplied every brief field', async context => {
  const original = { ...brief, audience: '', scenario: '课间教室' }
  context.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, modelExtractPath)
    const input = JSON.parse(options.body)
    assert.equal(input.brief.audience, '')
    assert.match(extractPrompt(input, settings.model).messages[1].content, /同时整理一份可编辑的设计简报/)
    return Response.json({ content: JSON.stringify({
      brief: { problem: '让备考学生快速进入休息', audience: '备考学生', scenario: '图书馆' },
      concept: {
        title: '计时小牌', format: '桌面工具', idea: '翻面启动计时。',
        interaction: '翻面休息。', difference: '使用朝向。', value: '简化启动。',
        risk: '待验证误触。', test: '试用纸板原型。',
      },
    }) })
  })
  const organized = await extractWithModel(original, '为备考学生做一块翻面计时小牌。', '', settings, new AbortController().signal)
  assert.deepEqual(organized.brief, { ...original, problem: '让备考学生快速进入休息', audience: '备考学生' })
  assert.match(organized.candidate.sentences.audience, /备考学生/)
})

test('saving a chat concept can fill an incomplete brief without replacing its comparison round', () => {
  const existing = generateConceptBatch(brief)
  const current = { ...brief, count: 5 }
  const state = { draft: current, rounds: [existing], activeRound: 0 }
  const incomplete = { ...brief, problem: '保留对话中的翻面动作', audience: '' }
  const candidate = { ...existing.concepts[0], id: 'source-card', title: '翻面卡片' }
  const saved = addChatConcept(state, 0, incomplete, candidate, true)
  assert.equal(saved.rounds[0].brief, existing.brief)
  assert.equal(saved.rounds[0].concepts.length, 4)
  assert.equal(saved.draft.problem, incomplete.problem)
  assert.equal(saved.draft.audience, '')
  assert.equal(saved.draft.count, 5)
  assert.deepEqual(saved.draft.startingPoint, {
    text: candidate.sentences.idea,
    source: { conceptId: 'source-card', title: '翻面卡片' },
  })
  assert.throws(() => generateConceptBatch(saved.draft), /目标用户/)

  const reused = draftFromConcept(current, brief, candidate)
  const generated = generateConceptBatch(reused)
  assert.equal(generated.concepts.length, 5)
  assert.equal(new Set(generated.concepts.map(concept => concept.sentences.idea)).size, 5)
  assert.ok(generated.concepts.every(concept => concept.sentences.idea.includes(candidate.sentences.idea)))
  assert.match(formatDesignReport(buildDesignReport('演示', generated, 2, generated.concepts[0])), /起点概念\*\* 翻面卡片/)
})

test('model generation receives the edited starting point and records it in the generated round', async context => {
  const startingPoint = { text: '把翻面动作改成触感明确的滑动。', source: { conceptId: 'local-card-id', title: '原翻面牌' } }
  context.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, modelGenerationPath)
    const input = JSON.parse(options.body)
    assert.deepEqual(input.brief.startingPoint, startingPoint)
    const prompt = modelPrompt(input.brief, settings.model).messages[1].content
    assert.match(prompt, /把翻面动作改成触感明确的滑动/)
    assert.match(prompt, /每个方案都要明确继承其中一个关键要素/)
    assert.doesNotMatch(prompt, /local-card-id/)
    return Response.json({ content: JSON.stringify({ concepts: Array.from({ length: 3 }, (_, index) => ({
      title: `变体 ${index + 1}`, format: '原型', idea: `使用滑动机制 ${index + 1}。`,
      interaction: '移动滑块。', difference: '滑块反馈。', value: '降低误触。',
      risk: '待验证。', test: '观察滑块操作。',
    })) }) })
  })
  const batch = await generateWithModel({ ...brief, startingPoint }, settings, new AbortController().signal)
  assert.deepEqual(batch.brief.startingPoint, startingPoint)
  assert.equal(batch.concepts.length, 3)
})
