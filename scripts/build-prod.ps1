<#
.SYNOPSIS
    Build and push Docker image to GitHub Container Registry (GHCR) on Windows PowerShell.

.PARAMETER Tag
    Optional image tag (default: latest)
#>
param(
    [string]$Tag = 'latest'
)

# Determine project root and switch directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
Set-Location $projectRoot

# Load .env from project root
$envFile = Join-Path $projectRoot '.env'
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*#') { return }
        if ($_ -match '^\s*$') { return }
        $parts = $_ -split '=', 2
        if ($parts.Length -eq 2) {
            [Environment]::SetEnvironmentVariable($parts[0], $parts[1])
        }
    }
}

# Configuration
$Registry = 'ghcr.io'
$Owner    = 'geber-suprabapak'
$Repo     = 'project-chronos'
$Image    = "$Registry/$Owner/$Repo"

# Check credentials
if (-not $Env:GHCR_USERNAME -or -not $Env:GHCR_TOKEN) {
    Write-Error "Please set GHCR_USERNAME and GHCR_TOKEN environment variables."
    exit 1
}

# Login to GHCR
$loginCmd = "echo $Env:GHCR_TOKEN | docker login $Registry -u $Env:GHCR_USERNAME --password-stdin"
Invoke-Expression $loginCmd

# Build Docker image
docker build -t "$($Image):$Tag" .

# Push to GHCR
docker push "$($Image):$Tag"

Write-Host "✅ Pushed $($Image):$Tag"