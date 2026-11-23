import type { RequestTransformFunction, StyleSpecification } from 'maplibre-gl'

export const HK_BASEMAP_STYLE_URL = './basemap/hk-vector-style.json'
export const LANDSD_LOGO_URL =
  'https://api.hkmapservice.gov.hk/mapapi/landsdlogo.jpg'

const LABEL_FONTS_PATH = '/vt/label/hk/tc/WGS84/resources/fonts/'
const BASE_FONTS_PATH = '/vt/basemap/WGS84/resources/fonts/'

export const transformBasemapRequest: RequestTransformFunction = (
  url,
  resourceType,
) => {
  let target = url
  if (resourceType === 'Glyphs' && /Arial(%20| )Regular/.test(target)) {
    target = target.replace(LABEL_FONTS_PATH, BASE_FONTS_PATH)
  }
  return { url: target }
}

/** Academic light basemap style: quiet neutral paper tone so analytical layers stay readable. */
export async function loadAcademicBasemapStyle(
  signal: AbortSignal,
): Promise<StyleSpecification> {
  const response = await fetch(HK_BASEMAP_STYLE_URL, { signal })
  if (!response.ok) throw new Error('Basemap style unavailable')
  const style = (await response.json()) as StyleSpecification
  if (typeof style.sprite === 'string') {
    const sprites = await fetch(style.sprite + '.json', { signal })
    if (!sprites.ok) throw new Error('Lands Department service unavailable')
  }
  const p = {
    sea: '#E8EFF4',
    land: '#F8FAFC',
    road: '#E2E8F0',
    minor: '#EDF2F7',
    edge: '#CBD5E1',
    ink: '#334155',
    grey: '#64748B',
  }

  const layers = style.layers
    .filter(
      (layer) =>
        !(layer.type === 'raster' && layer.paint?.['raster-opacity'] === 0),
    )
    .map((layer) => {
      const copy = { ...layer, paint: { ...layer.paint } } as typeof layer
      if (copy.type === 'background')
        copy.paint = { ...copy.paint, 'background-color': p.sea }
      if (!('source' in copy)) return copy
      const id = copy.id
      const water =
        /Hydro|HYDR|Reservoir|Water|SPL|SWP|FOU/i.test(id) &&
        !/LAF|BRE|DAM/i.test(id)
      const road = /Road|TSPT|TransLine|PedNBike|PedLine/i.test(id)
      const major = /Expressway|MainRoad|Major|Trunk/i.test(id)
      if (copy.type === 'fill') {
        const paint = { ...copy.paint }
        delete paint['fill-pattern']
        paint['fill-color'] = water
          ? p.sea
          : road
            ? major
              ? p.road
              : p.minor
            : p.land
        if ('fill-outline-color' in paint) paint['fill-outline-color'] = p.edge
        copy.paint = paint
      }
      if (copy.type === 'line') {
        copy.paint = {
          ...copy.paint,
          'line-color': water ? p.edge : road ? p.road : p.edge,
        }
        if (/BDRY|Boundary/i.test(id))
          copy.paint['line-color'] = 'rgba(100,116,139,0.28)'
      }
      if (copy.type === 'symbol') {
        copy.paint = {
          ...copy.paint,
          'text-color': /Road|Street|SiteName|PlaceName/i.test(id)
            ? p.ink
            : p.grey,
          'text-halo-color': p.land,
        }
      }
      return copy
    })

  const used = new Set(
    layers.flatMap((layer) => ('source' in layer ? [layer.source] : [])),
  )
  const sources = Object.fromEntries(
    Object.entries(style.sources).filter(([id]) => used.has(id)),
  )
  return { ...style, layers, sources }
}

export const HK_INITIAL_VIEW = {
  longitude: 114.14,
  latitude: 22.355,
  zoom: 10.45,
}
export const HK_MIN_ZOOM = 9.2
export const HK_MAX_BOUNDS: [number, number, number, number] = [
  113.75, 22.12, 114.55, 22.62,
]
