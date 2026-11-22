import type { Concept } from './concepts.ts'
import type { ProductIdentity } from './conceptDevelopment.ts'

export type VisualPageRole = 'overview' | 'interaction' | 'story'
export type PageLayout = 'landscape' | 'portrait' | 'square' | 'custom'
export type VisualPageSettings = { layout: PageLayout; width: number; height: number; description: string }
export type VisualStudioSettings = {
  count: 1 | 2 | 3
  mode: 'local' | 'api'
  active: VisualPageRole
  pages: Record<VisualPageRole, VisualPageSettings>
}
export type VisualSubject = Pick<Concept, 'title' | 'format' | 'sentences'> & {
  insight: string; mechanism: string; useFlow: string; version: string; identity?: ProductIdentity
}
