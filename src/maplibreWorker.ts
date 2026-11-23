import { setWorkerCount, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

setWorkerUrl(workerUrl)
setWorkerCount(
  Math.min(
    4,
    Math.max(1, Math.floor((navigator.hardwareConcurrency || 4) / 2)),
  ),
)
