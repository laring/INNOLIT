import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Lightbulb, Sparkles, Square } from 'lucide-react'
import { modelSourceLabel } from './concepts'
import type { ChatIdea } from './concepts'
import { ModelControls } from './ModelControls'
import { replyWithModel } from './modelChat'
import { canUseCustomModel, hasModelSettings } from './modelGeneration'
import type { ModelSettings } from './modelGeneration'
import type { Message } from './projects'

type ChatProps = {
  messages: Message[]
  input: string
  onInputChange: (value: string) => void
  onAppend: (user: Message, assistant: Message) => void
  onTransfer: (idea: ChatIdea) => void
  settings: ModelSettings
  onSettingsChange: (change: Partial<ModelSettings>) => void
}

function generateGuidance(input: string): string {
  return `已记录你的设计想法：${input}

我们可以从三个方向展开：

01 · 用户与场景
明确目标用户、使用环境和核心困难。

02 · 产品与交互
寻找一种简单、直观、可验证的产品解决方式。

03 · 实现与价值
考虑材料、结构、制造可行性与设计价值。

下一步，请描述：这个产品最希望帮助哪一类人？`
}

export function CreativeChat({ messages, input, onInputChange, onAppend, onTransfer, settings, onSettingsChange }: ChatProps) {
  const [customModel, setCustomModel] = useState(false)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const request = useRef<AbortController | null>(null)
  const conversation = useRef<HTMLDivElement>(null)
  const canSend = input.trim() && !pending && (!customModel || hasModelSettings(settings))

  useEffect(() => () => request.current?.abort(), [])

  useEffect(() => {
    const panel = conversation.current
    if (panel) panel.scrollTop = panel.scrollHeight
  }, [messages.length, pending])

  async function sendMessage() {
    if (!canSend || request.current) return
    const text = input.trim()
    const user: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    setNotice('')

    function saveReply(reply: Pick<Message, 'content' | 'source'>) {
      onAppend(user, { id: crypto.randomUUID(), role: 'assistant', ...reply })
      onInputChange('')
    }

    if (!customModel) {
      saveReply({ content: generateGuidance(text) })
      return
    }
    if (!canUseCustomModel(window.location.hostname)) return

    const controller = new AbortController()
    request.current = controller
    setPending(true)
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(150000)])
      const reply = await replyWithModel(messages, text, settings, signal)
      if (!controller.signal.aborted) saveReply(reply)
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof DOMException && error.name === 'TimeoutError'
          ? '等待模型回复超时。'
          : error instanceof Error && !(error instanceof TypeError)
            ? error.message
            : '无法连接模型服务。'
        setNotice(`${message} 消息仍在输入框，可重试。`)
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        if (!controller.signal.aborted) setPending(false)
      }
    }
  }

  function cancelReply() {
    request.current?.abort()
    request.current = null
    setPending(false)
    setNotice('已取消回复。消息仍在输入框。')
  }

  return (
    <div className="chat-workspace">
      <div className="conversation" ref={conversation}>
        {messages.length === 0 && !pending ? (
          <div className="welcome">
            <div className="welcome-icon"><Sparkles size={25} /></div>
            <h1>今天想创造什么？</h1>
            <p>从一个问题、一段灵感，或一个尚未成形的想法开始。</p>
            <div className="suggestions">
              {[
                '设计一款帮助学生短暂放松的桌面产品',
                '探索更环保的一次性水杯',
                '为儿童设计自然声音启蒙玩具',
              ].map(suggestion => (
                <button key={suggestion} type="button" onClick={() => onInputChange(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={message.id}>
                {message.role === 'assistant' && (
                  <div className="assistant-avatar"><Lightbulb size={16} /></div>
                )}
                <div className="message-content">
                  {message.role === 'assistant' && <div className="message-source">{modelSourceLabel(message.source)}</div>}
                  {message.content}
                  {message.role === 'assistant' && (
                    <button
                      type="button"
                      className="message-transfer"
                      disabled={pending}
                      onClick={() => onTransfer({
                        messageId: message.id,
                        question: messages[index - 1]?.role === 'user' ? messages[index - 1].content : '',
                        reply: message.content,
                        source: message.source,
                      })}
                    >
                      转为概念
                    </button>
                  )}
                </div>
              </div>
            ))}
            {pending && <div className="message user"><div className="message-content">{input.trim()}</div></div>}
          </div>
        )}
      </div>

      <div className="composer-area">
        <div className="composer">
          <div className="composer-model">
            <ModelControls
              settings={settings}
              onSettingsChange={change => {
                onSettingsChange(change)
                setNotice('')
              }}
              customModel={customModel}
              onModeChange={custom => {
                setCustomModel(custom)
                setNotice('')
              }}
              disabled={pending}
              requestDescription="发送时会将本轮消息和当前项目的近期对话发送给所选服务。"
            />
          </div>
          <textarea
            value={input}
            onChange={event => onInputChange(event.target.value)}
            placeholder="描述你的设计问题或创意想法..."
            rows={3}
            readOnly={pending}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void sendMessage()
              }
            }}
          />
          <div className="composer-bottom">
            <span>Shift + Enter 换行</span>
            {pending ? (
              <button type="button" onClick={cancelReply} aria-label="取消回复"><Square size={15} /></button>
            ) : (
              <button type="button" onClick={sendMessage} disabled={!canSend} aria-label="发送想法"><ArrowUp size={19} /></button>
            )}
          </div>
        </div>
        <p className="composer-note" role="status">
          {pending ? `正在等待 ${settings.model.trim()} 回复…`
            : notice || (customModel && !hasModelSettings(settings) ? '请完成 API 设置后发送。' : '')}
        </p>
      </div>
    </div>
  )
}
