import { startTuna, waitConnected } from './src/tuna.mjs'

const start = Date.now()
await startTuna('entry', new URL('config/', import.meta.url), () => {}, false, true)
const end = Date.now()
console.log('Tuna started', end - start, 'ms')
const ip = await waitConnected(true)
console.log('Tuna connected to', ip)
