#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'mugiwara requires Node.js >= 20. Install it from https://nodejs.org first.'
}

$major = [int](node -p 'process.versions.node.split(".")[0]')
if ($major -lt 20) {
  Write-Error "mugiwara requires Node.js >= 20 (found $(node --version))."
}

npx -y @ionivetech/mugiwara@latest @args
exit $LASTEXITCODE
