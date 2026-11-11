import type { VisualSource } from './imageGeneration.ts'
import type { EntryRole, VisualApproval } from './entryVisuals.ts'

export type SavedVisual = {
  id: string
  projectId: string
  blob: Blob
  source: VisualSource
  prompt: string
  frozenId?: string
  role?: EntryRole
  digest?: string
  masterDigest?: string
  approval?: VisualApproval
}
