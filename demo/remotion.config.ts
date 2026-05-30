import { Config } from '@remotion/cli/config'
import path from 'node:path'

// Run remotion from this `demo/` directory, so cwd is `demo/` and the
// extension source lives one level up at `../src`.
const EXT_SRC = path.join(process.cwd(), '..', 'src')

Config.setVideoImageFormat('jpeg')
Config.setConcurrency(1) // deterministic, sequential render (single React tree)

Config.overrideWebpackConfig((current) => ({
  ...current,
  module: {
    ...current.module,
    // Honour Vite's `?url` import suffix (used by src/lib/pdf.ts for the pdf.js
    // worker): emit the target as a static asset so the import yields a URL
    // string. The worker never actually runs in the demo — this just lets the
    // module load without tripping pdf.js's `workerSrc` string check.
    rules: [
      ...(current.module?.rules ?? []),
      { resourceQuery: /url/, type: 'asset/resource' },
    ],
  },
  resolve: {
    ...current.resolve,
    alias: {
      ...(current.resolve?.alias ?? {}),
      '@': EXT_SRC,
    },
  },
}))
