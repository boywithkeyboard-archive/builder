import { buildSync } from 'esbuild'
import { ensureDirSync, ensureFileSync } from 'fs-extra'
import minimist from 'minimist'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { rimrafSync } from 'rimraf'

const argv = minimist(process.argv.slice(2))

, node = argv.node !== undefined

let minimumNodeVersion = '18'

if (node && typeof argv.node === 'string') {
  minimumNodeVersion = argv.node
}

const entryPoints: Record<string, string> = {}

for (const pair of argv._) {
  const arr = pair.split(':')

  entryPoints[arr[0]] = arr[1]
}

ensureDirSync('./build')
rimrafSync('./build')

// copy important files

copyFileSync('./license', './build/license')
try { copyFileSync('./package-lock.json', './build/package-lock.json') } catch (err) {}
copyFileSync('./readme.md', './build/readme.md')

// generate final package.json

const packageJson = JSON.parse(readFileSync('./package.json', { encoding: 'utf-8' }))

packageJson.engines = {
  ...packageJson.engines,
  node: '>=' + minimumNodeVersion
}

packageJson.type = 'module'

packageJson.main = './index.js'
packageJson.module = './index.js'
packageJson.types = './index.d.ts'

const exports: Record<string, any> = {}

for (const output of Object.values(entryPoints)) {
  let key = '.'
  let key2 = './'

  if (output.includes('/')) {
    const dir = output.split('/')[0]

    key += '/' + dir
    key2 += dir
  }

  exports[key] = {
    import: {
      types: key2 + 'index.d.ts',
      default: key2 + 'index.js'
    }
  }
}

packageJson.exports = exports

writeFileSync(
  './build/package.json',
  JSON.stringify(packageJson, null, 2)
)

// build code

for (const [input, output] of Object.entries(entryPoints)) {
  const outfile = './build/' + entryPoints[output]

  ensureFileSync(outfile)

  buildSync({
    entryPoints: ['./' + input],
    bundle: true,
    minify: true,
    allowOverwrite: true,
    format: 'esm',
    platform: node ? 'node' : 'browser',
    outfile,
    ...(packageJson.dependencies && { external: Object.keys(packageJson.dependencies) }) // set all non-dev deps as external
  })

  if (output.includes('/')) {
    const dir = output.split('/')[0]

    writeFileSync(
      './build/' + dir + '/package.json',
      JSON.stringify({
        main: './' + entryPoints[output],
        module: './' + entryPoints[output],
        types: './' + entryPoints[output].replace('.js', '.d.ts'),
        type: 'esm'
      }, null, 2)
    )
  }
}
