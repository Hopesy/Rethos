param(
    [string]$CuaArchive,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\output\desktop-setup')
)
$ErrorActionPreference = 'Stop'
$version = '1.0.0'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$staging = Join-Path $repo ('.Rethos-temp\desktop-package-' + [guid]::NewGuid().ToString('N'))
$package = Join-Path $staging ('Rethos-Desktop-Setup-' + $version)
New-Item -ItemType Directory -Force $package,$OutputDirectory | Out-Null
$files = @('Install.cmd','Update.cmd','Check.cmd','Uninstall.cmd','Setup-Desktop.ps1','setup-vps.py','BackgroundLauncher.cs','Start-RethosTunnel.ps1','Invoke-CuaBridge.ps1','cua-release.json','README.md')
foreach ($name in $files) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $package $name) }
$readme = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'README.md') -Raw -Encoding UTF8) -split '## 手工部署说明',2
[IO.File]::WriteAllText((Join-Path $package 'README.md'), $readme[0].TrimEnd(), [Text.UTF8Encoding]::new($false))
if ($CuaArchive) {
    $release = Get-Content (Join-Path $PSScriptRoot 'cua-release.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ((Get-FileHash -LiteralPath $CuaArchive -Algorithm SHA256).Hash -ne $release.sha256) { throw 'CUA archive hash mismatch' }
    New-Item -ItemType Directory -Force (Join-Path $package 'vendor') | Out-Null
    Copy-Item -LiteralPath $CuaArchive -Destination (Join-Path $package ('vendor\cua-' + $release.version + '.zip'))
}
$manifest = [ordered]@{version=$version;files=@()}
foreach ($file in Get-ChildItem -LiteralPath $package -File -Recurse) {
    $manifest.files += @{path=$file.FullName.Substring($package.Length + 1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLower();bytes=$file.Length}
}
[IO.File]::WriteAllText((Join-Path $package 'manifest.json'), ($manifest | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
$zip = Join-Path $OutputDirectory ('Rethos-Desktop-Setup-' + $version + '.zip')
Compress-Archive -LiteralPath $package -DestinationPath $zip -Force
$hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLower()
[IO.File]::WriteAllText(($zip + '.sha256'), ($hash + '  ' + (Split-Path $zip -Leaf) + "`n"), [Text.UTF8Encoding]::new($false))
Write-Host ([IO.Path]::GetFullPath($zip))
Write-Host $hash
