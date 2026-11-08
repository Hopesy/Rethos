param(
    [string]$VpsHost = '150.109.198.77',
    [string]$VpsUser = 'zhouhl',
    [int]$VpsPort = 22,
    [int]$ReversePort = 22222,
    [string]$IdentityFile = "$env:USERPROFILE\.ssh\rethos_vps_tunnel"
)
$ErrorActionPreference = 'Stop'
$mutex = [System.Threading.Mutex]::new($false, 'Local\RethosDesktopTunnel')
$acquired = $false
try {
    $acquired = $mutex.WaitOne(0)
    if (-not $acquired) { exit 0 }
    if (-not (Test-Path -LiteralPath $IdentityFile)) { throw "Missing SSH key: $IdentityFile" }
    $sshExe = (Get-Command ssh.exe -ErrorAction Stop).Source
    while ($true) {
        & $sshExe -NT -p $VpsPort -i $IdentityFile `
            -o BatchMode=yes -o StrictHostKeyChecking=yes `
            -o ExitOnForwardFailure=yes -o ConnectTimeout=10 `
            -o ServerAliveInterval=20 -o ServerAliveCountMax=3 `
            -R "127.0.0.1:${ReversePort}:127.0.0.1:22" "${VpsUser}@${VpsHost}"
        Start-Sleep -Seconds 10
    }
} finally {
    if ($acquired) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
