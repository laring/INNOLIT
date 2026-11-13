import type { VisualSource } from './imageGeneration.ts'
import type { EntryRole, VisualApproval } from './entryVisuals.ts'
import type { VisualPageRole } from './visualStudioTypes.ts'

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
  pageRole?: VisualPageRole
  conceptKey?: string
  workflowKind?: string
  filename?: string
}
