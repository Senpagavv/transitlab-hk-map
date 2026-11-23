import { useEffect, useMemo, useRef, useState } from 'react'
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import {
  Map as GLMap,
  Source,
  Layer,
  Marker,
  NavigationControl,
  ScaleControl,
  type MapRef,
  type MapLayerMouseEvent,
} from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import './maplibreWorker'
import {
  LANDSD_LOGO_URL,
  loadAcademicBasemapStyle,
  transformBasemapRequest,
} from './basemap'
import {
  metrics,
  missing,
  number,
  type Field,
  type Zone,
  type Zones,
} from './metrics'

const simple: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'water-paper',
      type: 'background',
      paint: { 'background-color': '#e5eef0' },
    },
  ],
}
const bounds: [[number, number], [number, number]] = [
  [113.83, 22.155],
  [114.45, 22.57],
]
const wholeExtent: [number, number, number, number] = [
  113.6, 21.98, 114.71, 22.78,
]
interface Props {
  data: Zones
  field: Field
  lang: 0 | 1
  selected: Zone | null
  onSelect: (z: Zone) => void
  focus: { lon: number; lat: number; serial: number } | null
  detailed: boolean
  labels: boolean
}
export default function AtlasMap({
  data,
  field,
  lang,
  selected,
  onSelect,
  focus,
  detailed,
  labels,
}: Props) {
  const map = useRef<MapRef>(null)
  const [view, setView] = useState(0)
  const [style, setStyle] = useState<StyleSpecification>(simple)
  const [basemapError, setBasemapError] = useState(false)
  const [hover, setHover] = useState<{ z: Zone; x: number; y: number } | null>(
    null,
  )
  const [ready, setReady] = useState(false)
  const metric = metrics.find((m) => m.field === field)!
  const suffix =
    field === 'density' || field === 'jobs_density'
      ? ' /km²'
      : field === 'growth_pct' || field === 'elderly_pct'
        ? '%'
        : ''
  const byId = useMemo(
    () => new Map(data.features.map((f) => [f.properties.zone, f.properties])),
    [data],
  )
  const priority = useMemo(
    () => [...byId.values()].sort((a, b) => b.population - a.population),
    [byId],
  )
  const startingView = useMemo(
    () => ({ bounds, fitBoundsOptions: { padding: 22, maxZoom: 11 } }),
    [],
  )
  const fill = useMemo<ExpressionSpecification>(() => {
    const [first, ...rest] = metric.cuts
    const stops: Extract<ExpressionSpecification, ['step', ...unknown[]]> = [
      'step',
      ['get', field],
      metric.colors[0],
      first,
      metric.colors[1],
    ]
    rest.forEach((v, i) => stops.push(v, metric.colors[i + 2]))
    return ['case', ['==', ['get', field], null], missing, stops]
  }, [metric, field])
  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    setBasemapError(false)
    setStyle(simple)
    if (!detailed) return
    const deadline = window.setTimeout(() => controller.abort(), 5000)
    loadAcademicBasemapStyle(controller.signal)
      .then((s) => {
        if (alive) setStyle(s)
      })
      .catch(() => {
        if (alive) setBasemapError(true)
      })
      .finally(() => window.clearTimeout(deadline))
    return () => {
      alive = false
      window.clearTimeout(deadline)
      controller.abort()
    }
  }, [detailed])
  useEffect(() => {
    if (!focus || !ready) return
    map.current?.flyTo({
      center: [focus.lon, focus.lat],
      zoom: 13.15,
      duration: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 0
        : 680,
    })
  }, [focus, ready])
  const labelZones = useMemo(() => {
    if (!map.current || !labels || !view) return []
    const m = map.current,
      canvas = m.getCanvas()
    const occupied: { x: number; y: number }[] = []
    return priority.filter((z) => {
      if (z[field] === null || occupied.length >= 24) return false
      const p = m.project([z.longitude, z.latitude])
      if (
        p.x < 42 ||
        p.y < 26 ||
        p.x > canvas.clientWidth - 42 ||
        p.y > canvas.clientHeight - 38
      )
        return false
      if (
        occupied.some(
          (v) => Math.abs(v.x - p.x) < 115 && Math.abs(v.y - p.y) < 58,
        )
      )
        return false
      occupied.push(p)
      return true
    })
  }, [view, priority, labels, field])
  function at(event: MapLayerMouseEvent) {
    return byId.get(
      String(
        event.features?.find((f) => f.layer.id === 'zone-fill')?.properties
          ?.zone ?? '',
      ),
    )
  }
  function track(event: MapLayerMouseEvent) {
    const z = at(event)
    if (z) {
      const box = event.target.getCanvas()
      setHover({
        z,
        x: Math.max(5, Math.min(event.point.x + 14, box.clientWidth - 205)),
        y: Math.max(5, Math.min(event.point.y + 10, box.clientHeight - 86)),
      })
    } else if (hover) setHover(null)
  }
  return (
    <>
      <GLMap
        ref={map}
        initialViewState={startingView}
        minZoom={8}
        maxZoom={16}
        maxBounds={wholeExtent}
        mapStyle={style}
        dragRotate={false}
        touchPitch={false}
        pitchWithRotate={false}
        transformRequest={transformBasemapRequest}
        interactiveLayerIds={['zone-fill']}
        cursor={hover ? 'pointer' : 'grab'}
        attributionControl={false}
        onError={() => {
          if (detailed && style !== simple) {
            setStyle(simple)
            setBasemapError(true)
          }
        }}
        onLoad={() => {
          map.current?.getMap().touchZoomRotate?.disableRotation()
          setReady(true)
          setView((v) => v + 1)
        }}
        onIdle={() => {
          if (!ready) {
            setReady(true)
            setView((v) => v + 1)
          }
        }}
        onMoveEnd={() => setView((v) => v + 1)}
        onResize={() => setView((v) => v + 1)}
        onDragStart={() => setHover(null)}
        onMouseMove={track}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const z = at(e)
          if (z) {
            onSelect(z)
            setHover(null)
          }
        }}
      >
        <Source
          id="zones"
          type="geojson"
          data={data}
          promoteId="zone"
          tolerance={0.22}
        >
          <Layer
            id="zone-fill"
            type="fill"
            paint={{
              'fill-color': fill,
              'fill-opacity': detailed ? 0.78 : 0.96,
            }}
          />
          <Layer
            id="zone-border"
            type="line"
            paint={{
              'line-color': '#42645e',
              'line-opacity': 0.68,
              'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8,
                0.5,
                12,
                1.05,
                15,
                1.4,
              ],
            }}
          />
          <Layer
            id="selection-ring"
            type="line"
            filter={['==', ['get', 'zone'], selected?.zone ?? '']}
            paint={{ 'line-color': '#fff', 'line-width': 5 }}
          />
          <Layer
            id="selection-edge"
            type="line"
            filter={['==', ['get', 'zone'], selected?.zone ?? '']}
            paint={{ 'line-color': '#182f42', 'line-width': 2.5 }}
          />
        </Source>
        {detailed && style === simple && (
          <Source
            id="local-streets"
            type="geojson"
            data={new URL('./basemap/streets.geojson', document.baseURI).href}
          >
            <Layer
              id="local-roads"
              type="line"
              minzoom={12}
              filter={['==', ['get', 'class'], 'local']}
              paint={{
                'line-color': '#53696e',
                'line-opacity': 0.48,
                'line-width': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12,
                  0.55,
                  16,
                  1.5,
                ],
              }}
            />
            <Layer
              id="main-roads"
              type="line"
              filter={['==', ['get', 'class'], 'main']}
              paint={{
                'line-color': '#385864',
                'line-opacity': 0.73,
                'line-width': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  8,
                  0.35,
                  12,
                  0.95,
                  16,
                  2.3,
                ],
              }}
            />
          </Source>
        )}
        {labelZones.map((z) => (
          <Marker
            key={z.zone}
            longitude={z.longitude}
            latitude={z.latitude}
            anchor="center"
          >
            <button
              className={
                'map-label ' + (selected?.zone === z.zone ? 'picked' : '')
              }
              onClick={(e) => {
                e.stopPropagation()
                onSelect(z)
              }}
              title={z.label + ' · ' + number(z[field], metric.decimals)}
            >
              <span>{z.label.replace(/一带$/, '')}</span>
              <b>
                {number(z[field], metric.decimals)}
                {suffix}
              </b>
            </button>
          </Marker>
        ))}
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" />
      </GLMap>
      <div
        className="map-heading"
        data-view={view}
        data-labels={labelZones.length}
        data-ready={ready}
      >
        <span>{metric.name[lang]}</span>
        <small>{metric.unit[lang]} · 2026</small>
      </div>
      <button
        className="extent"
        title={lang ? '查看全港' : 'Show all zones'}
        aria-label={lang ? '查看全港' : 'Show all zones'}
        onClick={() =>
          map.current?.fitBounds(bounds, { padding: 22, duration: 350 })
        }
      >
        ⌖
      </button>
      {hover && (
        <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
          <b>{hover.z.label}</b>
          <span>
            {number(hover.z[field], metric.decimals)} {metric.unit[lang]}
          </span>
        </div>
      )}
      {basemapError && (
        <p className="map-note">
          {lang
            ? '街道底图使用随图提供的 OpenStreetMap 路网。'
            : 'Showing the bundled OpenStreetMap road network.'}
        </p>
      )}
      <div className="credit">
        {detailed && style !== simple && (
          <a href="https://www.landsd.gov.hk" target="_blank" rel="noreferrer">
            <img src={LANDSD_LOGO_URL} alt="Lands Department" />
          </a>
        )}
        <a
          href="https://data.gov.hk/en/terms-and-conditions"
          target="_blank"
          rel="noreferrer"
        >
          © HKSAR Government
        </a>{' '}
        ·{' '}
        <a
          href="https://github.com/wheelstransit/hongkong-community-gtfs"
          target="_blank"
          rel="noreferrer"
        >
          HK Community GTFS
        </a>
        {detailed &&
          (style !== simple ? (
            ' · Map from Lands Department'
          ) : (
            <>
              {' '}
              ·{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                © OpenStreetMap contributors
              </a>
            </>
          ))}
      </div>
    </>
  )
}
