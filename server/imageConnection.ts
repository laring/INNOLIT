export type ImageRequestStage = '查询参考图能力' | '请求模型绘图' | '下载生成结果'
export class ImageConnectionError extends Error {
  constructor(message: string) { super(message); this.name = 'ImageConnectionError' }
}
function errorCodes(error: unknown, depth = 0): string[] {
  if (!error || typeof error !== 'object' || depth > 3) return []
  const data = error as { code?: unknown; cause?: unknown; errors?: unknown[] }
  return [typeof data.code === 'string' ? data.code : '', ...errorCodes(data.cause, depth + 1), ...(Array.isArray(data.errors) ? data.errors.flatMap(item => errorCodes(item, depth + 1)) : [])].filter(Boolean)
}
export function imageConnectionMessage(error: unknown, url: string | URL, stage: ImageRequestStage, signal?: AbortSignal): string | null {
  if (error instanceof ImageConnectionError) return error.message
  const codes = errorCodes(error)
  const name = error instanceof Error ? error.name : ''
  const network = codes.some(code => /^(EAI_|ENOTFOUND|ECONN|ENET|EHOST|ETIMEDOUT|EPIPE|UND_ERR_|CERT_|ERR_TLS_|UNABLE_|DEPTH_)/.test(code))
    || ['TimeoutError', 'AbortError'].includes(name) || error instanceof TypeError && /fetch failed|terminated|network/i.test(error.message) || signal?.aborted
  if (!network) return null
  const host = new URL(url).hostname
  const prefix = `${stage}时，连接 ${host}`
  if (name === 'TimeoutError' || signal?.reason?.name === 'TimeoutError' || codes.some(code => /TIMEOUT|ETIMEDOUT/.test(code))) return `${prefix} 超时。请检查本机到该服务的网络或代理连接；本次未自动重试，请勿连续点击以免重复计费。`
  if (signal?.aborted || name === 'AbortError') return `${stage}已取消，未自动重试。`
  if (codes.some(code => /ENOTFOUND|EAI_/.test(code))) return `${prefix} 失败：域名解析异常。请检查服务地址、DNS及本机网络。`
  if (codes.some(code => /CERT_|TLS_|UNABLE_TO_VERIFY|SELF_SIGNED|DEPTH_/.test(code))) return `${prefix} 失败：TLS证书校验未通过。请检查系统时间、可信证书或网络代理，保持证书校验开启。`
  if (codes.some(code => /ECONNREFUSED/.test(code))) return `${prefix} 被拒绝。请核对服务地址及本机防火墙、代理连接。`
  if (codes.some(code => /ECONNRESET|EPIPE|UND_ERR_SOCKET/.test(code)) || error instanceof TypeError && error.message === 'terminated') return `${prefix} 中断。服务可能已收到绘图请求，请先查看服务商任务或用量记录，再决定是否重试。`
  return `${prefix} 失败，尚未收到可用响应。请检查本机网络、代理及服务可用性；这不等于模型不支持参考图。本次未自动重试。`
}
export async function fetchImageService(url: string, options: RequestInit, stage: ImageRequestStage): Promise<Response> {
  try { return await fetch(url, options) }
  catch (error) { throw new ImageConnectionError(imageConnectionMessage(error, url, stage, options.signal ?? undefined) ?? `${stage}时无法连接 ${new URL(url).hostname}。请检查本机网络和服务状态。`) }
}
export function safeImageFailure(error: unknown, url: string | URL, stage: ImageRequestStage, key: string, signal?: AbortSignal): string {
  const network = imageConnectionMessage(error, url, stage, signal)
  if (network) return network
  if (error instanceof SyntaxError) return `${stage}时服务未返回有效JSON数据，请核对接口地址或代理响应。`
  const message = error instanceof Error ? error.message : '概念图生成失败。'
  return message.replaceAll(key, '[密钥已隐藏]').replace(/data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+/giu, '[参考图已隐藏]').replace(/Bearer\s+[!-~]+/giu, 'Bearer [已隐藏]').slice(0, 1200)
}
