[CmdletBinding()]
param(
    [ValidateSet('Install','Check','Uninstall')][string]$Action = 'Install',
    [string]$VpsHost,
    [string]$VpsUser,
    [ValidateRange(1,65535)][int]$VpsPort = 22,
    [string]$DeviceName,
    [ValidateRange(0,65535)][int]$ReversePort = 0,
    [ValidateRange(1,65535)][int]$LocalSshPort = 22,
    [string]$IdentityFile,
    [string]$Container,
    [string]$DriverPath,
    [string]$InstallDirectory = "$env:LOCALAPPDATA\RethosDesktop",
    [string]$ExpectedUserSid,
    [switch]$NoRegisterMcp,
    [switch]$LibraryOnly
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$script:PackageDirectory = $PSScriptRoot
$script:ConfigPath = Join-Path $InstallDirectory 'desktop.json'
$script:Utf8 = [Text.UTF8Encoding]::new($false)
$script:InteractiveInstall = -not $VpsHost

function Write-Utf8([string]$Path, [string]$Text) {
    [IO.File]::WriteAllText($Path, $Text, $script:Utf8)
}

function Quote-Argument([string]$Value) {
    '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}

function Invoke-ProcessResult([string]$Executable, [string[]]$Arguments) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Executable
    $info.Arguments = ($Arguments | ForEach-Object { Quote-Argument $_ }) -join ' '
    $info.UseShellExecute = $false
    $info.RedirectStandardOutput = $true
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $info
    try {
        $process.Start() | Out-Null
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        $process.WaitForExit()
        return @{ Code=$process.ExitCode; Output=$outputTask.Result }
    } finally { $process.Dispose() }
}

function Invoke-Native([string]$Executable, [string[]]$Arguments) {
    $result = Invoke-ProcessResult $Executable $Arguments
    if ($result.Output) { Write-Host $result.Output.TrimEnd() }
    if ($result.Code -ne 0) { throw "$Executable 执行失败，退出码 $($result.Code)" }
}

function Read-Setting([string]$Label, [string]$Value, [string]$Default) {
    if ($Value) { return $Value }
    $inputValue = Read-Host "$Label [$Default]"
    if ($inputValue) { return $inputValue.Trim() }
    return $Default
}

function Assert-Settings($Config) {
    if ($Config.VpsHost -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$') { throw 'VPS 地址请填写 IPv4 或主机名。' }
    if ($Config.VpsUser -notmatch '^[a-z_][a-z0-9_-]{0,31}$') { throw 'VPS 用户名格式有误。' }
    if ($Config.DeviceName -notmatch '^[a-z][a-z0-9-]{0,23}$') { throw '电脑名称请使用小写字母开头，最多 24 位字母、数字和横线。' }
    if ($Config.ReversePort -ne 0 -and $Config.ReversePort -lt 1024) { throw '反向端口应为 1024–65535，或 0（自动分配）。' }
    foreach ($name in @('VpsPort','LocalSshPort')) {
        if ($Config.$name -lt 1 -or $Config.$name -gt 65535) { throw "$name 应为 1–65535。" }
    }
    if ($Config.ReversePort -gt 65535) { throw '反向端口应小于 65536。' }
}

function Protect-Directory([string]$Path) {
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    Invoke-Native icacls.exe @($Path, '/inheritance:r', '/grant:r', "*${sid}:(OI)(CI)(F)", '*S-1-5-18:(OI)(CI)(F)', '*S-1-5-32-544:(OI)(CI)(F)')
}

function Ensure-Elevation {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    if ($ExpectedUserSid -and $identity.User.Value -ne $ExpectedUserSid) { throw '请使用日常登录账户的管理员权限运行，以便接入该用户的桌面。' }
    if ([Security.Principal.WindowsPrincipal]::new($identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { return }
    $forward = @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $script:PackageDirectory 'Setup-Desktop.ps1'),'-Action',$Action,'-InstallDirectory',$InstallDirectory,'-ExpectedUserSid',$identity.User.Value)
    foreach ($name in @('VpsHost','VpsUser','DeviceName','IdentityFile','Container','DriverPath')) {
        $value = Get-Variable -Name $name -ValueOnly
        if ($value) { $forward += @('-' + $name, [string]$value) }
    }
    $forward += @('-VpsPort',"$VpsPort",'-ReversePort',"$ReversePort",'-LocalSshPort',"$LocalSshPort")
    if ($NoRegisterMcp) { $forward += '-NoRegisterMcp' }
    $arguments = ($forward | ForEach-Object { Quote-Argument $_ }) -join ' '
    # This is the interactive installer; its console hosts SSH fingerprint and password prompts.
    $process = Start-Process -FilePath "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList $arguments -Verb RunAs -Wait -PassThru
    exit $process.ExitCode
}

function Get-SshExe([string]$Name) {
    $path = Join-Path "$env:WINDIR\System32\OpenSSH" $Name
    if (-not (Test-Path -LiteralPath $path)) { throw "缺少 OpenSSH 程序：$path" }
    return $path
}

function Ensure-OpenSsh($Config) {
    $wasInstalled = [bool](Get-Service sshd -ErrorAction SilentlyContinue)
    foreach ($name in @('OpenSSH.Client~~~~0.0.1.0','OpenSSH.Server~~~~0.0.1.0')) {
        $feature = Get-WindowsCapability -Online -Name $name
        if ($feature.State -ne 'Installed') {
            $result = Add-WindowsCapability -Online -Name $name
            if ($result.RestartNeeded) { throw 'OpenSSH 安装需要重启 Windows；重启后再次运行 Install.cmd 即可继续。' }
        }
    }
    $sshd = Get-SshExe 'sshd.exe'
    $serverConfig = "$env:ProgramData\ssh\sshd_config"
    if (-not (Test-Path -LiteralPath $serverConfig)) {
        New-Item -ItemType Directory -Force "$env:ProgramData\ssh" | Out-Null
        Copy-Item -LiteralPath (Join-Path (Split-Path $sshd) 'sshd_config_default') -Destination $serverConfig
    }
    if (-not $wasInstalled) {
        Copy-Item -LiteralPath $serverConfig -Destination (Join-Path $InstallDirectory 'sshd_config.before') -Force
        $body = Get-Content -LiteralPath $serverConfig -Raw
        Write-Utf8 $serverConfig ("ListenAddress 127.0.0.1`r`nPort $($Config.LocalSshPort)`r`n" + $body)
    }
    Invoke-Native (Get-SshExe 'ssh-keygen.exe') @('-A')
    Invoke-Native $sshd @('-t','-f',$serverConfig)
    Set-Service sshd -StartupType Automatic
    Start-Service sshd
    $settings = & $sshd -T -f $serverConfig -C "user=$env:USERNAME,host=localhost,addr=127.0.0.1"
    if ($LASTEXITCODE -ne 0) { throw '读取 OpenSSH 实际配置失败。' }
    $keySetting = @($settings | Where-Object { $_ -match '^authorizedkeysfile ' })[0] -replace '^authorizedkeysfile\s+',''
    $keySetting = $keySetting.Split(' ')[0]
    $keySetting = $keySetting.Replace('__PROGRAMDATA__',$env:ProgramData).Replace('%h',$env:USERPROFILE).Replace('%u',$env:USERNAME)
    if (-not [IO.Path]::IsPathRooted($keySetting)) { $keySetting = Join-Path $env:USERPROFILE $keySetting }
    $Config.AuthorizedKeysFile = [IO.Path]::GetFullPath($keySetting)
    $Config.WindowsHostKey = (Get-Content -LiteralPath "$env:ProgramData\ssh\ssh_host_ed25519_key.pub" -Raw).Trim()
}

function Assert-CuaSignature([string]$Path) {
    $signature = Get-AuthenticodeSignature -LiteralPath $Path
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Cua AI') { throw 'CUA 可执行文件签名验证失败。' }
}

function Install-Cua($Config) {
    if ($DriverPath) {
        $Config.DriverPath = (Resolve-Path -LiteralPath $DriverPath).Path
        $Config.DriverOwned = $false
        return
    }
    if ($Config.DriverPath -and -not $Config.DriverOwned) { return }
    $release = Get-Content (Join-Path $script:PackageDirectory 'cua-release.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $target = Join-Path $InstallDirectory ('cua-' + $release.version)
    $Config.DriverPath = Join-Path $target 'cua-driver.exe'
    $Config.DriverOwned = $true
    if (Test-Path -LiteralPath $Config.DriverPath) { Assert-CuaSignature $Config.DriverPath; return }
    $cache = Join-Path $InstallDirectory '.Rethos-temp\downloads'
    New-Item -ItemType Directory -Force $cache | Out-Null
    $archive = Join-Path $cache ('cua-' + $release.version + '.zip')
    $bundled = Join-Path $script:PackageDirectory ('vendor\cua-' + $release.version + '.zip')
    if (-not (Test-Path -LiteralPath $archive) -and (Test-Path -LiteralPath $bundled)) { Copy-Item -LiteralPath $bundled -Destination $archive }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    if (-not (Test-Path -LiteralPath $archive)) { Invoke-WebRequest -UseBasicParsing -Uri $release.url -OutFile $archive }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $release.sha256) { throw "CUA 下载校验失败。删除 $archive 后重试。" }
    Expand-Archive -LiteralPath $archive -DestinationPath $target -Force
    if (-not (Test-Path -LiteralPath $Config.DriverPath)) {
        $found = @(Get-ChildItem -LiteralPath $target -Filter cua-driver.exe -File -Recurse)
        if ($found.Count -ne 1) { throw 'CUA 安装包目录结构有变化，请更新安装包。' }
        $Config.DriverPath = $found[0].FullName
    }
    Assert-CuaSignature $Config.DriverPath
}

function Invoke-Vps($Config, [string]$RemoteAction, [switch]$Bootstrap) {
    $request = @{ action=$RemoteAction; device=$Config.DeviceName; clientId=$Config.ClientId }
    if ($Bootstrap) {
        $request.windowsUser = $env:USERNAME
        $request.windowsHostKey = $Config.WindowsHostKey
        $request.tunnelPublicKey = (Get-Content -LiteralPath ($Config.TunnelKey + '.pub') -Raw).Trim()
        $request.driverPath = $Config.DriverPath
        $request.reversePort = $Config.ReversePort
        $request.container = $Config.Container
    }
    $payload = [Convert]::ToBase64String($script:Utf8.GetBytes(($request | ConvertTo-Json -Compress)))
    $sshArgs = @('-T','-p',"$($Config.VpsPort)",'-o','ConnectTimeout=15','-o','IdentitiesOnly=yes','-o',"UserKnownHostsFile=$($Config.KnownHostsFile)")
    if ($Bootstrap) {
        $sshArgs += @('-o','StrictHostKeyChecking=ask')
        if ($IdentityFile) { $sshArgs += @('-i',(Resolve-Path -LiteralPath $IdentityFile).Path) }
        $source = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $script:PackageDirectory 'setup-vps.py')))
        $command = 'python3 -c "import base64;code=base64.b64decode(''{0}'').decode();exec(compile(code,''<bootstrap>'',''exec''),dict(__name__=''__main__'',__file__=''<bootstrap>'',BOOTSTRAP_SOURCE=code))" {1}' -f $source,$payload
    } else {
        $sshArgs += @('-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i',$Config.TunnelKey)
        $command = $payload
    }
    if ($command.Length -gt 29000) { throw 'VPS 初始化命令过长，请更新安装包传输方式。' }
    $sshArgs += @("$($Config.VpsUser)@$($Config.VpsHost)",$command)
    $nativeResult = Invoke-ProcessResult (Get-SshExe 'ssh.exe') $sshArgs
    $response = @($nativeResult.Output -split '\r?\n')
    $code = $nativeResult.Code
    $line = @($response | Where-Object { $_ -like 'RETHOS_SETUP_JSON=*' } | Select-Object -Last 1)
    if ($line.Count -ne 1) { throw "VPS 连接失败（退出码 $code）。请检查地址、SSH 登录、Python 3 和 Docker 权限。" }
    $data = $line[0].Substring('RETHOS_SETUP_JSON='.Length) | ConvertFrom-Json
    if (-not $data.ok) { throw $data.error }
    return $data.result
}

