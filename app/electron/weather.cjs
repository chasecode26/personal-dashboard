const fs = require('fs')
const path = require('path')
const https = require('https')
const { app } = require('electron')

// 天气配置存用户数据目录，不进项目代码
function configPath() {
  return path.join(app.getPath('userData'), 'weather-config.json')
}

const DEFAULT_CONFIG = {
  city: '',            // 城市中文名；留空 + autoLocate 时按 IP 自动定位当前城市
  lat: null,           // 可选：手动经纬度（优先于 city）
  lon: null,
  unit: 'c',           // c=摄氏 f=华氏
  autoLocate: true,    // 未手动指定城市/经纬度时，按 IP 自动定位
}

function loadConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath(), 'utf8'))
    return { ...DEFAULT_CONFIG, ...cfg }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

function saveConfig(cfg) {
  const clean = {
    city: String(cfg.city || '').trim(),
    lat: cfg.lat === '' || cfg.lat == null ? null : Number(cfg.lat),
    lon: cfg.lon === '' || cfg.lon == null ? null : Number(cfg.lon),
    unit: cfg.unit === 'f' ? 'f' : 'c',
    autoLocate: cfg.autoLocate !== false,
  }
  fs.mkdirSync(path.dirname(configPath()), { recursive: true })
  fs.writeFileSync(configPath(), JSON.stringify(clean, null, 2), { encoding: 'utf8', mode: 0o600 })
  return clean
}

function clearConfig() {
  try { fs.unlinkSync(configPath()) } catch {}
}

// 通用 https GET（返回字符串），带超时与 UA
function httpsGet(url, timeoutMs = 12000, encoding = 'utf8') {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: timeoutMs,
      headers: { 'User-Agent': 'curl/8.0', Accept: 'application/json' },
    }, (res) => {
      // 跟随重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        resolve(httpsGet(res.headers.location, timeoutMs, encoding))
        return
      }
      const chunks = []
      res.on('data', (c) => { chunks.push(c) })
      res.on('end', () => {
        if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return }
        try { resolve(new TextDecoder(encoding).decode(Buffer.concat(chunks))) }
        catch { reject(new Error('响应解码失败')) }
      })
    })
    req.on('timeout', () => { req.destroy(new Error('请求超时')) })
    req.on('error', reject)
  })
}

// WMO / wttr weatherCode -> 中文描述 + 图标符号（图标名对应前端 Icons 或 emoji 兜底）
const CODE_MAP = {
  113: { text: '晴朗', icon: 'sun' },
  116: { text: '局部多云', icon: 'cloudsun' },
  119: { text: '多云', icon: 'cloud' },
  122: { text: '阴天', icon: 'cloud' },
  143: { text: '有雾', icon: 'fog' },
  149: { text: '烟霾', icon: 'fog' },
  176: { text: '零星小雨', icon: 'rain' },
  179: { text: '零星小雪', icon: 'snow' },
  182: { text: '毛毛雨', icon: 'rain' },
  185: { text: '冻雨', icon: 'rain' },
  200: { text: '雷阵雨', icon: 'thunder' },
  227: { text: '小雪', icon: 'snow' },
  230: { text: '暴雪', icon: 'snow' },
  248: { text: '雾', icon: 'fog' },
  260: { text: '雾凇', icon: 'fog' },
  263: { text: '小雨', icon: 'rain' },
  266: { text: '中雨', icon: 'rain' },
  281: { text: '冻雨', icon: 'rain' },
  284: { text: '强冻雨', icon: 'rain' },
  293: { text: '小雨', icon: 'rain' },
  296: { text: '中雨', icon: 'rain' },
  299: { text: '大雨', icon: 'rain' },
  302: { text: '暴雨', icon: 'rain' },
  305: { text: '小阵雨', icon: 'rain' },
  308: { text: '强阵雨', icon: 'rain' },
  311: { text: '雷阵雨', icon: 'thunder' },
  314: { text: '强雷阵雨', icon: 'thunder' },
  317: { text: '雷暴伴小雪', icon: 'thunder' },
  320: { text: '雷暴伴雪', icon: 'thunder' },
  323: { text: '小阵雪', icon: 'snow' },
  326: { text: '中阵雪', icon: 'snow' },
  329: { text: '大阵雪', icon: 'snow' },
  332: { text: '暴雪', icon: 'snow' },
  335: { text: '强暴雪', icon: 'snow' },
  338: { text: '极端暴雪', icon: 'snow' },
  350: { text: '冰雹', icon: 'snow' },
  353: { text: '阵雨', icon: 'rain' },
  356: { text: '强阵雨', icon: 'rain' },
  359: { text: '极端阵雨', icon: 'rain' },
  362: { text: '阵雪', icon: 'snow' },
  365: { text: '强阵雪', icon: 'snow' },
  368: { text: '小雪', icon: 'snow' },
  371: { text: '中雪', icon: 'snow' },
  374: { text: '大雪', icon: 'snow' },
  377: { text: '小阵雪', icon: 'snow' },
  386: { text: '雷阵雪', icon: 'thunder' },
  389: { text: '强雷阵雪', icon: 'thunder' },
  392: { text: '冰雹', icon: 'snow' },
  395: { text: '强冰雹', icon: 'snow' },
}
function describe(code, isDay) {
  const c = CODE_MAP[Number(code)]
  if (!c) return { text: '未知天气', icon: 'cloud' }
  let text = c.text
  if (Number(code) === 113) text = isDay ? '晴朗' : '晴朗夜空'
  if (Number(code) === 116) text = isDay ? '局部多云' : '局部多云'
  return { ...c, text }
}

