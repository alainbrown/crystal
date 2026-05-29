import { Config } from '@remotion/cli/config'
import path from 'node:path'

// Run remotion from this `demo/` directory, so cwd is `demo/` and the
// extension source lives one level up at `../src`.
const EXT_SRC = path.join(process.cwd(), '..', 'src')

Config.setVideoImageFormat('jpeg')
Config.setConcurrency(1) // deterministic, sequential render (single React tree)

Config.overrideWebpackConfig((current) => ({
  ...current,
  resolve: {
    ...current.resolve,
    alias: {
      ...(current.resolve?.alias ?? {}),
      '@': EXT_SRC,
    },
  },
}))
