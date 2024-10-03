import { startTunaProxy } from './src/index.mjs'

const start = Date.now()

const proxyHandlers = []
for (let i = 0; i < 10; i++) {
  const handler = await startTunaProxy({
    noWallet: true,
    waitStart: false,
  })
  handler.once('listening', () => {
    console.log(`${i} Proxy listening on port: ${handler.proxyUrl}`)
    handler.stopTuna()
  })
  handler.once('exit', () => {
    console.log(`${i} Tuna exited`)
  })
  proxyHandlers.push(handler)
}

const end = Date.now()
console.log('Tuna started', end - start, 'ms')
