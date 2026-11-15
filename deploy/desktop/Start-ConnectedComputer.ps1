param(
    [Parameter(Mandatory = $true)][string]$ConfigPath,
    [Parameter(Mandatory = $true)][string]$NodePath,
    [Parameter(Mandatory = $true)][string]$ConnectorPath
)
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$mutex = [Threading.Mutex]::new($false, ('Local\RethosConnectedComputer-' + $config.environmentId))
try { $acquired = $mutex.WaitOne(0) }
catch [Threading.AbandonedMutexException] { $acquired = $true }
if (-not $acquired) { $mutex.Dispose(); exit 0 }
$logDirectory = Join-Path (Split-Path -Parent $ConfigPath) 'logs'
[IO.Directory]::CreateDirectory($logDirectory) | Out-Null
$delaySeconds = 5
try {
    while ($true) {
        $started = Get-Date
        $child = Start-Process -FilePath $NodePath -ArgumentList @(('"' + $ConnectorPath + '"'), ('"' + $ConfigPath + '"')) `
            -WindowStyle Hidden -PassThru -Wait `
            -RedirectStandardOutput (Join-Path $logDirectory 'computer.log') `
            -RedirectStandardError (Join-Path $logDirectory 'computer-error.log')
        if ($child.ExitCode -eq 0) { break }
        if (((Get-Date) - $started).TotalSeconds -gt 60) { $delaySeconds = 5 }
        Start-Sleep -Seconds $delaySeconds
        $delaySeconds = [Math]::Min(60, $delaySeconds * 2)
    }
}
finally { $mutex.ReleaseMutex(); $mutex.Dispose() }
