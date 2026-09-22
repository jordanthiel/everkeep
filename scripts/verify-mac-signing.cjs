const { execFileSync } = require('node:child_process')
const path = require('node:path')

// electron-builder 25 calls afterSign after its built-in notarization/stapling.
// It otherwise only warns when notarization credentials are missing.
module.exports = async function verifyMacSigning(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  try {
    execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], { stdio: 'inherit' })
    execFileSync('xcrun', ['stapler', 'validate', appPath], { stdio: 'inherit' })
    execFileSync('spctl', ['--assess', '--type', 'execute', '--verbose=2', appPath], { stdio: 'inherit' })
  } catch (cause) {
    throw new Error(
      'macOS distribution requires a Developer ID Application signature and a valid stapled Apple notarization ticket. See README.md for release credentials.',
      { cause }
    )
  }
}
