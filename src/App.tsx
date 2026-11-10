
import { useEffect, useState } from 'react'
import {
  Lightbulb, Plus, PanelRightClose,
  PanelRightOpen, FolderOpen, Trash2
} from 'lucide-react'
import { ConceptStudio } from './ConceptStudio'
import { CreativeChat } from './CreativeChat'
import type { ConceptStudioState } from './concepts'
import type { ModelSettings } from './modelGeneration'
import { createProject, getProjectStudio, loadProjects, STORAGE_KEY } from './projects'
import type { Message } from './projects'
import './App.css'

function App() {
  const [projects, setProjects] = useState(loadProjects)
  const [activeId, setActiveId] = useState(
    () => projects[0].id
  )
  const [input, setInput] = useState('')
  const [showResults, setShowResults] = useState(true)
  const [view, setView] = useState<'workspace' | 'studio'>('workspace')
  const [saveFailed, setSaveFailed] = useState(false)
  const [modelSettings, setModelSettings] = useState<ModelSettings>({ baseUrl: '', model: '', apiKey: '' })

  const activeProject =
    projects.find(project => project.id === activeId)
    ?? projects[0]

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
      // Report the outcome of writing to browser storage.
      // oxlint-disable-next-line react/set-state-in-effect
      setSaveFailed(false)
    } catch {
      // oxlint-disable-next-line react/set-state-in-effect
      setSaveFailed(true)
    }
  }, [projects])

  function updateStudio(update: (current: ConceptStudioState) => ConceptStudioState) {
    const updatedAt = Date.now()
    setProjects(current => current.map(project => project.id === activeProject.id
      ? { ...project, conceptStudio: update(getProjectStudio(project)), updatedAt }
      : project))
  }

  function editModelSettings(change: Partial<ModelSettings>) {
    setModelSettings(current => {
      const next = { ...current, ...change }
      if (next.baseUrl.trim() !== current.baseUrl.trim()) next.apiKey = ''
      return next
    })
  }

  function addProject() {
    const project = createProject()
    setProjects(current => [project, ...current])
    setActiveId(project.id)
    setInput('')
  }

  function deleteProject(id: string) {
    const replacement = createProject()
    setProjects(current => {
      const remaining = current.filter(project => project.id !== id)
      return remaining.length ? remaining : [replacement]
    })

    if (activeId === id) {
      setActiveId(projects.find(project => project.id !== id)?.id ?? replacement.id)
      setInput('')
    }
  }

  function appendChat(projectId: string, user: Message, assistant: Message) {
    const updatedAt = Date.now()
    setProjects(current => current.map(project => {
      if (project.id !== projectId) return project

      return {
        ...project,
        name: project.messages.length === 0
          ? user.content.slice(0, 24)
          : project.name,
        messages: [...project.messages, user, assistant],
        updatedAt
      }
    }))
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
          aria-label="新建设计项目"
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
                aria-label={project.name}
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
          V0.2 · Local Workspace
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            工作台 <span>/</span> {activeProject.name}
          </div>

          {view === 'workspace' && (
            <button
              className="icon-button"
              title="切换成果面板"
              aria-label="切换成果面板"
              aria-expanded={showResults}
              onClick={() => setShowResults(value => !value)}
            >
              {showResults
                ? <PanelRightClose size={19} />
                : <PanelRightOpen size={19} />}
            </button>
          )}
        </header>

        <nav className="workspace-nav" aria-label="项目工作区">
          <button type="button" aria-pressed={view === 'workspace'} onClick={() => setView('workspace')}>创意对话</button>
          <button type="button" aria-pressed={view === 'studio'} onClick={() => setView('studio')}>Concept Studio</button>
        </nav>
        {saveFailed && <p className="workspace-save-error" role="alert">当前浏览器无法保存项目，刷新可能丢失本次更改。</p>}

        {view === 'studio' ? (
          <ConceptStudio
            key={activeProject.id}
            projectName={activeProject.name}
            state={getProjectStudio(activeProject)}
            onChange={updateStudio}
            settings={modelSettings}
            onSettingsChange={editModelSettings}
          />
        ) : (
          <CreativeChat
            key={activeProject.id}
            messages={activeProject.messages}
            input={input}
            onInputChange={setInput}
            onAppend={(user, assistant) => appendChat(activeProject.id, user, assistant)}
            settings={modelSettings}
            onSettingsChange={editModelSettings}
          />
        )}
      </main>

      {view === 'workspace' && showResults && (
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
              <div>04 · 可行性验证与原创性检索</div>
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
