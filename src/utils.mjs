import os from 'node:os'
import fsAsync from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'

import { SETTINGS_FILES, CONFIG_ERROR_CODES, BIN_DIR, COMMANDS } from './constants.mjs'

const attemptConnectWithTimeout = async (host, port, timeout) => {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (socket) {
        socket.destroy()
      }
      const error = new Error(`Timeout`)
      error.code = 'ECONNTIMEOUT'
      return reject(error)
    }, timeout)

    const socket = net.createConnection(
      { host, port /* family: ipVersion, autoSelectFamily: true */ },
      (err) => {
        clearTimeout(timer)
        if (!err) {
          socket.destroy()
          return resolve(true)
        } else {
          return reject(err)
        }
      },
    )
    socket.on('error', (error) => {
      socket.destroy()
      clearTimeout(timer)
      reject(error)
    })
  })
}

export async function waitForTunaPort({ host, port }, timeout = 30_000) {
  return new Promise((resolve, reject) => {
    ;(async () => {
      let socket
      let connected = false
      const timer = setTimeout(() => {
        if (socket) {
          socket.destroy()
        }
        const error = new Error(`Timeout waiting for tuna port ${host}:${port}`)
        error.code = 'ECONNTIMEOUT'
        connected = true
        return reject(error)
      }, timeout)
      do {
        try {
          await attemptConnectWithTimeout(host, port, 5000)
          connected = true
        } catch (e) {}
        await new Promise((resolve) => setTimeout(resolve, 500))
      } while (!connected)
      clearTimeout(timer)
      return resolve(true)
    })()
  })
}

export async function extractPortsFromConfig(command, configDir) {
  let configFile
  if (command === COMMANDS.ENTRY) {
    configFile = 'config.entry.json'
  } else {
    configFile = 'config.exit.json'
  }
  const config = JSON.parse(
    await fsAsync.readFile(path.join(configDir, configFile), { encoding: 'utf-8' }),
  )
  const services = JSON.parse(
    await fsAsync.readFile(path.join(configDir, 'services.json'), { encoding: 'utf-8' }),
  )
  if (Object.keys(config.services).length > 1) {
    console.log('tuna-for-node only supports one configured service for now')
    throw new Error('Only one service supported')
  }
  return Object.keys(config.services)
    .map((key) => {
      const service = services.find(({ name }) => name === key)
      if (service) {
        return service.tcp
      }
      return null
    })
    .filter((port) => port)
    .flat()
}

const TUNA_FILE_NAMES = {
  DARWIN_ARM: 'darwin-arm64',
  DARWIN: 'darwin-amd64',
  LINUX_ARM64: 'linux-arm64',
  LINUX_ARMV5: 'linux-armv5',
  LINUX_ARMV6: 'linux-armv6',
  LINUX_ARMV7: 'linux-armv7',
  LINUX: 'linux-amd64',
  WINDOWS: 'windows-amd64',
}

export const getTunaPlatformFilename = () => {
  const arch = os.arch()
  const platform = os.platform()
  if (platform === 'darwin') {
    return arch === 'arm64' ? TUNA_FILE_NAMES.DARWIN_ARM : TUNA_FILE_NAMES.DARWIN
  } else if (platform === 'linux') {
    if (arch === 'arm64') {
      return TUNA_FILE_NAMES.LINUX_ARM64
    } else if (arch === 'arm') {
      return TUNA_FILE_NAMES.LINUX_ARMV7
    } else if (arch === 'armv5') {
      return TUNA_FILE_NAMES.LINUX_ARMV5
    } else if (arch === 'armv6') {
      return TUNA_FILE_NAMES.LINUX_ARMV6
    } else {
      return TUNA_FILE_NAMES.LINUX
    }
  } else if (platform === 'win32') {
    return TUNA_FILE_NAMES.WINDOWS
  }
  throw new Error(`Unsupported platform ${platform} and arch ${arch}`)
}

export const getTunaExecutableFilename = () => {
  const tunaFileName = `tuna-${getTunaPlatformFilename()}`
  if (os.platform() === 'win32') {
    return `${tunaFileName}.exe`
  }
  return tunaFileName
}

