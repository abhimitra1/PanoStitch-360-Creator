'use client'

import { useState, useEffect, useCallback } from 'react'
import { getQuotaInfo, requestPersistence, type QuotaInfo } from '@/lib/db/quota'

export function useQuota(refreshInterval = 30_000) {
  const [quota, setQuota] = useState<QuotaInfo | null>(null)

  const refresh = useCallback(async () => {
    try {
      const info = await getQuotaInfo()
      setQuota(info)
    } catch {
      // navigator.storage not available (private mode, older Safari)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, refreshInterval)
    return () => clearInterval(id)
  }, [refresh, refreshInterval])

  const persist = useCallback(async () => {
    const granted = await requestPersistence()
    if (granted) refresh()
    return granted
  }, [refresh])

  return { quota, refresh, persist }
}