function Set-WindowsAuthorization($Config, [string]$PublicKey, [switch]$Remove) {
    $path = $Config.AuthorizedKeysFile
    $folder = Split-Path $path
    New-Item -ItemType Directory -Force $folder | Out-Null
    $marker = 'rethos-desktop:' + $Config.DeviceName
    $lines = @(if (Test-Path -LiteralPath $path) { Get-Content -LiteralPath $path -Encoding UTF8 | Where-Object { -not $_.EndsWith(' ' + $marker) } })
    if (-not $Remove) {
        $bridgePath = (Join-Path $InstallDirectory 'Invoke-CuaBridge.ps1').Replace("'","''")
        $configPathEscaped = $script:ConfigPath.Replace("'","''")
        $bridge = "& '$bridgePath' -ConfigPath '$configPathEscaped'"
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($bridge))
        $parts = $PublicKey.Split(' ')
        $lines += 'restrict,command="powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ' + $encoded + '" ' + $parts[0] + ' ' + $parts[1] + ' ' + $marker
    }
    Write-Utf8 $path (($lines -join "`r`n") + "`r`n")
    if ((Split-Path $path -Leaf) -eq 'administrators_authorized_keys') {
        Invoke-Native icacls.exe @($path,'/inheritance:r','/grant:r','*S-1-5-18:(F)','*S-1-5-32-544:(F)')
    } else {
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        Invoke-Native icacls.exe @($path,'/inheritance:r','/grant:r',"*${sid}:(F)",'*S-1-5-18:(F)','*S-1-5-32-544:(F)')
    }
}

