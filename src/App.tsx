import {isWorkflowImageTask} from './aiModelRouter'
import {designProgress} from './designProgress'
import { useModelConfig } from './useModelConfig'

import { useEffect, useState, useRef } from 'react'
import type { CSSProperties } from 'react'
import {PanelResizeHandle} from './PanelResizeHandle'
import {defaultPanels,fitPanelWidths,readPanelWidths,panelLayoutKey} from './panelLayout'
import {
  Lightbulb, Plus, PanelRightClose,
  PanelRightOpen, FolderOpen, Trash2, Settings2
} from 'lucide-react'
import { ConceptStudio } from './ConceptStudio'
import { CreativeChat } from './CreativeChat'
import { TaskModelCenter } from './TaskModelCenter'
import type { ChatIdea, ConceptStudioState } from './concepts'
import type { ModelSettings } from './modelGeneration'
import type { ImageSettings } from './imageGeneration'
import { createEmptyRouting } from './aiModelRouter'
import { deleteProjectVisuals, projectVisuals } from './visualStore'
import type { SavedVisual } from './visualTypes'
import { productImageMessage, savedProductImageEvent } from './iiinnowImages'
import { createProject, getProjectStudio, loadProjects, STORAGE_KEY } from './projects'
import type { Message } from './projects'
import { readWorkbenchBrief, workbenchOrigin } from './iiinnowBridge'
import './App.css'

import {
  resolveWorkflowTextModel,
} from './aiModelRouter'
import type {
  WorkflowTask,
} from './aiModelRouter'





