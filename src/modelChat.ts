import { chatCompletionUrl, modelChatPath, objectRecord, requestModel } from './modelGeneration.ts'
import type { ModelSettings } from './modelGeneration.ts'
import type { Message } from './projects.ts'

type ChatTurn = Pick<Message, 'role' | 'content'>
const contextLimit = 10000
const historyLimit = 10
const messageLimit = 4000

function requireMessageText(text: string): string {
  const content = text.trim()
  if (!content || content.length > messageLimit) throw new Error('请输入 1 到 4000 字的本轮消息。')
  return content
}

function recentTurns(history: readonly ChatTurn[], text: string): ChatTurn[] {
  const content = requireMessageText(text)
  const turns: ChatTurn[] = [{ role: 'user', content }]
  let remaining = contextLimit - content.length

  for (const message of history.slice(-historyLimit).reverse()) {
    if (message.content.length > remaining) break
    turns.unshift({ role: message.role, content: message.content })
    remaining -= message.content.length
  }
  if (turns[0].role === 'assistant') turns.shift()
  return turns
}

export function chatPrompt(input: unknown, model: string) {
  if (!Array.isArray(input) || input.length < 1 || input.length > historyLimit + 1) {
    throw new Error('对话上下文超出限制。')
  }
  const turns = input.map((item: unknown, index): ChatTurn => {
    const { role, content } = objectRecord(item)
    const expected = index % 2 === 0 ? 'user' : 'assistant'
    if (role !== expected || typeof content !== 'string' || !content.trim()) {
      throw new Error('无法读取对话记录。')
    }
    return { role: expected, content }
  })
  const last = turns.at(-1)
  if (last?.role !== 'user' || turns.reduce((total, turn) => total + turn.content.length, 0) > contextLimit) {
    throw new Error('对话上下文超出限制。')
  }
  requireMessageText(last.content)

  return {
    model,
    stream: false,
    max_tokens: 8192,
    messages: [
      {
        role: 'system',
        content: '你是 INNO LIT 创意设计伙伴。用用户的语言回复。结合这段项目对话，澄清目标与约束，提出具体的创意方向、取舍或下一步验证方法。将假设和已知事实区分开，不编造检索、评分或实测结果。用简明的自然文本回复。',
      },
      ...turns,
    ],
  }
}

export async function replyWithModel(
  history: readonly ChatTurn[], text: string, settings: ModelSettings, signal: AbortSignal,
): Promise<Pick<Message, 'content' | 'source'>> {
  const provider = chatCompletionUrl(settings.baseUrl).hostname
  const content = (await requestModel(modelChatPath, { messages: recentTurns(history, text) }, settings, signal)).trim()
  if (!content) throw new Error('模型没有返回可用的回复。请重试或更换模型。')
  return { content, source: { model: settings.model.trim(), provider } }
}
