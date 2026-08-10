import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import png2icons from 'png2icons'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = join(root, 'build')
const rendererAssets = join(root, 'src/renderer/assets')
const svgPath = join(buildDir, 'icon.svg')

mkdirSync(buildDir, { recursive: true })
mkdirSync(rendererAssets, { recursive: true })

const svg = readFileSync(svgPath)
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1024 },
  background: 'rgba(0,0,0,0)'
})
const png1024 = resvg.render().asPng()
const pngPath = join(buildDir, 'icon.png')
writeFileSync(pngPath, png1024)
copyFileSync(pngPath, join(rendererAssets, 'icon.png'))

const ico = png2icons.createICO(png1024, png2icons.BICUBIC, 0, false, true)
if (!ico) throw new Error('Failed to create ICO')
writeFileSync(join(buildDir, 'icon.ico'), ico)

const icns = png2icons.createICNS(png1024, png2icons.BICUBIC, 0)
if (!icns) throw new Error('Failed to create ICNS')
writeFileSync(join(buildDir, 'icon.icns'), icns)

console.log('Generated build/icon.png, build/icon.ico, build/icon.icns, src/renderer/assets/icon.png')