function Save-Config($Config) { Write-Utf8 $script:ConfigPath ($Config | ConvertTo-Json -Depth 8) }

function Install-Tasks($Config) {
    $launcher = Join-Path $InstallDirectory 'BackgroundLauncher.exe'
    $compiler = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    Invoke-Native $compiler @('/nologo','/target:winexe','/platform:x64','/optimize+',"/out:$launcher",(Join-Path $InstallDirectory 'BackgroundLauncher.cs'))
    $account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $account
    $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    $cuaArgs = @($Config.DriverPath,'serve')
    $tunnelArgs = @("$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe",'-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',(Join-Path $InstallDirectory 'Start-RethosTunnel.ps1'),'-VpsHost',$Config.VpsHost,'-VpsUser',$Config.VpsUser,'-VpsPort',"$($Config.VpsPort)",'-ReversePort',"$($Config.ReversePort)",'-LocalSshPort',"$($Config.LocalSshPort)",'-IdentityFile',$Config.TunnelKey,'-KnownHostsFile',$Config.KnownHostsFile,'-InstanceName',('RethosDesktop-' + $Config.DeviceName),'-LogDirectory',(Join-Path $InstallDirectory 'logs'))
    foreach ($spec in @(@{ Name=$Config.CuaTask; Args=$cuaArgs; Level='Highest' },@{ Name=$Config.TunnelTask; Args=$tunnelArgs; Level='Limited' })) {
        $actionSpec = New-ScheduledTaskAction -Execute $launcher -Argument (($spec.Args | ForEach-Object { Quote-Argument $_ }) -join ' ') -WorkingDirectory $InstallDirectory
        $principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel $spec.Level
        Register-ScheduledTask -TaskName $spec.Name -Action $actionSpec -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
        Start-ScheduledTask -TaskName $spec.Name
    }
}

