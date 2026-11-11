import { lookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import type { IncomingMessage } from 'node:http'
import { BlockList } from 'node:net'

const privateIPv4 = new BlockList()
for (const [address, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['224.0.0.0', 3],
] as const) privateIPv4.addSubnet(address, bits)
const publicIPv6 = new BlockList()
publicIPv6.addSubnet('2000::', 3, 'ipv6')
const specialIPv6 = new BlockList()
specialIPv6.addSubnet('2001::', 23, 'ipv6')
specialIPv6.addSubnet('2002::', 16, 'ipv6')

export async function readBytes(stream: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of stream.iterator({ destroyOnReturn: false })) {
    size += chunk.length
    if (size > limit) {
      stream.destroy()
      throw new Error('内容超出大小限制。')
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export async function readJson(stream: IncomingMessage, limit: number): Promise<unknown> {
  return JSON.parse((await readBytes(stream, limit)).toString('utf8'))
}

export async function requestPublicBytes(
  url: URL, signal: AbortSignal, limit: number, body?: string, key?: string,
): Promise<{ status: number; bytes: Buffer }> {
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('服务链接需使用 HTTPS。')
  const addresses = await lookup(url.hostname, { all: true })
  const target = addresses.find(({ address, family }) => family === 4
    ? !privateIPv4.check(address)
    : publicIPv6.check(address, 'ipv6') && !specialIPv6.check(address, 'ipv6'))
  if (!target) throw new Error('服务地址未指向公开网络。')
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      hostname: target.address, servername: url.hostname,
      method: body === undefined ? 'GET' : 'POST',
      agent: false, signal,
      headers: {
        Host: url.host,
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(body === undefined ? {} : {
          'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
        }),
      },
    }, response => {
      const status = response.statusCode ?? 502
      if (status < 200 || status >= 300) {
        response.destroy()
        resolve({ status, bytes: Buffer.alloc(0) })
        return
      }
      readBytes(response, limit).then(bytes => resolve({ status, bytes }), reject)
    })
    request.on('error', reject)
    request.end(body)
  })
}

export async function requestProviderJson(url: URL, key: string, payload: unknown, signal: AbortSignal, limit = 256 * 1024) {
  const result = await requestPublicBytes(url, signal, limit, JSON.stringify(payload), key)
  return {
    status: result.status,
    ...(result.status >= 200 && result.status < 300 ? { data: JSON.parse(result.bytes.toString('utf8')) as unknown } : {}),
  }
}
