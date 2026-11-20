export type WorkbenchBrief = { id: string; name: string; intent: string; audience: string; view?: 'creative'; creativePrompt?: string }

export function workbenchOrigin(location: Location, isEmbedded: boolean): string | null {
  if (!isEmbedded) return null
  const value = new URLSearchParams(location.search).get('iiinnowOrigin')
  if (!value) return null
  try {
    const url = new URL(value)
    return value === url.origin && url.protocol === 'http:' &&
      ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port ? url.origin : null
  } catch {
    return null
  }
}

export function readWorkbenchBrief(data: unknown): WorkbenchBrief | null {
  if (!data || typeof data !== 'object') return null
  const message = data as Record<string, unknown>
  if (message.type !== 'iiinnow:brief' || typeof message.id !== 'string' || !message.id || message.id.length > 200 ||
      typeof message.name !== 'string' || message.name.length > 160 ||
      typeof message.intent !== 'string' || message.intent.length > 12000 ||
      typeof message.audience !== 'string' || message.audience.length > 1000) return null
  if (message.view !== undefined && message.view !== 'creative') return null
  const brief = { id: message.id, name: message.name, intent: message.intent, audience: message.audience }
  if (message.view !== 'creative') return brief
  if (typeof message.creativePrompt !== 'string' || message.creativePrompt.length > 12000) return null
  return { ...brief, view: 'creative', creativePrompt: message.creativePrompt }
}

