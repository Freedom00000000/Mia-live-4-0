#Requires -Version 5.1
<#
.SYNOPSIS
    MIA Windows Installer – opsætter og starter MIA AI-følgesvend.
.DESCRIPTION
    Tjekker afhængigheder (Node.js, Git), installerer npm-pakker,
    opretter .env-fil og tilbyder at bygge eller starte appen.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$AppName    = "MIA AI-Følgesvend"
$RepoUrl    = "https://github.com/Freedom00000000/Mia-live-4-0.git"
$NodeMinVer = [Version]"18.0.0"

function Write-Header {
    param([string]$Text)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Write-OK   { param([string]$m) Write-Host "[OK]  $m" -ForegroundColor Green }
function Write-Warn { param([string]$m) Write-Host "[!!]  $m" -ForegroundColor Yellow }
function Write-Err  { param([string]$m) Write-Host "[FEJL] $m" -ForegroundColor Red }

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Install-NodeJs {
    Write-Warn "Node.js ikke fundet. Henter installer..."
    $installerUrl  = "https://nodejs.org/dist/v20.19.0/node-v20.19.0-x64.msi"
    $installerPath = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "Installerer Node.js (kræver admin-rettigheder)..."
    Start-Process msiexec.exe -ArgumentList "/i `"$installerPath`" /quiet /norestart" -Verb RunAs -Wait
    Remove-Item $installerPath -Force
    # Genindlæs PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-OK "Node.js installeret."
}

# ── 1. Velkomsttekst ──────────────────────────────────────────────────────────
Write-Header "$AppName – Windows Installer"
Write-Host "Dette script:"
Write-Host "  1. Tjekker Node.js og Git"
Write-Host "  2. Kloner eller opdaterer projektet"
Write-Host "  3. Installerer npm-afhængigheder"
Write-Host "  4. Opretter .env-konfigurationsfil"
Write-Host "  5. Bygger Windows .exe (valgfrit) eller starter dev-server`n"

# ── 2. Node.js ────────────────────────────────────────────────────────────────
Write-Header "Tjekker Node.js"
if (-not (Test-Command "node")) {
    Install-NodeJs
}

$nodeVer = [Version](node --version).TrimStart("v")
if ($nodeVer -lt $NodeMinVer) {
    Write-Err "Node.js $nodeVer er for gammel (kræver >= $NodeMinVer). Opdater på https://nodejs.org"
    exit 1
}
Write-OK "Node.js $nodeVer fundet."
Write-OK "npm $(npm --version) fundet."

# ── 3. Git ────────────────────────────────────────────────────────────────────
Write-Header "Tjekker Git"
if (-not (Test-Command "git")) {
    Write-Warn "Git ikke fundet. Henter Git installer..."
    $gitUrl  = "https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/Git-2.44.0-64-bit.exe"
    $gitPath = "$env:TEMP\git-installer.exe"
    Invoke-WebRequest -Uri $gitUrl -OutFile $gitPath -UseBasicParsing
    Start-Process $gitPath -ArgumentList "/VERYSILENT /NORESTART" -Wait
    Remove-Item $gitPath -Force
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-OK "Git installeret."
} else {
    Write-OK "Git $(git --version) fundet."
}

# ── 4. Klon / opdater projekt ─────────────────────────────────────────────────
Write-Header "Projektmappe"
$installDir = Join-Path $env:USERPROFILE "MIA"

if (Test-Path (Join-Path $installDir ".git")) {
    Write-Host "Eksisterende installation fundet i $installDir – opdaterer..."
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
Write-Header "Installerer afhængigheder"
npm install --prefer-offline
Write-OK "npm-pakker installeret."

# ── 6. .env-konfiguration ─────────────────────────────────────────────────────
Write-Header "Konfiguration (.env)"
$envFile = Join-Path $installDir ".env"

if (-not (Test-Path $envFile)) {
    $apiKey = Read-Host "Indtast din GROQ API-nøgle (lad stå tom for at springe over)"
    $port   = Read-Host "Vælg serverport [tryk Enter for 3000]"
    if ([string]::IsNullOrWhiteSpace($port)) { $port = "3000" }

    $envContent = @"
# MIA konfiguration – genereret af install-windows.ps1
GROQ_API_KEY=$apiKey
PORT=$port
"@
    Set-Content -Path $envFile -Value $envContent -Encoding UTF8
    Write-OK ".env oprettet."
} else {
    Write-OK ".env eksisterer allerede – springer over."
}

# ── 7. Vælg handling ──────────────────────────────────────────────────────────
Write-Header "Hvad vil du gøre?"
Write-Host "  [1] Byg Windows .exe (kræver electron-builder)"
Write-Host "  [2] Start Electron dev-app"
Write-Host "  [3] Start kun web-server (node server.js)"
Write-Host "  [4] Afslut"

$choice = Read-Host "`nDit valg"

switch ($choice) {
    "1" {
        Write-Header "Bygger Windows .exe"
        npm run electron:build
        $distDir = Join-Path $installDir "dist"
        Write-OK "Bygget! Find din installer i: $distDir"
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
        $port = (Select-String -Path $envFile -Pattern "^PORT=(.+)" | ForEach-Object { $_.Matches[0].Groups[1].Value }) ?? "3000"
        Start-Process "http://localhost:$port"
        Write-OK "Server startet på http://localhost:$port"
    }
    default {
        Write-Host "Afslutter. Kør install-windows.ps1 igen når du er klar." -ForegroundColor Yellow
    }
}

Write-Header "Installation fuldført"
Write-Host "Projektmappe: $installDir"
Write-Host "Kør igen for at opdatere eller geninstallere.`n"
