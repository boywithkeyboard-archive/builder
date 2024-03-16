import { buildSync } from 'esbuild'
import { copySync, ensureFileSync } from 'fs-extra'
import minimist from 'minimist'
import { execSync } from 'node:child_process'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { rimrafSync } from 'rimraf'

const argv = minimist(process.argv.slice(2))

, node = argv.node !== undefined

let minimumNodeVersion = '18'

if (node && typeof argv.node === 'string') {
  minimumNodeVersion = argv.node
}

const pairs: Record<string, string> = {}

for (const pair of argv._) {
  const arr = pair.split(':')

  pairs[arr[0]] = arr[1]
}

rimrafSync('./build')

// copy important files

copySync('./license', './build/license')
try { copyFileSync('./package-lock.json', './build/package-lock.json') } catch (err) {}
copyFileSync('./readme.md', './build/readme.md')

// generate final package.json

const packageJson = JSON.parse(readFileSync('./package.json', { encoding: 'utf-8' }))

if (!packageJson.engines) {
  packageJson.engines = {
    node: '>=' + minimumNodeVersion
  }
}

packageJson.type = 'module'

packageJson.main = './index.js'
packageJson.module = './index.js'
packageJson.types = './index.d.ts'

const exports: Record<string, any> = {}

for (const output of Object.values(pairs)) {
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

const tsConfig = JSON.parse(readFileSync('./tsconfig.json', { encoding: 'utf-8' }))

// build code

for (let [input, output] of Object.entries(pairs)) {
  const outfile = './build/' + output

  input = './' + input

  if (tsConfig.compilerOptions?.rootDir) {
    input = input.replace('./', './' + tsConfig.compilerOptions.rootDir)
  }

  ensureFileSync(outfile)

  buildSync({
    entryPoints: [input],
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
        main: './' + output,
        module: './' + output,
        types: './' + output.replace('.js', '.d.ts'),
        type: 'module'
      }, null, 2)
    )
  }
}

// autocorrect package.json syntax issues

execSync('npm pkg fix', {
  cwd: join(process.cwd(), './build')
})

// generate type declarations

execSync('npx tsc')
