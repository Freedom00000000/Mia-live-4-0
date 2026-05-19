#Requires -Version 5.1
<#
.SYNOPSIS
    MIA Windows Installer
.DESCRIPTION
    Checker Node.js og Git, installerer npm-pakker,
    opretter .env og starter eller bygger appen.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$AppName    = "MIA AI"
$RepoUrl    = "https://github.com/Freedom00000000/Mia-live-4-0.git"
$NodeMinVer = [Version]"18.0.0"

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-OK   { param([string]$m) Write-Host "[OK]   $m" -ForegroundColor Green }
function Write-Warn { param([string]$m) Write-Host "[!!]   $m" -ForegroundColor Yellow }
function Write-Err  { param([string]$m) Write-Host "[FEJL] $m" -ForegroundColor Red }

function Test-Cmd {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Reload-Path {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath    = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path    = $machinePath + ";" + $userPath
}

function Install-NodeJs {
    Write-Warn "Node.js ikke fundet. Henter installer..."
    $url  = "https://nodejs.org/dist/v20.19.0/node-v20.19.0-x64.msi"
    $dest = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
    Write-Host "Installerer Node.js (kraever admin-rettigheder)..."
    Start-Process msiexec.exe -ArgumentList "/i `"$dest`" /quiet /norestart" -Verb RunAs -Wait
    Remove-Item $dest -Force
    Reload-Path
    Write-OK "Node.js installeret."
}

function Install-Git {
    Write-Warn "Git ikke fundet. Henter Git installer..."
    $url  = "https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/Git-2.44.0-64-bit.exe"
    $dest = "$env:TEMP\git-installer.exe"
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
    Start-Process $dest -ArgumentList "/VERYSILENT /NORESTART" -Wait
    Remove-Item $dest -Force
    Reload-Path
    Write-OK "Git installeret."
}

# ── 1. Velkomst ───────────────────────────────────────────────────────────────
Write-Header "$AppName - Windows Installer"
Write-Host "Dette script:"
Write-Host "  1. Checker Node.js og Git"
Write-Host "  2. Kloner eller opdaterer projektet"
Write-Host "  3. Installerer npm-pakker"
Write-Host "  4. Opretter .env-konfigurationsfil"
Write-Host "  5. Bygger Windows .exe eller starter appen"

# ── 2. Node.js ────────────────────────────────────────────────────────────────
Write-Header "Checker Node.js"
if (-not (Test-Cmd "node")) { Install-NodeJs }

$nodeVer = [Version](node --version).TrimStart("v")
if ($nodeVer -lt $NodeMinVer) {
    Write-Err "Node.js $nodeVer er for gammel (kraever >= $NodeMinVer)."
    exit 1
}
Write-OK "Node.js $nodeVer fundet."
Write-OK "npm $(npm --version) fundet."

# ── 3. Git ────────────────────────────────────────────────────────────────────
Write-Header "Checker Git"
if (-not (Test-Cmd "git")) {
    Install-Git
} else {
    Write-OK "Git fundet."
}

# ── 4. Klon / opdater projekt ─────────────────────────────────────────────────
Write-Header "Projektmappe"
$installDir = Join-Path $env:USERPROFILE "MIA"

if (Test-Path (Join-Path $installDir ".git")) {
    Write-Host "Eksisterende installation fundet i $installDir - opdaterer..."
    Set-Location $installDir
    git pull origin main
    Write-OK "Projekt opdateret."
} else {
    Write-Host "Kloner til $installDir ..."
    git clone $RepoUrl $installDir
    Set-Location $installDir
    Write-OK "Projekt klonet."
}

# ── 5. npm install ────────────────────────────────────────────────────────────
Write-Header "Installerer pakker"
npm install --prefer-offline
Write-OK "npm-pakker installeret."

# ── 6. .env ───────────────────────────────────────────────────────────────────
Write-Header "Konfiguration (.env)"
$envFile = Join-Path $installDir ".env"

if (-not (Test-Path $envFile)) {
    $apiKey = Read-Host "Indtast din GROQ API-noegle (Enter for at springe over)"
    $port   = Read-Host "Serverport [Enter = 3000]"
    if ([string]::IsNullOrWhiteSpace($port)) { $port = "3000" }

    $lines = @(
        "# MIA konfiguration",
        "GROQ_API_KEY=$apiKey",
        "PORT=$port"
    )
    $lines | Set-Content -Path $envFile -Encoding UTF8
    Write-OK ".env oprettet."
} else {
    Write-OK ".env eksisterer allerede - springer over."
}

# ── 7. Handling ───────────────────────────────────────────────────────────────
Write-Header "Hvad vil du goere?"
Write-Host "  [1] Byg Windows .exe"
Write-Host "  [2] Start Electron dev-app"
Write-Host "  [3] Start web-server"
Write-Host "  [4] Afslut"

$choice = Read-Host "Dit valg"

switch ($choice) {
    "1" {
        Write-Header "Bygger Windows .exe"
        npm run electron:build
        $distDir = Join-Path $installDir "dist"
        Write-OK "Bygget! Installer findes i: $distDir"
        Start-Process explorer.exe $distDir
    }
    "2" {
        Write-Header "Starter Electron"
        Start-Process npm -ArgumentList "run electron:dev" -WorkingDirectory $installDir
        Write-OK "Electron startet."
    }
    "3" {
        Write-Header "Starter web-server"
        Start-Process npm -ArgumentList "start" -WorkingDirectory $installDir
        Start-Sleep -Seconds 2
        $portVal = "3000"
        if (Test-Path $envFile) {
            $match = Select-String -Path $envFile -Pattern "^PORT=(.+)"
            if ($match) { $portVal = $match.Matches[0].Groups[1].Value.Trim() }
        }
        Start-Process "http://localhost:$portVal"
        Write-OK "Server startet paa http://localhost:$portVal"
    }
    default {
        Write-Host "Afslutter." -ForegroundColor Yellow
    }
}

Write-Header "Faerdig"
Write-Host "Projektmappe: $installDir"
Write-Host "Koer scriptet igen for at opdatere eller geninstallere."
