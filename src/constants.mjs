// use 'latest' for latest release
export const TUNA_RELEASE_ID = 151880742

export const BIN_DIR = 'bin/'
export const AWAIT_TUNA_READY_TIMEOUT = 40_000

export const SETTINGS_FILES = {
  ENTRY: 'config.entry.json',
  EXIT: 'config.exit.json',
  SERVICES: 'services.json',
  WALLET: 'wallet.json',
  WALLET_PASSWORD: 'wallet.pswd',
}

export const OPTIONAL_SETTINGS_FILES = [SETTINGS_FILES.WALLET, SETTINGS_FILES.WALLET_PASSWORD]

export const COMMANDS = {
  ENTRY: 'entry',
  EXIT: 'exit',
}

export const CONFIG_ERROR_CODES = {
  CONFIG_FOLDER_NOT_FOLDER: 1,
  CONFIG_FOLDER_MISSING: 2,
  CONFIG_CANNOT_READ: 3,
  CONFIG_CANNOT_READ_FILE: 4,
  CONFIG_MISSING_FILE: 5,
}

export const DEFAULT_CONFIG_FOLDERS = {
  http: '../default_configs/http',
  socks5: '../default_configs/socks',
}
