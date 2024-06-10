import { startTunaProxy } from './src/index.mjs'

const start = Date.now()
const proxyHandler = await startTunaProxy({
    noWallet: true,
})

console.log(
    `Exit IP: ${proxyHandler.currentIp}\nProxy listening on port: ${proxyHandler.listenPort}`
)

proxyHandler.once('exit', () => {
    console.log('Tuna exited')
})
const end = Date.now()
console.log('Tuna started', end - start, 'ms')

proxyHandler.stopTuna()

