import os from 'node:os'
import { Readable } from 'node:stream'
import fs, { renameSync, rmSync } from 'node:fs'
import extractZip from 'extract-zip'
import { fileURLToPath } from 'node:url'
import { mkdirp } from 'mkdirp'
import { getTunaPlatformFilename } from './utils.mjs'
import { TUNA_RELEASE_ID, SETTINGS_FILES, OPTIONAL_SETTINGS_FILES } from './constants.mjs'

const getTunaDownloadLink = async (releaseFilename, releaseId = TUNA_RELEASE_ID) => {
  // 151880742
  const result = await fetch(`https://api.github.com/repos/nknorg/tuna/releases/${releaseId}`)
  const releaseData = await result.json()

  const platformAsset = releaseData.assets.find(({ name }) => name === releaseFilename)
  if (!platformAsset) {
    throw new Error(`No asset found for ${releaseFilename}`)
  }
  const downloadLink = platformAsset.browser_download_url
  return downloadLink
}

const downloadTuna = async () => {
  const tunaFileName = getTunaPlatformFilename()
  const tunaZipFileName = `${tunaFileName}.zip`

  // const downloadDestination = tunaZipFileName
  const tunaBinDir = new URL('../bin/', import.meta.url)
  const cacheDir = new URL('../cache/', import.meta.url)
  await mkdirp(fileURLToPath(cacheDir))
  await mkdirp(fileURLToPath(tunaBinDir))

  const tunaExtractDestination = fileURLToPath(cacheDir)
  const tunaZipDestination = fileURLToPath(new URL(tunaZipFileName, cacheDir))

  const downloadLink = await getTunaDownloadLink(tunaZipFileName)

  const response = await fetch(downloadLink)
  const fileStream = fs.createWriteStream(tunaZipDestination)
  console.log(`Downloading tuna from ${downloadLink}`)
  await new Promise((resolve, reject) => {
    const stream = Readable.fromWeb(response.body)
    stream.pipe(fileStream)
    stream.on('error', (err) => {
      reject(err)
    })
    stream.on('close', function () {
      resolve()
    })
  })

  console.log(`Extracting tuna to ${tunaExtractDestination}`)
  await extractZip(tunaZipDestination, { dir: tunaExtractDestination })

  const finalExtractionDir = new URL(tunaZipFileName.replace('.zip', '') + '/', cacheDir)
  let executableName = 'tuna'
  let executableDestinationName = `tuna-${tunaFileName}`
  if (os.platform() === 'win32') {
    executableName = `${executableName}.exe`
    executableDestinationName = `${executableDestinationName}.exe`
  }

  renameSync(
    new URL(executableName, finalExtractionDir),
    new URL(executableDestinationName, tunaBinDir),
  )

  Object.values(SETTINGS_FILES).forEach((file) => {
    if (!OPTIONAL_SETTINGS_FILES.includes(file)) {
      renameSync(new URL(file, finalExtractionDir), new URL(file, tunaBinDir))
    }
  })

  rmSync(cacheDir, { recursive: true })
  console.log('Tuna downloaded and extracted')
}

// if is run as main
if (import.meta.url.toString() === new URL(`file://${process.argv[1]}`).toString()) {
  await downloadTuna()
}