export class ConfigError extends Error {
  constructor(code, pathValue) {
    switch (code) {
      case CONFIG_ERROR_CODES.CONFIG_FOLDER_MISSING:
        super(`Config directory does not exist ${pathValue}`) // (1)
        break
      case CONFIG_ERROR_CODES.CONFIG_FOLDER_NOT_FOLDER:
        super(`Config directory is not a directory ${pathValue}`)
        break
      case CONFIG_ERROR_CODES.CONFIG_CANNOT_READ:
        super(`Cannot read file ${pathValue}`)
        break
      case CONFIG_ERROR_CODES.CONFIG_MISSING_FILE:
        super(`Missing file ${pathValue}`)
        break
      default:
        super(`Unknown error ${pathValue}`)
    }
    this.name = 'ConfigError' // (2)
    this.code = code
    this.path = pathValue
  }
}

export const validateConfigDir = async (configDir, type, createDefaults = false) => {
  let configDirS

  let typeKey = null
  try {
    const commandEntry = Object.entries(COMMANDS).find(([_, value]) => value === type)

    if (!commandEntry) {
      throw new Error(`Invalid type ${type}`)
    }
    typeKey = commandEntry[0]
    configDirS = await fsAsync.stat(configDir)
  } catch (e) {
    throw new ConfigError(CONFIG_ERROR_CODES.CONFIG_FOLDER_MISSING, configDir)
  }
  if (!configDirS.isDirectory()) {
    throw new ConfigError(CONFIG_ERROR_CODES.CONFIG_FOLDER_NOT_FOLDER, configDir)
  }
  try {
    await fsAsync.access(configDir, fsAsync.constants.R_OK)
  } catch (e) {
    throw new ConfigError(CONFIG_ERROR_CODES.CONFIG_CANNOT_READ, configDir)
  }

  const requiredFiles = [SETTINGS_FILES[typeKey], SETTINGS_FILES.SERVICES]

  for (const file of requiredFiles) {
    try {
      // )
      await fsAsync.access(path.join(configDir, file), fsAsync.constants.R_OK)
    } catch (e) {
      if (e.code === 'ENOENT' && createDefaults) {
        fsAsync.copyFile(new URL(`../${BIN_DIR}${file}`, import.meta.url), new URL(file, configDir))
      } else {
        throw new ConfigError(CONFIG_ERROR_CODES.CONFIG_CANNOT_READ, path.join(configDir, file))
      }
    }
  }
}

/**
 *
 * @param {string} directory
 * @returns {Promise<[walletPath: string, walletPasswordPath: string]>} walletFiles
 */
export const checkWalletFilesDirectory = async (directory) => {
  let configDirS
  try {
    configDirS = await fsAsync.stat(directory)
  } catch (e) {
    throw new ConfigError(CONFIG_ERROR_CODES.CONFIG_FOLDER_MISSING, directory)
  }
  if (!configDirS.isDirectory()) {
    throw new ConfigError(CONFIG_ERROR_CODES.CONFIG_FOLDER_NOT_FOLDER, directory)
  }
  try {
    await fsAsync.access(directory, fsAsync.constants.R_OK)
  } catch (e) {
    throw new ConfigError(CONFIG_ERROR_CODES.CONFIG_CANNOT_READ, directory)
  }

  const requiredFiles = [SETTINGS_FILES.WALLET, SETTINGS_FILES.WALLET_PASSWORD]

  const walletFiles = []
  for (const file of requiredFiles) {
    try {
      const filePath = path.join(directory, file) // fileURLToPath(new URL(file, directory))
      await fsAsync.access(filePath, fsAsync.constants.R_OK)
      walletFiles.push(filePath)
    } catch (e) {
      throw new ConfigError(
        CONFIG_ERROR_CODES.CONFIG_CANNOT_READ,
        path.join(directory, file),
      )
    }
  }

  return walletFiles
}

export const checkFile = async (filePath) => {
  try {
    await fsAsync.access(filePath, fsAsync.constants.R_OK)
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new ConfigError(CONFIG_ERROR_CODES.CONFIG_MISSING_FILE, filePath)
    } else {
      throw e
    }
  }
}
