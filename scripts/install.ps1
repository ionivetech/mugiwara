#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'mugiwara requires Node.js >= 20.11. Install it from https://nodejs.org first.'
}

# floor must match package.json "engines.node" exactly, and install.sh
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>20||(a===20&&b>=11)?0:1)'
if ($LASTEXITCODE -ne 0) {
  Write-Error "mugiwara requires Node.js >= 20.11 (found $(node --version))."
}

npx -y @ionivetech/mugiwara@latest @args
exit $LASTEXITCODE
