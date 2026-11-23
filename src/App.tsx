import { useEffect, useMemo, useState } from 'react'
import {
  bin,
  interval,
  metrics,
  missing,
  number,
  type Field,
  type Place,
  type Zone,
  type Zones,
} from './metrics'
import AtlasMap from './AtlasMap'

function norm(s: string) {
  const map: Record<string, string> = {
    啟: '启',
    區: '区',
    臺: '台',
    灣: '湾',
    門: '门',
    東: '东',
    龍: '龙',
    觀: '观',
    馬: '马',
    車: '车',
    學: '学',
    鐵: '铁',
    場: '场',
    軍: '军',
    環: '环',
    頭: '头',
    堅: '坚',
  }
  return s
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(/[\u3400-\u9fff]/g, (c) => map[c] ?? c)
}
async function readData<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw Error(String(r.status))
  return r.json()
}
type Hit = {
  key: string
  title: string
  sub: string
  longitude: number
  latitude: number
  zone?: Zone
}
export default function App() {
  const [lang, setLang] = useState<0 | 1>(() =>
    navigator.language.toLowerCase().startsWith('zh') ? 1 : 0,
  )
  const t = (en: string, zh: string) => (lang ? zh : en)
  const [data, setData] = useState<Zones | null>(null)
  const [places, setPlaces] = useState<Place[]>([])
  const [error, setError] = useState(false)
  const [field, setField] = useState<Field>('density')
  const [selected, setSelected] = useState<Zone | null>(null)
  const [focus, setFocus] = useState<{
    lon: number
    lat: number
    serial: number
  } | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [mobileTools, setMobileTools] = useState(false)
  const [detail, setDetail] = useState(false)
  const [labels, setLabels] = useState(true)
  const metric = metrics.find((m) => m.field === field)!
  useEffect(() => {
    document.documentElement.lang = lang ? 'zh-Hans' : 'en'
  }, [lang])
  useEffect(() => {
    readData<Zones>('./data/zones-2026.geojson')
      .then(setData)
      .catch(() => setError(true))
    readData<{ places: Place[] }>('./data/places.json')
      .then((d) => setPlaces(d.places))
      .catch(() => {})
  }, [])
  const zones = useMemo(
    () => data?.features.map((f) => f.properties) ?? [],
    [data],
  )
  const stats = useMemo(() => {
    const counts = metric.colors.map(() => 0)
    let absent = 0
    for (const z of zones) {
      const v = z[field]
      if (v === null) absent++
      else counts[bin(metric, v)]++
    }
    return {
      counts,
      absent,
      total: zones.reduce((s, z) => s + z.population, 0),
    }
  }, [zones, field, metric])
  const hits = useMemo<Hit[]>(() => {
    const q = norm(query.trim())
    if (!q) return []
    const match = (values: string[]) => values.some((v) => norm(v).includes(q))
    const result = zones
      .filter((z) => match([z.zone, z.label, z.district, z.district_en]))
      .sort((a, b) => Number(b.zone === q) - Number(a.zone === q))
      .slice(0, 5)
      .map((z) => ({
        key: z.zone,
        title: z.label,
        sub: z.zone + ' · ' + (lang ? z.district : z.district_en),
        longitude: z.longitude,
        latitude: z.latitude,
        zone: z,
      }))
    const stations = places
      .filter((p) => match([p.name_en, p.name_zh]))
      .sort(
        (a, b) =>
          Number([b.name_en, b.name_zh].some((n) => norm(n) === q)) -
          Number([a.name_en, a.name_zh].some((n) => norm(n) === q)),
      )
      .slice(0, 4)
      .map((p, i) => ({
        key: 'p' + i,
        title: lang ? p.name_zh : p.name_en,
        sub: p.kind.replaceAll('_', ' '),
        longitude: p.lon,
        latitude: p.lat,
      }))
    return [...result, ...stations]
  }, [query, zones, places, lang])
  function choose(z: Zone, fly = false) {
    setSelected(z)
    setOpen(false)
    setMobileTools(false)
    if (fly)
      setFocus((v) => ({
        lon: z.longitude,
        lat: z.latitude,
        serial: (v?.serial ?? 0) + 1,
      }))
  }
  function pick(hit: Hit) {
    setQuery(hit.title)
    setOpen(false)
    setMobileTools(false)
    setSelected(hit.zone ?? null)
    setFocus((v) => ({
      lon: hit.longitude,
      lat: hit.latitude,
      serial: (v?.serial ?? 0) + 1,
    }))
  }
  const example = zones.find((z) => z.zone === '286.2')
  const docs =
    'https://github.com/Senpagavv/transitlab-hk-map/blob/main/docs/' +
    (lang ? 'guide.zh.md' : 'methods.md')
  return (
    <div className="shell">
      <header className="header">
        <div className="identity">
          <img src="./logo-tide.svg" width="30" height="30" alt="" />
          <div>
            <h1>
              TransitLab <span>HK</span>
            </h1>
            <p>{t('Hong Kong data map', '香港城市数据地图')}</p>
          </div>
        </div>
        <div
          className="search"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
          }}
        >
          <input
            type="search"
            aria-label={t('Search places or zones', '搜索地名或分区')}
            placeholder={t(
              'Search a stop, district or zone ID',
              '搜索站名、地区或分区编号',
            )}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
              if (e.key === 'Enter' && open && hits[0]) pick(hits[0])
            }}
          />
          {open && query && (
            <div className="search-results">
              {hits.length ? (
                hits.map((h) => (
                  <button key={h.key} onClick={() => pick(h)}>
                    <b>{h.title}</b>
                    <small>{h.sub}</small>
                  </button>
                ))
              ) : (
                <p>{t('No matching places', '未找到匹配地点')}</p>
              )}
            </div>
          )}
        </div>
        <a
          className="header-guide"
          href={docs}
          target="_blank"
          rel="noreferrer"
        >
          {t('How the map was made', '数据与方法')} ↗
        </a>
        <button className="lang" onClick={() => setLang(lang ? 0 : 1)}>
          {lang ? 'EN' : '中文'}
        </button>
      </header>
      <main className="workspace">
        <button
          className="mobile-toggle"
          aria-expanded={mobileTools}
          onClick={() => setMobileTools(!mobileTools)}
        >
          {mobileTools
            ? t('Close layers', '收起图层')
            : t('Map layers', '选择图层')}
        </button>
        <aside className={'controls ' + (mobileTools ? 'mobile-open' : '')}>
          <div className="section">
            <h2>{t('Map layers', '地图图层')}</h2>
            {metrics.map((m) => (
              <button
                className={'metric ' + (field === m.field ? 'active' : '')}
                aria-pressed={field === m.field}
                key={m.field}
                onClick={() => {
                  setField(m.field)
                  setMobileTools(false)
                }}
              >
                <i style={{ background: m.colors[4] }} />
                {m.name[lang]}
              </button>
            ))}
          </div>
          <div className="section legend">
            <h2>{metric.name[lang]}</h2>
            <p>{metric.unit[lang]}</p>
            {metric.colors.map((color, i) => (
              <div key={color}>
                <i style={{ background: color }} />
                <span>{interval(metric, i)}</span>
                <small>{stats.counts[i]}</small>
              </div>
            ))}
            {stats.absent > 0 && (
              <div>
                <i style={{ background: missing }} />
                <span>{t('No estimate', '无估值')}</span>
                <small>{stats.absent}</small>
              </div>
            )}
          </div>
          <div className="section switches">
            <label>
              <input
                type="checkbox"
                checked={labels}
                onChange={(e) => setLabels(e.target.checked)}
              />
              {t('Zone values on map', '在图上标注分区数值')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={detail}
                onChange={(e) => setDetail(e.target.checked)}
              />
              {t('Detailed street basemap', '详细街道底图')}
            </label>
          </div>
          <a
            className="section source-link"
            href={docs}
            target="_blank"
            rel="noreferrer"
          >
            {t('Sources and assumptions', '查看来源与估算方法')} ↗
          </a>
        </aside>
        <section
          className="map-stage"
          aria-label={t('Hong Kong choropleth map', '香港分区设色图')}
        >
          {data ? (
            <AtlasMap
              data={data}
              field={field}
              lang={lang}
              selected={selected}
              onSelect={choose}
              focus={focus}
              detailed={detail}
              labels={labels}
            />
          ) : (
            <p className="status">
              {error
                ? t(
                    'The map data could not be loaded. Reload to try again.',
                    '数据未载入，请刷新重试。',
                  )
                : t('Loading map…', '正在加载地图…')}
            </p>
          )}
        </section>
        <aside
          className={'zone-inspector ' + (selected ? 'is-selected' : '')}
          aria-live="polite"
        >
          {selected ? (
            <>
              <div className="inspector-top">
                <span className="eyebrow">
                  {t('Model zone', '模型分区')} {selected.zone}
                </span>
                <button
                  className="close"
                  onClick={() => setSelected(null)}
                  aria-label={t('Close zone details', '关闭分区详情')}
                >
                  ×
                </button>
              </div>
              <h2>{selected.label}</h2>
              <p>
                {lang ? selected.district : selected.district_en} ·{' '}
                {number(selected.area_km2, 3)} km²
              </p>
              <div className="hero-stat" data-testid="selected-population">
                <span>
                  {t('Estimated residents · 2026', '2026 年估算人口')}
                </span>
                <strong>{number(selected.population)}</strong>
              </div>
              <dl>
                {[
                  [
                    t('Allocated residents · 2021', '2021 年分配人口'),
                    number(selected.population_2021),
                  ],
                  [
                    t('Population change', '人口变化'),
                    selected.growth_pct === null
                      ? '—'
                      : number(selected.growth_pct, 1) + '%',
                  ],
                  [
                    t('Population density', '人口密度'),
                    number(selected.density) + ' /km²',
                  ],
                  [
                    t('Age 65 and over', '65 岁及以上占比'),
                    selected.elderly_pct === null
                      ? '—'
                      : number(selected.elderly_pct, 1) + '%',
                  ],
                  [t('Jobs', '岗位估算'), number(selected.jobs)],
                  [
                    t('Weekday arrivals', '工作日到达出行'),
                    number(selected.trips_in),
                  ],
                  [
                    t('School places', '中小学及幼稚园学额'),
                    number(selected.school_places),
                  ],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <>
              <span className="eyebrow">
                {t('Territory overview', '全港概览')}
              </span>
              <h2>{t('Hong Kong', '香港')}</h2>
              <div className="hero-stat">
                <span>
                  {t('Estimated land population · 2026', '2026 年陆上人口估算')}
                </span>
                <strong>{zones.length ? number(stats.total) : '—'}</strong>
              </div>
              <p data-testid="zone-count">
                <b>{zones.length || '—'}</b> {t('model zones', '个模型分区')}
              </p>
              <p>
                {t(
                  'Select a zone to compare its residents, jobs and school places. Zoom in to see more place labels.',
                  '点选分区可比较人口、岗位和学额。放大地图可查看更多地区标注。',
                )}
              </p>
              {example && (
                <button
                  className="example"
                  onClick={() => choose(example, true)}
                >
                  {t('Explore Kai Tak', '查看启德站一带')} ↗
                </button>
              )}
            </>
          )}
          <div className="downloads">
            <h3>{t('Use the data', '使用数据')}</h3>
            <a href="./data/zones.csv" download>
              {t('Download table', '下载表格')} <small>CSV ↓</small>
            </a>
            <a href="./data/zones-2026.geojson" download>
              {t('Download boundaries and values', '下载分区及数值')}{' '}
              <small>GeoJSON ↓</small>
            </a>
          </div>
          <p className="footnote">
            {t(
              'Small-area populations are model estimates. The 2021 census supplies the parent-area counts.',
              '分区人口是模型估值。2021 年普查提供上一级区域的人口总数。',
            )}
          </p>
        </aside>
      </main>
    </div>
  )
}