function uvLabel(uv) {
  const n = Number(uv)
  if (!Number.isFinite(n)) return '—'
  if (n <= 2) return '低'
  if (n <= 5) return '中等'
  if (n <= 7) return '高'
  if (n <= 10) return '很高'
  return '极高'
}

function aqiLabel(aqi) {
  const n = Number(aqi)
  if (!Number.isFinite(n)) return { text: '—', color: '' }
  if (n <= 50) return { text: '优', color: '#39e6a0' }
  if (n <= 100) return { text: '良', color: '#ffcf5c' }
  if (n <= 150) return { text: '轻度污染', color: '#ff9f43' }
  if (n <= 200) return { text: '中度污染', color: '#ff6b6b' }
  return { text: '重度污染', color: '#d64550' }
}

// 定位优先级：手动经纬度 > 手动城市名 > IP 自动定位（autoLocate 开启时）
async function resolveLocation(cfg) {
  if (cfg.lat != null && cfg.lon != null) {
    return { q: `${cfg.lat},${cfg.lon}`, label: `${cfg.lat.toFixed(2)}°,${cfg.lon.toFixed(2)}°`, lat: cfg.lat, lon: cfg.lon }
  }
  if (cfg.city) {
    return { q: encodeURIComponent(cfg.city), label: cfg.city, lat: null, lon: null }
  }
  if (cfg.autoLocate !== false) {
    // pconline 返回简体中文地名（GBK 编码），比 wttr.in 的英文/小区名更贴近“当前城市”
    try {
      const raw = await httpsGet('https://whois.pconline.com.cn/ipJson.jsp?json=true', 8000, 'gbk')
      const j = JSON.parse(raw)
      const city = String(j.city || '').replace(/市$/, '')
      if (city && city !== 'null') {
        const lat = j.lat ? Number(j.lat) : null
        const lon = j.lng ? Number(j.lng) : null
        return { q: encodeURIComponent(city), label: city, lat, lon }
      }
    } catch {}
    // 兜底：ipinfo.io（英文城市名 + 经纬度）
    try {
      const j = JSON.parse(await httpsGet('https://ipinfo.io/json', 8000))
      const city = j.city || j.region || ''
      const loc = String(j.loc || '').split(',')
      const lat = loc[0] ? Number(loc[0]) : null
      const lon = loc[1] ? Number(loc[1]) : null
      if (city) return { q: encodeURIComponent(city), label: city, lat, lon }
    } catch {}
  }
  return { q: encodeURIComponent('深圳'), label: '深圳', lat: null, lon: null }
}

