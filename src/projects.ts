import type { ConceptBatch, ConceptStudioState } from './concepts.ts'

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export type Project = {
  id: string
  name: string
  messages: Message[]
  updatedAt: number
  conceptStudio?: ConceptStudioState | {
    draft: ConceptStudioState['draft']
    batch: ConceptBatch | null
  }
}

// Keep the original key so existing V0.1 projects open in V0.2.
export const STORAGE_KEY = 'inno-lit-v0.1-projects'

export function createProject(): Project {
  return {
    id: crypto.randomUUID(),
    name: '未命名设计项目',
    messages: [],
    updatedAt: Date.now(),
  }
}

export function loadProjects(storage?: Pick<Storage, 'getItem'>): Project[] {
  try {
    const saved = (storage ?? localStorage).getItem(STORAGE_KEY)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as Project[]
    }
  } catch {
    // A new project is available when saved data cannot be read.
  }
  return [createProject()]
}

export function getProjectStudio(project: Project): ConceptStudioState {
  const saved = project.conceptStudio
  if (saved && 'rounds' in saved) return saved

  // A project saved before round history was added has one batch at most.
  const rounds = saved?.batch ? [saved.batch] : []
  return {
    draft: saved?.draft ?? {
      problem: project.messages.findLast(message => message.role === 'user')?.content ?? '',
      audience: '',
      scenario: '',
      count: 3,
    },
    rounds,
    activeRound: rounds.length - 1,
  }
}
