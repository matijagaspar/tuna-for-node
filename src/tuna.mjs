import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  getTunaExecutableFilename,
  validateConfigDir,
  extractPortsFromConfig,
  waitForTunaPort,
} from './utils.mjs'
import readline from 'node:readline'
import EventEmitter from 'node:events'
import { COMMANDS, AWAIT_TUNA_READY_TIMEOUT } from './constants.mjs'
// export * from './constants.mjs'
// export * from './tunaProxy.mjs'

class TunaEmmiter extends EventEmitter {}
const tunaEmmiter = new TunaEmmiter()
// TODO: allow multiple processes, IE: not make it behave as singleton!
let tunaProcess = null
let currentIp = null
let tunaConnected = false
let globalConfigDir
let globalIpChangeCB = () => {}

/**
 * Starts the tuna client.
 *
 * @param {'entry' | 'exit'} command
 * @param {string | URL} configDir
 * @param {Function?} ipChangeCB
 * @param {boolean?} validatePorts if it waits for the proxy port to be open
 * @param {boolean?} restart if it should restart tuna if already running
 * @returns {Promise<void>}
 */
export const startTuna = async (
  command,
  configDir = globalConfigDir,
  ipChangeCB = globalIpChangeCB,
  validatePorts = true,
  restart = false,
) => {
  if (command !== COMMANDS.ENTRY && command !== COMMANDS.EXIT) {
    throw new Error('Invalid command')
  }

  globalConfigDir = configDir
  globalIpChangeCB = ipChangeCB

  if (restart && tunaProcess) {
    tunaProcess.kill()
  } else if (tunaProcess && tunaProcess.exitCode === null) {
    throw new Error('Tuna is already running')
  }

  await validateConfigDir(configDir)

  const tunaExecutable = fileURLToPath(
    new URL(`../bin/${getTunaExecutableFilename()}`, import.meta.url),
  )
  tunaProcess = spawn(tunaExecutable, [command], { cwd: configDir })
  //   tunaProcess.stderr.pipe(process.stderr)

  const rl = readline.createInterface({
    input: tunaProcess.stderr,
    crlfDelay: Infinity,
  })

  rl.on('line', (data) => {
    const matchConnect = data.match(/Connected to TCP at (\d+\.\d+\.\d+\.\d+)/)
    if (matchConnect) {
      tunaConnected = true
      tunaEmmiter.emit('connected', matchConnect[1])
      currentIp = matchConnect[1]
      ipChangeCB(matchConnect[1])
    }

    if (data.match(/Close connection/)) {
      tunaConnected = false
      tunaEmmiter.emit('disconnected')
    }
  })

  tunaProcess.on('exit', () => {
    tunaEmmiter.emit('disconnected')
    tunaConnected = false
    tunaProcess = null
    tunaEmmiter.emit('exit')
  })

  let startCheckPromises = [
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tuna did not connect'))
      }, AWAIT_TUNA_READY_TIMEOUT)
      tunaEmmiter.once('connected', (ip) => {
        clearTimeout(timeout)
        resolve(ip)
      })
    }),
  ]

  if (validatePorts) {
    const expectedPorts = await extractPortsFromConfig(command, configDir)
    startCheckPromises = [
      ...startCheckPromises,
      ...expectedPorts.map(async (port) =>
        waitForTunaPort({ host: 'localhost', port }, AWAIT_TUNA_READY_TIMEOUT),
      ),
    ]
  }

  await Promise.all(startCheckPromises)
}

/**
 * Awaits tuna client being connected.
 * @param {boolean?} validatePorts if it waits for the proxy port to be open
 * @param {boolean?} start if tuna should be started if not running (throws error if false and tuna is already running)
 * @returns {Promise<string>} the current ip
 */
export const waitConnected = async (validatePorts, start) => {
  if (!tunaProcess) {
    if (start) {
      // TODO: fix so callback is not lost etc....
      await startTuna('entry')
    } else {
      throw new Error('Tuna is not running')
    }
  }
  let connectionChecks = []
  if (!tunaConnected) {
    connectionChecks = [
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Tuna did not connect'))
        }, AWAIT_TUNA_READY_TIMEOUT)
        tunaEmmiter.once('connected', (ip) => {
          currentIp = ip
          clearTimeout(timeout)
          resolve()
        })
      }),
    ]
  }
  if (validatePorts) {
    const expectedPorts = await extractPortsFromConfig(COMMANDS.ENTRY, globalConfigDir)
    connectionChecks = [
      ...connectionChecks,
      ...expectedPorts.map(async (port) =>
        waitForTunaPort({ host: 'localhost', port }, AWAIT_TUNA_READY_TIMEOUT),
      ),
    ]
  }

  if (connectionChecks.length > 0) {
    await Promise.all(connectionChecks)
  }
  return currentIp
}

/**
 * Stops the tuna client.
 * @returns {Promise<void>}
 */
export const stopTuna = async () => {
  if (tunaProcess) {
    tunaProcess.kill('SIGKILL')
    await new Promise((resolve) => {
      // await clean exit
      tunaEmmiter.once('exit', () => {
        // let one loop pass
        setImmediate(() => {
          resolve()
        })
      })
    })
  }
}
