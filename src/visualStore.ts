import type { SavedVisual } from './visualTypes.ts'
export type { SavedVisual } from './visualTypes.ts'

function openVisuals(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('inno-lit-visuals', 1)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('images', { keyPath: 'id' })
      store.createIndex('project', 'projectId')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('当前浏览器无法打开图片存储。'))
  })
}

async function visualTransaction<T>(
  mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>, signal?: AbortSignal,
): Promise<T> {
  signal?.throwIfAborted()
  const database = await openVisuals()
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { database.close(); reject(signal.reason); return }
    const transaction = database.transaction('images', mode)
    const request = operation(transaction.objectStore('images'))
    const abort = () => transaction.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const finish = () => { signal?.removeEventListener('abort', abort); database.close() }
    transaction.oncomplete = () => { finish(); resolve(request.result) }
    transaction.onerror = transaction.onabort = () => { finish(); reject(new Error('图片保存失败，请检查浏览器存储空间。')) }
  })
}

export function visualKey(projectId: string, roundNumber: number, conceptId: string) {
  return JSON.stringify([projectId, roundNumber, conceptId])
}

export function getVisual(id: string): Promise<SavedVisual | undefined> {
  return visualTransaction('readonly', store => store.get(id))
}

export async function putVisual(visual: SavedVisual, signal: AbortSignal): Promise<SavedVisual> {
  await visualTransaction('readwrite', store => store.put(visual), signal)
  return visual
}

export async function deleteProjectVisuals(projectId: string): Promise<void> {
  const database = await openVisuals()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('images', 'readwrite')
    const store = transaction.objectStore('images')
    const cursor = store.index('project').openKeyCursor(IDBKeyRange.only(projectId))
    cursor.onsuccess = () => {
      if (cursor.result) {
        store.delete(cursor.result.primaryKey)
        cursor.result.continue()
      }
    }
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = transaction.onabort = () => { database.close(); reject(transaction.error) }
  })
}
