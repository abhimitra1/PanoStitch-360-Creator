'use client'

import { useState, useEffect } from 'react'
import { getBlobAsUrl, revokeUrl } from '@/lib/db/blobs'

export function useBlobUrl(blobId: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blobId) {
      setUrl(null)
      return
    }

    let active = true
    let objectUrl: string | null = null

    getBlobAsUrl(blobId).then((u) => {
      if (!active) {
        if (u) revokeUrl(u)
        return
      }
      objectUrl = u ?? null
      setUrl(objectUrl)
    })

    return () => {
      active = false
      if (objectUrl) revokeUrl(objectUrl)
    }
  }, [blobId])

  return url
}
