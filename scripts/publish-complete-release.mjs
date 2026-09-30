import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const repository = process.env.GITHUB_REPOSITORY || 'jordanthiel/everkeep'
const token = process.env.GH_TOKEN
if (!token) throw new Error('GH_TOKEN is required to publish a completed release.')
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
// The tag lookup excludes drafts. Listing releases with write access includes them.
const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=100`, { headers })
if (!response.ok) throw new Error(`Release lookup failed: HTTP ${response.status}`)
const release = (await response.json()).find(item => item.tag_name === `v${version}`)
if (!release) throw new Error(`Release v${version} has not been created yet.`)
const required = [
  `Everkeep-${version}-arm64.dmg`, `Everkeep-${version}.dmg`,
  `Everkeep-${version}-arm64-mac.zip`, `Everkeep-${version}-mac.zip`,
  'Everkeep-win-x64.exe', 'Everkeep-win-x64.zip', 'latest.yml', 'latest-mac.yml'
]
const missing = required.filter(name => !release.assets.some(asset => asset.name === name && asset.size > 0 && asset.state === 'uploaded'))
if (missing.length) {
  console.log(`Release remains a draft until the other platform finishes: ${missing.join(', ')}`)
} else if (release.draft) {
  const published = await fetch(`https://api.github.com/repos/${repository}/releases/${release.id}`, {
    method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft: false, prerelease: false, make_latest: 'true' })
  })
  if (!published.ok) throw new Error(`Release publication failed: HTTP ${published.status}`)
  console.log(`Published complete release v${version}.`)
} else {
  console.log(`Release v${version} is already published.`)
}
