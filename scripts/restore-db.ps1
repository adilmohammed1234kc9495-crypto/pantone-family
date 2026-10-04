# ==============================================================================
# Pantone Fixed Asset Management System - Windows Database Restore Script (PowerShell)
# Usage: .\scripts\restore-db.ps1 -BackupFile <path_to_backup_file.sql>
# ==============================================================================
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$HostName = "127.0.0.1",
    [int]$Port = 5433,
    [string]$Database = "pantone_fam",
    [string]$User = "postgres"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -Path $BackupFile)) {
    throw "Backup file not found: $BackupFile"
}

Write-Host "====================================================================" -ForegroundColor Yellow
Write-Host " WARNING: Restoring will overwrite existing data in '$Database'" -ForegroundColor Yellow
Write-Host " Target backup: $BackupFile" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Yellow

$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (!(Test-Path $psqlPath)) {
    $psqlPath = (Get-Command psql -ErrorAction SilentlyContinue).Source
}

if (!$psqlPath) {
    throw "psql executable not found."
}

Write-Host "Restoring database..." -ForegroundColor Cyan
Get-Content -Path $BackupFile | & $psqlPath -h $HostName -p $Port -U $User -d $Database

Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Database restored successfully." -ForegroundColor Green
