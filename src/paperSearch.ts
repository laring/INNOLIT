export type Paper = { title: string; url: string }

export async function searchPapers(keywords: string, signal: AbortSignal): Promise<Paper[]> {
  const endpoint = new URL('https://api.crossref.org/works')
  endpoint.search = new URLSearchParams({
    'query.bibliographic': keywords,
    rows: '8',
    select: 'DOI,title',
  }).toString()
  const response = await fetch(endpoint, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
  if (!response.ok) throw new Error('论文检索服务暂不可用。')

  const body = await response.json() as { message?: { items?: unknown } } | null
  if (!Array.isArray(body?.message?.items)) throw new Error('无法读取论文检索结果。')

  const papers = new Map<string, Paper>()
  for (const item of body.message.items) {
    const doi: unknown = item?.DOI
    const titles: unknown = item?.title
    const title: unknown = Array.isArray(titles) ? titles[0] : undefined
    if (typeof doi !== 'string' || !/^10\.\d{4,}\/\S+$/u.test(doi)) continue
    if (typeof title !== 'string' || !title.trim()) continue

    const url = `https://doi.org/${doi.split('/').map(encodeURIComponent).join('/')}`
    if (!papers.has(url)) papers.set(url, { title: title.trim(), url })
  }
  return [...papers.values()]
}