function App() {
  const [projects, setProjects] = useState(loadProjects)
  const [activeId, setActiveId] = useState(
    () => projects[0].id
  )
  const [input, setInput] = useState('')
  const [showResults, setShowResults] = useState(true)
  const shell=useRef<HTMLDivElement>(null)
  const [panelWidths,setPanelWidths]=useState(()=>readPanelWidths(localStorage))
  const [shellWidth,setShellWidth]=useState(()=>window.innerWidth)
  const fittedPanels=fitPanelWidths(panelWidths,shellWidth,showResults)
  useEffect(()=>{const element=shell.current;if(!element)return;const observer=new ResizeObserver(entries=>setShellWidth(entries[0].contentRect.width));observer.observe(element);return()=>observer.disconnect()},[])
  useEffect(()=>{try{localStorage.setItem(panelLayoutKey,JSON.stringify(panelWidths))}catch{/* Layout still works without persistence. */}},[panelWidths])

  const [view, setView] = useState<'workspace' | 'studio'>('workspace')
  const [saveFailed, setSaveFailed] = useState(false)
  const { modelSettings, setModelSettings, imageSettings, setImageSettings, workflowRouting, setWorkflowRouting, ready: modelConfigReady, remember, setRemember, notice: modelConfigNotice, saveNow: saveModelConfigNow, forget: forgetSavedModelConfig } = useModelConfig()
  const routing = createEmptyRouting()

  function editWorkflowSettings(
    task: WorkflowTask,
    change: Partial<ModelSettings> | Partial<ImageSettings>,
  ) {
    setWorkflowRouting(current => {
      const fallback =
        isWorkflowImageTask(task) ? (current.visual ?? imageSettings) : modelSettings

      const previous = current[task] ?? fallback
      const next = { ...previous, ...change }

      if (next.baseUrl.trim() !== previous.baseUrl.trim()) {
        next.apiKey = ''
      }

      return {
        ...current,
        [task]: next,
      }
    })
  }

function resetWorkflowSettings(task: WorkflowTask) {
  setWorkflowRouting(current => ({
    ...current,
    [task]: null,
  }))
}

  const [modelCenterOpen, setModelCenterOpen] = useState(false)
  const [transfer, setTransfer] = useState<{ projectId: string; idea: ChatIdea } | null>(null)

  const activeProject =
    projects.find(project => project.id === activeId)
    ?? projects[0]

  const parentOrigin = workbenchOrigin(window.location, window.parent !== window)
  const [linkedId, setLinkedId] = useState<string>()
  const [transferNotice, setTransferNotice] = useState('')
  useEffect(() => {
    if (!parentOrigin) return
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== parentOrigin) return
      const brief = readWorkbenchBrief(event.data)
      if (brief) {
        const id = 'iiinnow-' + brief.id
        const project = { ...createProject(), id, name: brief.name, iiinnowProjectId: brief.id }
        const studio = getProjectStudio(project)
        setProjects(current => current.some(item => item.id === id) ? current : [{
          ...project, conceptStudio: { ...studio, draft: { ...studio.draft, problem: brief.intent, audience: brief.audience } },
        }, ...current])
        setActiveId(id)
        setLinkedId(brief.id)
        if (brief.view === 'creative') {
          setInput(current => current || brief.creativePrompt || '')
          setView('workspace')
        } else {
          setView('studio')
        }
      } else if (event.data?.type === 'iiinnow:concept-result') {
        setTransferNotice(event.data.saved === true ? '已保存到 IIINNOW「工业造型与外观 → 交付物 → 文档」。' : 'IIINNOW 无法保存，请检查项目基线及浏览器存储。')
      }
    }
    window.addEventListener('message', receive)
    window.parent.postMessage({ type: 'inno-lit:ready' }, parentOrigin)
    return () => window.removeEventListener('message', receive)
  }, [parentOrigin])

  useEffect(() => {
    if (!parentOrigin || !linkedId) return
    const projectId = 'iiinnow-' + linkedId
    let listening = true
    const publish = (visual: SavedVisual) => {
      if (!listening) return
      const message = productImageMessage(visual, projectId, linkedId)
      if (message) window.parent.postMessage(message, parentOrigin)
    }
    const saved = (event: Event) => publish((event as CustomEvent<SavedVisual>).detail)
    window.addEventListener(savedProductImageEvent, saved)
    void projectVisuals(projectId).then(images => images.forEach(publish)).catch(() => {
      if (listening) setTransferNotice('暂无法同步已有产品图片。')
    })
    return () => { listening = false; window.removeEventListener(savedProductImageEvent, saved) }
  }, [parentOrigin, linkedId])

  const studioForTransfer = getProjectStudio(activeProject)
  const transferRound = studioForTransfer.rounds[studioForTransfer.activeRound]
  const exportConcept = transferRound?.concepts.find(concept => concept.id === transferRound.selectedId)

  function sendToWorkbench() {
    if (!parentOrigin || !linkedId || activeProject.iiinnowProjectId !== linkedId || !exportConcept) return
    setTransferNotice('正在发送到 IIINNOW…')
    const { title, sentences } = exportConcept.development?.frozen?.design ?? exportConcept
    window.parent.postMessage({
      type: 'inno-lit:concept', projectId: linkedId, title,
      fields: sentences,
    }, parentOrigin)
  }

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

  function editImageSettings(change: Partial<ImageSettings>) {
    setImageSettings(current => {
      const next = { ...current, ...change }
      if (next.baseUrl.trim() !== current.baseUrl.trim()) next.apiKey = ''
      return next
    })
  }

  function deleteProject(id: string) {
    // Removing a project must still work when browser image storage is unavailable.
    void deleteProjectVisuals(id).catch(() => {})
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

  const progress=designProgress(activeProject)
  const nextStep=progress.findIndex(step=>!step.done)
  const latestIdea = [...activeProject.messages]
    .reverse()
    .find(message => message.role === 'user')

  return (
    <div className="app-shell" ref={shell} style={{'--left-panel-width':`${fittedPanels.left}px`,'--right-panel-width':`${fittedPanels.right}px`} as CSSProperties}>
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

        <div className="global-model-center-toggle">
          <button
            type="button"
            aria-expanded={modelCenterOpen}
            aria-controls="global-ai-model-center"
            onClick={() => setModelCenterOpen(open => !open)}
          >
            <Settings2 size={16} />
            AI 模型中心
          </button>
        </div>

        <div className="sidebar-footer">
          V0.2 · Local Workspace
        </div>
      </aside>

      <PanelResizeHandle label="调整项目栏宽度" value={fittedPanels.left} min={180} max={Math.max(180,Math.min(480,shellWidth-320-(showResults?fittedPanels.right+16:8)))} direction={1} onChange={left=>setPanelWidths({...fittedPanels,left})} onReset={()=>setPanelWidths({...fittedPanels,left:defaultPanels.left})}/>
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            工作台 <span>/</span> {activeProject.name}
          </div>

          {(
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
          {linkedId && activeProject.iiinnowProjectId === linkedId && (
            <button type="button" disabled={!exportConcept}
              title={exportConcept ? '保存当前选中的方案' : '请先在 Concept Studio 选定一个方案'}
              onClick={sendToWorkbench}>保存选中方案到工业设计交付物</button>
          )}
          {transferNotice && <span role="status">{transferNotice}</span>}
        </nav>


        {modelCenterOpen && (
          <div
            className="global-model-center-overlay"
            onMouseDown={event => {
              if (event.target === event.currentTarget) {
                setModelCenterOpen(false)
              }
            }}
          >
            <section
              id="global-ai-model-center"
              className="global-model-center-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="global-model-center-title"
            >
              <header className="global-model-center-dialog-header">
                <div className="global-model-center-title-group">
                  <h2 id="global-model-center-title">
                    AI 模型中心
                  </h2>
                  <p>
                    按设计环节配置文字与图片模型
                  </p>
                </div>

                <button
                  type="button"
                  className="global-model-center-close"
                  onClick={() => setModelCenterOpen(false)}
                  aria-label="关闭 AI 模型中心"
                >
                  关闭
                </button>
              </header>

              <div className="global-model-center-dialog-body">
                {!modelConfigReady ? <p role="status">正在恢复模型配置…</p> : <TaskModelCenter
                  remember={remember}
                  onRememberChange={setRemember}
                  onForget={forgetSavedModelConfig}
                  saveNotice={modelConfigNotice}
                  onSave={saveModelConfigNow}
                  routing={routing}
                  defaultText={modelSettings}
                  defaultImage={imageSettings}
                  onDefaultTextChange={editModelSettings}
                  onDefaultImageChange={editImageSettings}
                  workflowRouting={workflowRouting}
                  onWorkflowChange={editWorkflowSettings}
                  onWorkflowReset={resetWorkflowSettings}
                />}
              </div>

              <footer className="global-model-center-dialog-footer">
                <span>
                  {remember ? '配置会加密保存在此浏览器' : '仅在本次页面会话使用'}
                </span>
                <button
                  type="button"
                  onClick={() => { void saveModelConfigNow().then(saved => { if (saved) setModelCenterOpen(false) }) }}
                  disabled={!modelConfigReady}
                >
                  保存并完成
                </button>
              </footer>
            </section>
          </div>
        )}
        {saveFailed && <p className="workspace-save-error" role="alert">当前浏览器无法保存项目，刷新可能丢失本次更改。</p>}

        {view === 'studio' ? (
          <ConceptStudio
            key={activeProject.id}
            projectId={activeProject.id}
            projectName={activeProject.name}
            state={getProjectStudio(activeProject)}
            onChange={updateStudio}
            settings={modelSettings}
            routing={routing}
            workflowRouting={workflowRouting}
            onOpenModelCenter={() => setModelCenterOpen(true)}


            imageSettings={imageSettings}

            idea={transfer?.projectId === activeProject.id ? transfer.idea : undefined}
            onDismissIdea={() => setTransfer(null)}
          />
        ) : (
          <CreativeChat
            key={activeProject.id}
            messages={activeProject.messages}
            input={input}
            onInputChange={setInput}
            onAppend={(user, assistant) => appendChat(activeProject.id, user, assistant)}
            onTransfer={idea => {
              setTransfer({ projectId: activeProject.id, idea })
              setView('studio')
            }}
          settings={resolveWorkflowTextModel( 
            'home',
            workflowRouting,
            modelSettings,
          )}
            onOpenModelCenter={() => setModelCenterOpen(true)}
          />
        )}
      </main>

      {showResults && (<>
        <PanelResizeHandle label="调整设计成果栏宽度" value={fittedPanels.right} min={200} max={Math.max(200,Math.min(600,shellWidth-fittedPanels.left-336))} direction={-1} onChange={right=>setPanelWidths({...fittedPanels,right})} onReset={()=>setPanelWidths({...fittedPanels,right:defaultPanels.right})}/>
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
            <p className="process-summary" role="status">已完成 {progress.filter(step=>step.done).length} / {progress.length} 项</p>
            <ol className="process-list" aria-label="设计流程完成情况">
              {progress.map((step,index)=><li key={step.title} className={step.done?'process-step is-complete':'process-step'} aria-current={index===nextStep?'step':undefined} title={step.detail}>
                <span>{step.title}</span><span className="process-state">{step.done?'✓ 已完成':'未完成'}</span>
              </li>)}
            </ol>
          </div>

          <div className="results-footer">
            项目内容保存在当前浏览器
          </div>
        </aside></>
      )}
    </div>
  )
}

export default App