function Stop-OwnedTasks($Config) {
    foreach ($name in @($Config.TunnelTask,$Config.CuaTask)) {
        $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
        if ($task) { Stop-ScheduledTask -TaskName $name }
    }
    Start-Sleep -Seconds 1
}

function Get-Config {
    if (-not (Test-Path -LiteralPath $script:ConfigPath)) { throw "尚未找到安装配置：$script:ConfigPath" }
    return Get-Content -LiteralPath $script:ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Check-Desktop($Config) {
    foreach ($name in @($Config.CuaTask,$Config.TunnelTask)) {
        $task = Get-ScheduledTask -TaskName $name -ErrorAction Stop
        Write-Host ("{0}: {1}" -f $name,$task.State)
        if ($task.State -ne 'Running') { throw "任务尚未运行：$name" }
    }
    Invoke-Native $Config.DriverPath @('status')
    $result = Invoke-Vps $Config 'check'
    Write-Host $result.status
    Write-Host '检查通过：CUA、后台登录任务、VPS 回连均正常。' -ForegroundColor Green
}

function Install-Desktop {
    $previous = if (Test-Path -LiteralPath $script:ConfigPath) { Get-Config } else { $null }
    $changed = $previous -and (($VpsHost -and $VpsHost -ne $previous.VpsHost) -or ($VpsUser -and $VpsUser -ne $previous.VpsUser) -or ($DeviceName -and $DeviceName -ne $previous.DeviceName))
    if ($changed -and $previous.Phase -eq 'uninstalled') {
        $backup = Join-Path $InstallDirectory ('.Rethos-temp\removed-' + (Get-Date -Format yyyyMMdd-HHmmss))
        New-Item -ItemType Directory -Force $backup | Out-Null
        Copy-Item -LiteralPath $script:ConfigPath -Destination (Join-Path $backup 'desktop.json')
        $previous = $null
    }
    if ($previous) {
        $config = $previous
        if (($VpsHost -and $VpsHost -ne $config.VpsHost) -or ($VpsUser -and $VpsUser -ne $config.VpsUser) -or ($DeviceName -and $DeviceName -ne $config.DeviceName)) { throw '迁移 VPS 或更改电脑名称前，请先运行 Uninstall.cmd。' }
        Write-Host "更新现有连接：$($config.DeviceName) -> $($config.VpsHost)"
    } else {
        $defaultDevice = ($env:COMPUTERNAME.ToLower() -replace '[^a-z0-9-]','-')
        if ($defaultDevice -notmatch '^[a-z]') { $defaultDevice = 'pc-' + $defaultDevice }
        if ($defaultDevice.Length -gt 24) { $defaultDevice = $defaultDevice.Substring(0,24) }
        $config = [pscustomobject]@{
            VpsHost=(Read-Setting 'VPS 地址' $VpsHost ''); VpsUser=(Read-Setting 'VPS SSH 用户名' $VpsUser '');
            VpsPort=$VpsPort; DeviceName=(Read-Setting '电脑名称' $DeviceName $defaultDevice); ReversePort=$ReversePort;
            LocalSshPort=$LocalSshPort; Container=$Container; ClientId=[guid]::NewGuid().ToString();
            DriverPath=''; DriverOwned=$true; AuthorizedKeysFile=''; WindowsHostKey='';
            TunnelKey=(Join-Path $InstallDirectory 'keys\tunnel'); KnownHostsFile=(Join-Path $InstallDirectory 'keys\known_hosts');
            CuaTask=''; TunnelTask=''; Remote=$null; Phase='preparing'; UserSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        }
        if ($script:InteractiveInstall -and $VpsPort -eq 22) { $config.VpsPort = [int](Read-Setting 'VPS SSH 端口' '' '22') }
        $config.CuaTask = 'Rethos-CUA-' + $config.DeviceName
        $config.TunnelTask = 'Rethos-Tunnel-' + $config.DeviceName
    }
    Assert-Settings $config
    if (-not $previous -and (Get-ScheduledTask -TaskName 'cua-driver-serve' -ErrorAction SilentlyContinue)) {
        throw '检测到已有独立 CUA 登录任务 cua-driver-serve。请先停用原任务并结束原 CUA，再运行本安装向导接管后台启动。'
    }
    Protect-Directory $InstallDirectory
    Protect-Directory (Join-Path $InstallDirectory 'keys')
    if ($previous) {
        $backup = Join-Path $InstallDirectory ('.Rethos-temp\backup-' + (Get-Date -Format yyyyMMdd-HHmmss))
        New-Item -ItemType Directory -Force $backup | Out-Null
        Copy-Item -LiteralPath $script:ConfigPath -Destination (Join-Path $backup 'desktop.json')
        foreach ($name in @($config.CuaTask,$config.TunnelTask)) {
            if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) { Export-ScheduledTask -TaskName $name | Set-Content -LiteralPath (Join-Path $backup ($name + '.xml')) -Encoding Unicode }
        }
    }
    Save-Config $config
    Write-Host '[1/6] 配置 Windows OpenSSH'
    Ensure-OpenSsh $config
    Save-Config $config
    Write-Host '[2/6] 安装并验证 CUA'
    Install-Cua $config
    Save-Config $config
    Write-Host '[3/6] 配置 VPS 密钥和连接（首次连接按 SSH 提示确认指纹并登录）'
    if (-not (Test-Path -LiteralPath $config.TunnelKey)) {
        $keyArgs = @('-q','-t','ed25519','-N','','-f',$config.TunnelKey)
        Invoke-Native (Get-SshExe 'ssh-keygen.exe') $keyArgs
    }
    $config.Remote = Invoke-Vps $config 'prepare' -Bootstrap
    $config.ReversePort = $config.Remote.reversePort
    Save-Config $config
    Write-Host '[4/6] 安装后台启动器和受限 CUA 回连入口'
    Stop-OwnedTasks $config
    foreach ($file in @('Start-RethosTunnel.ps1','BackgroundLauncher.cs','Invoke-CuaBridge.ps1')) {
        $source = Join-Path $script:PackageDirectory $file
        $destination = Join-Path $InstallDirectory $file
        if ([IO.Path]::GetFullPath($source) -ne [IO.Path]::GetFullPath($destination)) { Copy-Item -LiteralPath $source -Destination $destination -Force }
    }
    Set-WindowsAuthorization $config $config.Remote.windowsKey
    Install-Tasks $config
    $config.Phase = 'connecting'
    Save-Config $config
    Write-Host '[5/6] 验证 CUA 与 VPS 回连'
    $connected = $false
    foreach ($attempt in 1..12) {
        Start-Sleep -Seconds 3
        try { $null = Invoke-Vps $config 'check'; $connected = $true; break }
        catch { if ($attempt -eq 12) { throw }; Write-Host '等待后台连接建立…' }
    }
    if (-not $connected) { throw '桌面连接尚未建立，请运行 Check.cmd 查看。' }
    $mcp = @{ mcpServers=@{ $config.Remote.mcpName=$config.Remote.mcp } }
    Write-Utf8 (Join-Path $InstallDirectory 'mcp-import.json') ($mcp | ConvertTo-Json -Depth 8)
    Write-Host '[6/6] 注册 Rethos MCP'
    if (-not $NoRegisterMcp -and $config.Remote.container) {
        $registration = Invoke-Vps $config 'register'
        Write-Host "已注册：$($registration.name)"
    } else { Write-Host "MCP 配置已保存：$InstallDirectory\mcp-import.json" }
    $config.Phase = 'complete'
    Save-Config $config
    Check-Desktop $config
    Write-Host "安装完成。Rethos 中的电脑连接：$($config.Remote.mcpName)，反向端口：$($config.ReversePort)。" -ForegroundColor Green
    Write-Host "在目标机器人的工具设置中选择 $($config.Remote.mcpName)，即可使用此电脑。"
}

