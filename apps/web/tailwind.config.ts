import type { Config } from 'tailwindcss'
import sharedConfig from '@tse/config/tailwind.config'

const config: Config = {
  ...sharedConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
} as Config

export default config
