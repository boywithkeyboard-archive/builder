import { build } from 'esbuild'
import minimist from 'minimist'

const argv = minimist(process.argv.slice(2))

console.log(argv)

const esm = argv.esm === true
, cjs = argv.cjs === true

, entryPoint = argv._[0] ?? './mod.ts'

if (esm) {
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    minify: true,
    allowOverwrite: true,
    format: 'esm',
    platform: 'node',
    outfile: './dist/index.mjs'
  })
}

if (cjs) {
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    minify: true,
    allowOverwrite: true,
    format: 'cjs',
    platform: 'node',
    outfile: './dist/index.cjs'
  })
}
