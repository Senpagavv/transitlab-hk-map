import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'

export type Field =
  | 'density'
  | 'population'
  | 'growth_pct'
  | 'elderly_pct'
  | 'jobs_density'
  | 'trips_in'
  | 'school_places'
export interface Zone {
  zone: string
  label: string
  district: string
  district_en: string
  parent: string
  longitude: number
  latitude: number
  population_2021: number
  population: number
  density: number | null
  growth_pct: number | null
  elderly_pct: number | null
  jobs: number
  jobs_density: number | null
  trips_in: number
  school_places: number
  households: number
  workers: number
  students: number
  area_km2: number
}
export type Zones = FeatureCollection<Polygon | MultiPolygon, Zone>
export interface Place {
  name_en: string
  name_zh: string
  lon: number
  lat: number
  kind: string
}
type Pair = [string, string]
export interface Metric {
  field: Field
  name: Pair
  unit: Pair
  cuts: number[]
  colors: string[]
  decimals?: number
}
const green = ['#edf5e7', '#c4dfad', '#8bc58d', '#47a37c', '#177760', '#074d45']
const blue = ['#edf3fb', '#cbdff2', '#9ac2e3', '#6599ca', '#3a6dab', '#244880']
const rust = ['#fff2d9', '#f3dbab', '#e5bd7a', '#cf9852', '#ad7038', '#804927']
export const metrics: Metric[] = [
  {
    field: 'density',
    name: ['Population density', '人口密度'],
    unit: ['people/km²', '人/平方公里'],
    cuts: [5000, 20000, 40000, 70000, 100000],
    colors: green,
  },
  {
    field: 'population',
    name: ['Population', '人口总数'],
    unit: ['people', '人'],
    cuts: [5000, 15000, 30000, 50000, 80000],
    colors: green,
  },
  {
    field: 'growth_pct',
    name: ['Population change', '人口变化'],
    unit: ['% since 2021', '% · 相比 2021'],
    cuts: [-8, -4, -1, 1, 10, 40],
    colors: [
      '#9d4a28',
      '#cf875d',
      '#ecd1aa',
      '#e5e8dc',
      '#a4d5ae',
      '#49a780',
      '#116e5a',
    ],
    decimals: 1,
  },
  {
    field: 'elderly_pct',
    name: ['Age 65 and over', '65 岁及以上占比'],
    unit: ['% of residents', '% · 居民占比'],
    cuts: [15, 20, 24, 28, 32],
    colors: rust,
    decimals: 1,
  },
  {
    field: 'jobs_density',
    name: ['Job density', '岗位密度'],
    unit: ['jobs/km²', '个/平方公里'],
    cuts: [1000, 5000, 15000, 40000, 100000],
    colors: blue,
  },
  {
    field: 'trips_in',
    name: ['Weekday arrivals', '工作日到达出行'],
    unit: ['trips/day', '人次/日'],
    cuts: [5000, 10000, 20000, 50000, 100000],
    colors: blue,
  },
  {
    field: 'school_places',
    name: ['School places', '中小学及幼稚园学额'],
    unit: ['places', '个'],
    cuts: [1, 500, 1000, 2000, 3500],
    colors: rust,
  },
]
export const missing = '#b3b5b8'
export const number = (v: number | null, decimals = 0) =>
  v === null
    ? '—'
    : v.toLocaleString('en-US', { maximumFractionDigits: decimals })
export function bin(metric: Metric, value: number) {
  const n = metric.cuts.findIndex((c) => value < c)
  return n === -1 ? metric.cuts.length : n
}
export function interval(m: Metric, i: number) {
  const a = m.cuts[i - 1],
    b = m.cuts[i]
  return a === undefined
    ? '< ' + number(b)
    : b === undefined
      ? '≥ ' + number(a)
      : number(a) + ' – < ' + number(b)
}
