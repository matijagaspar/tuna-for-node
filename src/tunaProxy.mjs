import { spawn } from 'node:child_process'
import EventEmitter from 'node:events'
import { fileURLToPath } from 'node:url'
import {
  getTunaExecutableFilename,
  validateConfigDir,
  checkWalletFilesDirectory,
  ConfigError,
  checkFile,
} from './utils.mjs'
import readline from 'node:readline'
import {
  COMMANDS,
  AWAIT_TUNA_READY_TIMEOUT,
  DEFAULT_CONFIG_FOLDERS,
  CONFIG_ERROR_CODES,
} from './constants.mjs'

class TunaProxyEmitter extends EventEmitter {
  constructor() {
    super()
    this.tunaProcess = null
    this.tunaConnected = false
    this.currentIp = null
  }

  async getProxyInfo(){
    if(!this.proxyUrl){
      await new Promise((resolve) => {  
        this.once('listening', (port) => {
          resolve(port)
        })
      })
    }
    return this.proxyUrl
  }

  stopTuna() {
    return new Promise((resolve) => {
      if (this.tunaProcess) {
        this.tunaProcess.kill('SIGKILL')
        this.tunaProcess = null
        this.emit('exit')
      }
      resolve()
    })
  }

  // getProxyAddress
}

export * from './constants.mjs'

/**
 * @typedef {Object} GlobalProxyOptions
 * @param {boolean?} options.validatePorts - if ports should be validated
 * @param {'http'|'socks5'} options.proxyType - the type of proxy
 * @param {string?} options.walletFile - the wallet file (if not provided, it will look in the configDir)
 * @param {string?} options.walletPasswordFile - the wallet password file (if not provided, it will look in the configDir)
 * @param {string?} options.configDir - the config directory (by default is checked for wallet files, if services.json is provided and the entry/exit config files, those will be used)
 * @param {boolean?} options.noWallet - if no wallet should be used
 */
const globalProxyOptions = {
  proxyType: 'http',
  validatePorts: true,
  walletFile: null,
  walletPasswordFile: null,
  configDir: process.cwd(),
  noWallet: false,
  waitStart: true,
}

/**
 *
 * Set default glboal options for the tuna proxy
 *
 * @param {globalProxyOptions} options
 * @returns {void}
 */
export const setGlobalProxyOptions = (options) => {
  Object.assign(globalProxyOptions, options)
}

/**
 *
 * @param {globalProxyOptions} options
 */
export const startTunaProxy = async (options = globalProxyOptions) => {
  const tunaProxyEmitter = new TunaProxyEmitter()

  const localOptions = {}
  Object.assign(localOptions, globalProxyOptions, options || {})
  const { validatePorts, walletFile, walletPasswordFile, configDir, proxyType, noWallet, waitStart } =
    localOptions
  const command = COMMANDS.ENTRY

  if (DEFAULT_CONFIG_FOLDERS[proxyType] === undefined) {
    throw new Error('Invalid proxyType')
  }
  let tunaCWD = fileURLToPath(new URL(DEFAULT_CONFIG_FOLDERS[proxyType], import.meta.url))

  try {
    await validateConfigDir(configDir, COMMANDS.ENTRY)
    // override tuna CWD if the configuration dir set, has the required files
    tunaCWD = configDir
  } catch (e) {
    if (e.code !== CONFIG_ERROR_CODES.CONFIG_CANNOT_READ) {
      throw e
    }
  }

  let walletCmdOpts = []
  // check if wallet files are provided, they are required
  if (!noWallet) {
    let walletFiles = []
    if (walletFile) {
      if (!walletPasswordFile) {
        throw new ConfigError(CONFIG_ERROR_CODES.CONFIG_MISSING_FILE, 'walletPasswordFile')
      } else {
        walletFiles = [await checkFile(walletFile), await checkFile(walletPasswordFile)]
      }
    } else {
      walletFiles = await checkWalletFilesDirectory(configDir)
    }
    walletCmdOpts = ['/w', walletFiles[0], '/p', walletFiles[1]]
  }

  const tunaExecutable = fileURLToPath(
    new URL(`../bin/${getTunaExecutableFilename()}`, import.meta.url),
  )

  tunaProxyEmitter.tunaProcess = spawn(tunaExecutable, [command, ...walletCmdOpts], {
    cwd: tunaCWD,
  })
  // tunaProxyEmitter.tunaProcess.stderr.pipe(process.stderr)

  const rl = readline.createInterface({
    input: tunaProxyEmitter.tunaProcess.stderr,
    crlfDelay: Infinity,
  })

  rl.on('line', (data) => {
    const matchConnect = data.match(/Connected to TCP at (\d+\.\d+\.\d+\.\d+)/)
    if (matchConnect) {
      tunaProxyEmitter.tunaConnected = true
      tunaProxyEmitter.emit('connected', matchConnect[1])
      tunaProxyEmitter.currentIp = matchConnect[1]
    }

    if (data.match(/Close connection/)) {
      tunaProxyEmitter.tunaConnected = false
      tunaProxyEmitter.emit('disconnected')
    }
    const listenMatch = data.match(/Serving .+? on ([^\s]+) tcp port \[(\d+)\]/)
    if(listenMatch){

      tunaProxyEmitter.listenAddress = listenMatch[1]
      tunaProxyEmitter.listenPort = parseInt(listenMatch[2])
      tunaProxyEmitter.proxyUrl = `${proxyType}://${listenMatch[1]}:${tunaProxyEmitter.listenPort}`
      tunaProxyEmitter.emit('listening', tunaProxyEmitter.listenPort)
    }
  })

  // tunaProxyEmitter.tunaProcess.on('error', (e) => {
  //   console.log(e)
  // })
  tunaProxyEmitter.tunaProcess.on('exit', () => {
    tunaProxyEmitter.emit('disconnected')
    tunaProxyEmitter.tunaProcess = null
    tunaProxyEmitter.emit('exit')
    tunaProxyEmitter.removeAllListeners()
  })

  if(waitStart){

    let startCheckPromises = [
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Tuna did not connect'))
        }, AWAIT_TUNA_READY_TIMEOUT)
        tunaProxyEmitter.once('connected', (ip) => {
          clearTimeout(timeout)
          resolve(ip)
        })
      }),
    ]

    if (validatePorts) {
      startCheckPromises = [
        ...startCheckPromises,
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Tuna did not listen'))
          }, AWAIT_TUNA_READY_TIMEOUT)
          tunaProxyEmitter.once('listening', (port) => {
            clearTimeout(timeout)
            resolve(port)
          })
        } ),
      ]
    }

    await Promise.all(startCheckPromises)
  }

  return tunaProxyEmitter
}
