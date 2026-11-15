import { useEffect, useState } from 'react'
import type { Concept } from './concepts'
import { developmentOf } from './conceptDevelopment'
import { canvasBlob, downloadBlob } from './conceptBoard'
import { renderEntryBoard } from './entryBoards'
import type { BoardRole } from './entryBoards'
import { entryRoles, entryVisualKey, visualProblems } from './entryVisuals'
import type { EntryRole } from './entryVisuals'
import { getVisual, visualKey } from './visualStore'
import type { SavedVisual } from './visualTypes'

type HistoryItem = { label: string; record: SavedVisual; exportBoard?: () => Promise<void> }
export function VisualHistory({ projectId, roundNumber, concept }: { projectId: string; roundNumber: number; concept: Concept }) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [message, setMessage] = useState('正在读取历史图片…')
  const [exporting, setExporting] = useState(false)
  useEffect(() => {
    let active = true
    async function load() {
      const found: HistoryItem[] = []
      const legacy = await getVisual(visualKey(projectId, roundNumber, concept.id))
      if (legacy) found.push({ label: '早期概念图', record: legacy })
      const data = developmentOf(concept)
      const priorVersions = [undefined, ...(data.frozen ? [data.frozen.id] : []), ...data.history.map(item => item.id)]
      for (const version of priorVersions) {
        for (const mode of ['concept', 'board']) {
          for (const size of ['landscape', 'portrait', 'square']) {
            const id = JSON.stringify(['simple-visual-v022', projectId, roundNumber, concept.id, version ?? 'unfrozen', mode, size])
            const record = await getVisual(id)
            if (record) found.push({ label: `原简洁版 · ${mode === 'concept' ? '概念图' : '展板'} · ${size}`, record })
          }
        }
      }
      for (const frozen of [...(data.frozen ? [data.frozen] : []), ...data.history]) {
        const roles = Object.keys(entryRoles) as EntryRole[]
        const records = Object.fromEntries(await Promise.all(roles.map(async role => [role, await getVisual(entryVisualKey(projectId, roundNumber, concept.id, frozen.id, role))]))) as Partial<Record<EntryRole, SavedVisual>>
        for (const role of roles) {
          const record = records[role]
          if (!record) continue
          found.push({ label: `V${frozen.revision} · ${entryRoles[role]}`, record,
            ...(role !== 'master' && !visualProblems(frozen, role, record, records.master, records).length ? { exportBoard: async () => {
              const bitmap = await createImageBitmap(record.blob)
              try {
                const canvas = document.createElement('canvas')
                renderEntryBoard(canvas, frozen, role as BoardRole, bitmap, record.source)
                downloadBlob(await canvasBlob(canvas), `INNO-LIT-V${frozen.revision}-${role}.png`)
              } finally { bitmap.close() }
            } } : {}),
          })
        }
      }
      if (active) { setItems(found); setMessage(found.length ? '' : '没有更早的图片记录。') }
    }
    void load().catch(() => { if (active) setMessage('历史图片暂时无法读取。') })
    return () => { active = false }
  }, [projectId, roundNumber, concept])
  return <><p className="studio-hint" role="status">{message}</p><ul className="studio-evidence-list">{items.map(item => <li key={item.record.id}>
    <span>{item.label}</span><div className="studio-actions">
      <button type="button" className="studio-button" onClick={() => downloadBlob(item.record.blob, `INNO-LIT-${item.label.replaceAll(' · ', '-')}.${item.record.blob.type === 'image/jpeg' ? 'jpg' : item.record.blob.type === 'image/webp' ? 'webp' : 'png'}`)}>下载图片</button>
      {item.exportBoard && <button type="button" className="studio-button" disabled={exporting} onClick={() => {
        setExporting(true)
        void item.exportBoard!().catch(() => setMessage('历史展板导出失败。')).finally(() => setExporting(false))
      }}>导出旧版展板</button>}
    </div>
  </li>)}</ul></>
}
