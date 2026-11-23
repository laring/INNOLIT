export function parseModelObject(content: string, label = '模型'): Record<string, unknown> {
  const raw = content.trim()
  if (!raw) throw new Error(`${label}返回了空内容。`)
  const candidates = [raw, ...Array.from(raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/giu), match => match[1].trim())]
  if (!raw.startsWith('[')) {
    const start = raw.indexOf('{')
    let depth = 0, quoted = false, escaped = false
    for (let index = start; start >= 0 && index < raw.length; index++) {
      const char = raw[index]
      if (quoted) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') quoted = false
      } else if (char === '"') quoted = true
      else if (char === '{') depth++
      else if (char === '}' && --depth === 0) { candidates.push(raw.slice(start, index + 1)); break }
    }
  }
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch { /* Try the next complete JSON representation. */ }
  }
  throw new Error(`${label}未返回有效的 JSON 对象。内容可能被截断，请缩短输入或增加模型输出长度后重试。`)
}
