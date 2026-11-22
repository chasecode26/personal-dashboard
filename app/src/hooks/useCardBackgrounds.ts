import { useCallback, useEffect, useState } from 'react'

export interface CardBackground {
  img: string
  mask: number
  maskType: 'dark' | 'light'
}

const KEY = 'nexus-card-bgs.v1'
type Map = Record<string, CardBackground>

function load(): Map {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

export function useCardBackgrounds() {
  const [bgs, setBgs] = useState<Map>(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(bgs))
  }, [bgs])

  const get = useCallback((key: string) => bgs[key], [bgs])

  const set = useCallback((key: string, cfg: CardBackground | null) => {
    setBgs((prev) => {
      const next = { ...prev }
      if (cfg === null) delete next[key]
      else next[key] = cfg
      return next
    })
  }, [])

  return { bgs, get, set }
}
