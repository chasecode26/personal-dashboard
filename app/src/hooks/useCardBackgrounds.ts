import { useCallback, useEffect, useState } from 'react'
import * as store from '../data/store'

export interface CardBackground {
  img: string
  mask: number
  maskType: 'dark' | 'light'
}

const KEY = 'nexus-card-bgs.v1'
type Map = Record<string, CardBackground>

function load(): Map {
  // JSON.parse('null') 不抛异常，返回 null 会让 getBg() 在首屏就崩掉，必须走统一校验
  const res = store.readJson(
    KEY,
    (v): v is Map => Boolean(v) && typeof v === 'object' && !Array.isArray(v),
    '卡片背景',
  )
  return res.value || {}
}

export function useCardBackgrounds() {
  const [bgs, setBgs] = useState<Map>(load)

  useEffect(() => {
    store.setItem(KEY, JSON.stringify(bgs))
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
