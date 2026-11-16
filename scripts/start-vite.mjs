import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'

export function viteLaunch(root, args, environment, supportsProxy) {
  const env = { ...environment }
  const proxy = Boolean(env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy)
  const enabled = proxy && env.NODE_USE_ENV_PROXY !== '0'
  if (enabled && !supportsProxy) throw new Error('此 Node.js 版本不支持本机代理，请使用 Node.js 24 或 22.21 以上版本。')
  if (enabled) {
    // Keep the local workspace connection direct; only upstream provider traffic uses the configured proxy.
    env.NO_PROXY = [env.NO_PROXY || env.no_proxy, 'localhost', '127.0.0.1', '::1'].filter(Boolean).join(',')
  }
  return { args: [...(enabled ? ['--use-env-proxy'] : []), join(root, 'node_modules', 'vite', 'bin', 'vite.js'), ...args], env }
}
function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const config = join(root, '.env.local')
  if (existsSync(config)) {
    if (!process.loadEnvFile) throw new Error('当前 Node.js 无法读取本机配置文件，请升级 Node.js。')
    try { process.loadEnvFile(config) } catch { throw new Error('无法读取 .env.local，请检查配置文件格式。') }
  }
  const launch = viteLaunch(root, process.argv.slice(2), process.env, process.allowedNodeEnvironmentFlags.has('--use-env-proxy'))
  if (launch.args.includes('--use-env-proxy')) process.stdout.write('INNO LIT：上游服务使用已配置的本机网络代理，本地工作台保持直连。\n')
  const child = spawn(process.execPath, launch.args, { cwd: root, env: launch.env, stdio: 'inherit', windowsHide: true })
  child.on('error', () => { process.stderr.write('无法启动本地工作台，请检查 Node.js 和依赖安装。\n'); process.exitCode = 1 })
  child.on('exit', code => { process.exitCode = code ?? 1 })
  process.on('SIGINT', () => child.kill('SIGINT'))
  process.on('SIGTERM', () => child.kill('SIGTERM'))
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { main() } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1 }
}
