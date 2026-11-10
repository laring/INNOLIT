
import { useEffect, useState } from 'react'
import {
  ArrowUp, Lightbulb, Plus, PanelRightClose,
  PanelRightOpen, FolderOpen, Sparkles, Trash2
} from 'lucide-react'
import './App.css'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type Project = {
  id: string
  name: string
  messages: Message[]
  updatedAt: number
}

const STORAGE_KEY = 'inno-lit-v0.1-projects'

function createProject(): Project {
  return {
    id: crypto.randomUUID(),
    name: '未命名设计项目',
    messages: [],
    updatedAt: Date.now()
  }
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

function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as Project[]
        }
      }
    } catch {
      // Ignore invalid local data.
    }
    return [createProject()]
  })

  const [activeId, setActiveId] = useState(
    () => projects[0].id
  )
  const [input, setInput] = useState('')
  const [showResults, setShowResults] = useState(true)

  const activeProject =
    projects.find(project => project.id === activeId)
    ?? projects[0]

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(projects)
    )
  }, [projects])

  function addProject() {
    const project = createProject()
    setProjects(current => [project, ...current])
    setActiveId(project.id)
    setInput('')
  }

  function deleteProject(id: string) {
    const remaining = projects.filter(
      project => project.id !== id
    )
    const next = remaining.length
      ? remaining
      : [createProject()]

    setProjects(next)

    if (activeId === id) {
      setActiveId(next[0].id)
    }
  }

  function sendMessage() {
    const text = input.trim()
    if (!text || !activeProject) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text
    }

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: generateGuidance(text)
    }

    setProjects(current => current.map(project => {
      if (project.id !== activeProject.id) return project

      return {
        ...project,
        name: project.messages.length === 0
          ? text.slice(0, 24)
          : project.name,
        messages: [
          ...project.messages,
          userMessage,
          assistantMessage
        ],
        updatedAt: Date.now()
      }
    }))

    setInput('')
  }

  const latestIdea = [...activeProject.messages]
    .reverse()
    .find(message => message.role === 'user')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Lightbulb size={19} />
          </span>
          <span>INNO LIT</span>
        </div>

        <button
          className="new-project"
          onClick={addProject}
        >
          <Plus size={17} />
          新建设计项目
        </button>

        <div className="section-label">我的项目</div>

        <div className="project-list">
          {projects.map(project => (
            <div
              className={
                'project-item ' +
                (project.id === activeId ? 'active' : '')
              }
              key={project.id}
            >
              <button
                className="project-select"
                onClick={() => {
                  setActiveId(project.id)
                  setInput('')
                }}
              >
                <FolderOpen size={16} />
                <span>{project.name}</span>
              </button>

              <button
                className="delete-project"
                title="删除项目"
                aria-label={`删除项目 ${project.name}`}
                onClick={() => {
                  if (window.confirm(
                    `确定删除“${project.name}”吗？`
                  )) {
                    deleteProject(project.id)
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          V0.1 · Local Workspace
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            工作台 <span>/</span> {activeProject.name}
          </div>

          <button
            className="icon-button"
            title="切换成果面板"
            aria-label="切换成果面板"
            onClick={() => setShowResults(value => !value)}
          >
            {showResults
              ? <PanelRightClose size={19} />
              : <PanelRightOpen size={19} />}
          </button>
        </header>

        <div className="conversation">
          {activeProject.messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon">
                <Sparkles size={25} />
              </div>
              <h1>今天想创造什么？</h1>
              <p>
                从一个问题、一段灵感，或一个尚未成形的想法开始。
              </p>
              <div className="suggestions">
                {[
                  '设计一款帮助学生短暂放松的桌面产品',
                  '探索更环保的一次性水杯',
                  '为儿童设计自然声音启蒙玩具'
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {activeProject.messages.map(message => (
                <div
                  className={`message ${message.role}`}
                  key={message.id}
                >
                  {message.role === 'assistant' && (
                    <div className="assistant-avatar">
                      <Lightbulb size={16} />
                    </div>
                  )}
                  <div className="message-content">
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="composer-area">
          <div className="composer">
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder="描述你的设计问题或创意想法..."
              rows={3}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  sendMessage()
                }
              }}
            />
            <div className="composer-bottom">
              <span>Shift + Enter 换行</span>
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                aria-label="发送想法"
              >
                <ArrowUp size={19} />
              </button>
            </div>
          </div>
          <p className="composer-note">
            当前为本地规则式创意引导，尚未连接 AI 模型。
          </p>
        </div>
      </main>

      {showResults && (
        <aside className="results-panel">
          <div className="results-header">
            <h2>设计成果</h2>
            <span>Workspace</span>
          </div>

          <div className="result-section">
            <div className="section-label">当前概念</div>
            {latestIdea ? (
              <div className="concept-card">
                <div className="concept-icon">
                  <Lightbulb size={18} />
                </div>
                <h3>{activeProject.name}</h3>
                <p>{latestIdea.content}</p>
                <span className="concept-status">
                  初步构思
                </span>
              </div>
            ) : (
              <div className="empty-result">
                输入设计想法后，概念摘要将在这里出现。
              </div>
            )}
          </div>

          <div className="result-section">
            <div className="section-label">设计流程</div>
            <div className="process-list">
              <div>01 · 问题与场景</div>
              <div>02 · 创意方向</div>
              <div>03 · 产品概念</div>
              <div>04 · 可行性验证</div>
              <div>05 · 设计报告</div>
            </div>
          </div>

          <div className="results-footer">
            项目内容保存在当前浏览器
          </div>
        </aside>
      )}
    </div>
  )
}

export default App
