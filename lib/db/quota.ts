export interface QuotaInfo {
  used: number
  total: number
  percent: number
  status: 'ok' | 'warning' | 'critical'
  persisted: boolean
}

const WARN_THRESHOLD = 0.7
const BLOCK_THRESHOLD = 0.9

export async function getQuotaInfo(): Promise<QuotaInfo> {
  const [estimate, persisted] = await Promise.all([
    navigator.storage.estimate(),
    navigator.storage.persisted().catch(() => false),
  ])
  const used = estimate.usage ?? 0
  const total = estimate.quota ?? 1
  const percent = total > 0 ? used / total : 0

  let status: QuotaInfo['status'] = 'ok'
  if (percent >= BLOCK_THRESHOLD) status = 'critical'
  else if (percent >= WARN_THRESHOLD) status = 'warning'

  return { used, total, percent, status, persisted }
}

export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  return navigator.storage.persist()
}

export function formatBytes(bytes: number, precision = 1): string {
  if (bytes < 1024) return `${bytes} b`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(precision)} kb`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(precision)} mb`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(precision)} gb`
}

export function isPrivateMode(): boolean {
  try {
    localStorage.setItem('_ps_test', '1')
    localStorage.removeItem('_ps_test')
    return false
  } catch {
    return true
  }
}
