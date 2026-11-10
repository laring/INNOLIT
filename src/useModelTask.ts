import { useEffect, useRef, useState } from 'react'

export function useModelTask() {
  const request = useRef<AbortController | null>(null)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => () => request.current?.abort(), [])

  async function run<T>(task: (signal: AbortSignal) => Promise<T>, apply: (result: T) => void, success: string) {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setNotice('')
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(150000)])
      const result = await task(signal)
      if (!controller.signal.aborted) {
        apply(result)
        setNotice(success)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setNotice(error instanceof DOMException && error.name === 'TimeoutError'
          ? '等待模型服务超时。请重试。'
          : error instanceof Error && !(error instanceof TypeError)
            ? error.message
            : '无法连接模型服务。请检查 API 设置。')
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        if (!controller.signal.aborted) setPending(false)
      }
    }
  }

  function cancel() {
    request.current?.abort()
    request.current = null
    setPending(false)
    setNotice('已取消模型请求。')
  }

  return { pending, notice, run, cancel }
}