function Uninstall-Desktop {
    $config = Get-Config
    $null = Invoke-Vps $config 'remove'
    Stop-OwnedTasks $config
    foreach ($name in @($config.CuaTask,$config.TunnelTask)) {
        if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $name -Confirm:$false }
    }
    Set-WindowsAuthorization $config '' -Remove
    $config.Phase = 'uninstalled'
    Save-Config $config
    Write-Host '连接已卸载：登录任务、双方授权及对应 MCP 已移除。安装文件、日志和 OpenSSH 服务保留。' -ForegroundColor Green
}

if ($LibraryOnly) { return }
try {
    if (-not [Environment]::Is64BitProcess -or $env:PROCESSOR_ARCHITECTURE -ne 'AMD64') { throw '请在 Windows 10/11 x64 的 64 位 PowerShell 中运行。' }
    Ensure-Elevation
    switch ($Action) {
        'Install' { Install-Desktop }
        'Check' { Check-Desktop (Get-Config) }
        'Uninstall' { Uninstall-Desktop }
    }
    if ($ExpectedUserSid) { Read-Host '按回车关闭此窗口' | Out-Null }
} catch {
    Write-Host ("操作未完成：" + $_.Exception.Message) -ForegroundColor Red
    Write-Host "安装记录：$script:ConfigPath；隧道日志：$InstallDirectory\logs\desktop-tunnel.log。修正后可重新运行。"
    if ($ExpectedUserSid) { Read-Host '按回车关闭此窗口' | Out-Null }
    exit 1
}
