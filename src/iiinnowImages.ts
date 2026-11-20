
import type { SavedVisual } from './visualTypes.ts'

export const savedProductImageEvent = 'inno-lit:product-image-saved'

export function productImageMessage(visual: SavedVisual, linkedProject: string, workbenchProject: string) {
  if (visual.projectId !== linkedProject || visual.source.kind !== 'model' ||
      !['sheet', 'hero', 'presentation'].includes(visual.workflowKind || '') ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(visual.blob.type) ||
      !visual.blob.size || visual.blob.size > 8 * 1024 * 1024) return null
  return { type: 'inno-lit:product-image', projectId: workbenchProject, id: visual.id,
    role: visual.workflowKind, blob: visual.blob, model: visual.source.model, provider: visual.source.provider }
}