// 拉取聚合天气：wttr.in(主) + Open-Meteo air-quality(PM2.5)
async function fetchWeather(cfgInput) {
  const cfg = cfgInput || loadConfig()
  const loc = await resolveLocation(cfg)
  const q = cfg.unit === 'f' ? `${loc.q}?format=j1` : `${loc.q}?format=j1`

  const raw = await httpsGet(`https://wttr.in/${q}`, 14000)
  let w
  try { w = JSON.parse(raw) } catch { throw new Error('天气数据解析失败') }
  const cc = w.current_condition && w.current_condition[0]
  if (!cc) throw new Error('未获取到当前天气')

  const isDay = String(cc.isDay) === '1'
  const desc = describe(cc.weatherCode, isDay)
  const tempC = Number(cc.temp_C)
  const feelsC = Number(cc.FeelsLikeC)
  const toF = (c) => Math.round(c * 9 / 5 + 32)
  const unit = cfg.unit === 'f' ? 'f' : 'c'
  const temp = unit === 'f' ? toF(tempC) : Math.round(tempC)
  const feels = unit === 'f' ? toF(feelsC) : Math.round(feelsC)

  // 6 小时温度趋势：拼接今日+明日 hourly，从最接近当前时刻起取 6 个点
  const days = w.weather || []
  const allHours = []
  days.forEach((day, di) => {
    (day.hourly || []).forEach((h) => allHours.push({ ...h, _day: di }))
  })
  const nowHour = new Date().getHours()
  let startIdx = 0
  let best = Infinity
  // hourly 的 time 是 "0","100","300"...（分钟）；今天找最接近当前的点
  allHours.forEach((h, i) => {
    if (h._day !== 0) return
    const t = Number(h.time) / 100
    const diff = t - nowHour
    if (diff >= 0 && diff < best) { best = diff; startIdx = i }
  })
  const trend = allHours.slice(startIdx, startIdx + 6).map((h) => ({
    time: String(h.time).padStart(4, '0').slice(0, 2) + ':00',
    temp: unit === 'f' ? toF(Number(h.tempC)) : Math.round(Number(h.tempC)),
  }))

  // PM2.5 / AQI：Open-Meteo air-quality（用定位经纬度，无则按城市名再查一次）
  let pm25 = null, aqi = null, aqiInfo = aqiLabel(null)
  let aqLat = loc.lat, aqLon = loc.lon
  if (aqLat == null || aqLon == null) {
    try {
      const geo = JSON.parse(await httpsGet(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc.label)}&count=1&language=zh&format=json`, 8000))
      if (geo.results && geo.results[0]) {
        aqLat = geo.results[0].latitude
        aqLon = geo.results[0].longitude
      }
    } catch {}
  }
  if (aqLat != null && aqLon != null) {
    try {
      const aq = JSON.parse(await httpsGet(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${aqLat}&longitude=${aqLon}&current=us_aqi,pm2_5&timezone=auto`, 8000))
      if (aq.current) {
        pm25 = aq.current.pm2_5 != null ? Math.round(aq.current.pm2_5) : null
        aqi = aq.current.us_aqi != null ? Math.round(aq.current.us_aqi) : null
        aqiInfo = aqiLabel(aqi)
      }
    } catch {}
  }

  // 城市显示：优先用定位标签（配置的中文城市名），否则回退 wttr 返回的地区
  const area = w.nearest_area && w.nearest_area[0]
  const areaName = area && area.areaName && area.areaName[0] && area.areaName[0].value
  const cityLabel = loc.label || areaName || '未知'

  return {
    city: cityLabel,
    temp,
    feels,
    unit,
    desc: desc.text,
    icon: desc.icon,
    isDay,
    humidity: Number(cc.humidity),
    wind: Math.round(Number(cc.windspeedKmph)),
    uv: uvLabel(cc.uvIndex),
    uvValue: Number(cc.uvIndex),
    pm25,
    aqi,
    aqiText: aqiInfo.text,
    aqiColor: aqiInfo.color,
    trend,
    syncedAt: new Date().toISOString(),
    source: 'wttr.in + Open-Meteo',
  }
}

// 城市搜索（供配置弹窗）：Open-Meteo geocoding
async function searchCity(keyword) {
  const name = String(keyword || '').trim()
  if (!name) return []
  const raw = await httpsGet(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=8&language=zh&format=json`, 10000)
  const j = JSON.parse(raw)
  return (j.results || []).map((r) => ({
    name: r.name,
    admin1: r.admin1 || '',
    country: r.country || '',
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone || '',
  }))
}

module.exports = { loadConfig, saveConfig, clearConfig, fetchWeather, searchCity }
