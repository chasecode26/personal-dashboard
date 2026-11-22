import { useState } from 'react'
import type { WeatherConfig } from '../hooks/useWeather'

interface CityResult {
  name: string
  admin1: string
  country: string
  lat: number
  lon: number
  timezone: string
}

interface Props {
  current: WeatherConfig | null
  onSave: (cfg: WeatherConfig) => void
  onClear: () => void
  onSearch: (kw: string) => Promise<CityResult[]>
  onClose: () => void
}

export default function WeatherConfigModal({ current, onSave, onClear, onSearch, onClose }: Props) {
  const [city, setCity] = useState(current?.city || '')
  const [lat, setLat] = useState(current?.lat != null ? String(current.lat) : '')
  const [lon, setLon] = useState(current?.lon != null ? String(current.lon) : '')
  const [unit, setUnit] = useState<'c' | 'f'>(current?.unit || 'c')
  const [autoLocate, setAutoLocate] = useState(current?.autoLocate ?? true)

  const [kw, setKw] = useState('')
  const [results, setResults] = useState<CityResult[]>([])
  const [searching, setSearching] = useState(false)
  const [err, setErr] = useState('')

  const doSearch = async () => {
    if (!kw.trim()) return
    setSearching(true); setErr('')
    try {
      const r = await onSearch(kw.trim())
      setResults(r || [])
      if ((r || []).length === 0) setErr('没有找到匹配的城市')
    } catch (e: any) {
      setErr(String(e?.message || e || '搜索失败'))
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const pickCity = (c: CityResult) => {
    setCity(c.name)
    setLat(String(c.lat))
    setLon(String(c.lon))
    setResults([])
    setKw('')
  }

  const cfg: WeatherConfig = {
    city: city.trim() || '深圳',
    lat: lat !== '' && !isNaN(Number(lat)) ? Number(lat) : null,
    lon: lon !== '' && !isNaN(Number(lon)) ? Number(lon) : null,
    unit,
    autoLocate,
  }

  return (
    <div className="modal-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-hd">
          <div>
            <div className="modal-eyebrow">WEATHER · 实时天气</div>
            <div className="modal-title">天气城市设置</div>
          </div>
          <span className="modal-x" onClick={onClose}>✕</span>
        </div>

        <div className="modal-body">
          <div className="token-help">
            天气来自 <b>wttr.in</b>，空气质量来自 <b>Open-Meteo</b>，均免 Key。
            搜索城市选中后会自动填入经纬度（推荐，定位最准）；也可只填城市名按名称查询。
          </div>

          <div className="field">
            <label>搜索城市 <span className="opt">（输入中文/拼音后点搜索）</span></label>
            <div className="w-search-row">
              <input value={kw} placeholder="如：深圳、Hangzhou、Tokyo"
                onChange={(e) => setKw(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }} />
              <button className="w-search-btn" onClick={doSearch} disabled={searching}>
                {searching ? '搜索中…' : '搜索'}
              </button>
            </div>
            {results.length > 0 && (
              <div className="w-city-results">
                {results.map((c, i) => (
                  <div className="w-city-item" key={i} onClick={() => pickCity(c)}>
                    <b>{c.name}</b>
                    <span>{[c.admin1, c.country].filter(Boolean).join(' · ')}</span>
                    <em>{c.lat.toFixed(2)}, {c.lon.toFixed(2)}</em>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="field-row">
            <div className="field">
              <label>城市名 <span className="opt">（显示用）</span></label>
              <input value={city} placeholder="深圳" onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="field">
              <label>温度单位</label>
              <div className="seg">
                <div className={`seg-item ${unit === 'c' ? 'on' : ''}`} onClick={() => setUnit('c')}>摄氏 °C</div>
                <div className={`seg-item ${unit === 'f' ? 'on' : ''}`} onClick={() => setUnit('f')}>华氏 °F</div>
              </div>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>经度 lon <span className="opt">（选填）</span></label>
              <input value={lon} placeholder="114.0683" onChange={(e) => setLon(e.target.value)} />
            </div>
            <div className="field">
              <label>纬度 lat <span className="opt">（选填）</span></label>
              <input value={lat} placeholder="22.5455" onChange={(e) => setLat(e.target.value)} />
            </div>
          </div>

          <label className="check-row">
            <input type="checkbox" checked={autoLocate} onChange={(e) => setAutoLocate(e.target.checked)} />
            <span>城市为空时按 IP 自动定位（经纬度优先于城市名）</span>
          </label>

          {err && <div className="test-msg bad">{err}</div>}
        </div>

        <div className="modal-ft">
          <button className="btn-ghost danger" onClick={() => { onClear(); onClose() }}>恢复默认</button>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={() => { onSave(cfg); onClose() }}>保存并加载</button>
        </div>
      </div>
    </div>
  )
}
