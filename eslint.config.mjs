import path from 'node:path'
import { fileURLToPath } from 'node:url'

// eslint-disable-next-line n/no-unpublished-import
import { FlatCompat } from '@eslint/eslintrc'
// eslint-disable-next-line n/no-unpublished-import
import eslintConfigPrettier from 'eslint-config-prettier'
// eslint-disable-next-line n/no-unpublished-import
import nodePlugin from 'eslint-plugin-n'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

export default [
  ...compat.extends('standard'),
  ...nodePlugin.configs['flat/mixed-esm-and-cjs'],
  {
    rules: {
      'n/prefer-node-protocol': 'error',
      'n/no-unsupported-features/node-builtins': 'off',
    },
    ignores: ['**/bin/**', '**/dist/**', '**/cache/**', '**/node_modules/**', '**/config/**'],
  },
  eslintConfigPrettier,
]
