# ==============================================================================
# Pantone Fixed Asset Management System - Windows Database Backup Script (PowerShell)
# Usage: .\scripts\backup-db.ps1 [-BackupDir <path>]
# ==============================================================================
param(
    [string]$BackupDir = "$HOME\backups\pantone_fam",
    [string]$HostName = "127.0.0.1",
    [int]$Port = 5433,
    [string]$Database = "pantone_fam",
    [string]$User = "postgres"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "pantone_fam_backup_$timestamp.sql"

Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Starting database backup..." -ForegroundColor Cyan

$pgDumpPath = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
if (!(Test-Path $pgDumpPath)) {
    $pgDumpPath = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
}

if (!$pgDumpPath) {
    throw "pg_dump executable not found."
}

& $pgDumpPath -h $HostName -p $Port -U $User -d $Database --format=plain --no-owner --clean -f $backupFile

$fileInfo = Get-Item $backupFile
Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Backup completed: $backupFile ($([math]::Round($fileInfo.Length / 1MB, 2)) MB)" -ForegroundColor Green
