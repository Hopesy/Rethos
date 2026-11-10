# Rethos 桌面连接

## 新电脑一键安装

适用于 Windows 10/11 x64。Windows 安装独立 CUA、OpenSSH 和后台隧道，Rethos 服务运行在 VPS。

1. 解压完整安装包，在日常使用桌面的 Windows 账户下双击 **Install.cmd**，接受管理员权限提示。
2. 填写 VPS 地址、SSH 用户名、电脑名称和 SSH 端口（默认 22）。同一 VPS 上每台电脑使用不同名称，例如 `office-pc`、`home-laptop`。
3. 按 SSH 提示核对主机指纹并输入登录密码。安装器自动生成后续连接密钥、分配反向端口、配置 CUA 和两个后台登录任务，并注册 VPS 上的 MCP。
4. 看到“检查通过”后，在 Rethos 目标机器人的工具设置中选择 `pc-电脑名称`。

VPS 需要已有 Rethos Docker 服务、Python 3 和 OpenSSH；SSH 用户需要使用 Docker 的权限。默认识别 Compose 服务名为 `rethos` 的唯一容器。Windows 账户需要管理员权限以安装 OpenSSH 和桌面任务。首次启用 Windows 可选功能可能需要联网或重启；提示重启时，重启后再次运行 Install.cmd 即可接续。

完整安装包内含官方 CUA 0.46.1 压缩包；安装时核对 SHA-256 和 Cua AI 数字签名。源码目录运行时会自动下载同一个固定版本。参考 [CUA 官方发行版](https://github.com/trycua/cua/releases/tag/cua-driver-rs-v0.46.1)。

### 日常使用

| 入口 | 用途 |
| --- | --- |
| `Install.cmd` | 首次安装；失败修正后重新执行会接续配置 |
| `Check.cmd` | 检查 CUA、两个后台任务和 VPS 回连 |
| `Update.cmd` | 使用新安装包更新脚本和固定 CUA 版本，保留电脑身份与端口 |
| `Uninstall.cmd` | 移除本连接的任务、双方授权和 MCP；保留安装文件、日志、OpenSSH 服务 |

重启后，登录这个 Windows 账户时 CUA 和隧道自动在后台启动，无终端窗口。隧道断线会重连。电脑需要保持开机、联网并登录桌面；睡眠、关机期间连接暂停。

安装器的交互窗口用于填写配置和 SSH 登录，安装结束后可以关闭。运行数据位于 `%LOCALAPPDATA%\RethosDesktop`：`desktop.json` 保存配置，`logs\desktop-tunnel.log` 保存连接日志，`mcp-import.json` 提供手动导入配置。后台启动器错误记录在 `%LOCALAPPDATA%\Rethos\logs\background-launcher.log`。

每次更新前，原配置和任务 XML 备份到安装目录的 `.Rethos-temp`。保留解压后的安装包，后续使用其中的 Check / Update / Uninstall。卸载需要连接 VPS 完成远端清理。VPS 端文件位于 `~/.rethos-desktop/devices/电脑名称`，容器连接密钥位于 `/data/.ssh/rethos-desktop/电脑名称`。

### 自定义部署

使用 SSH 私钥、不同容器或自定义端口时，在管理员 PowerShell 执行：

```powershell
.\Setup-Desktop.ps1 -VpsHost vps.example.com -VpsUser deploy -DeviceName office-pc `
  -VpsPort 22 -IdentityFile "$env:USERPROFILE\.ssh\id_ed25519" -Container rethos-app
```

可选 `-ReversePort 22225`、`-LocalSshPort 2222`、`-DriverPath 'C:\Tools\cua-driver.exe'`。VPS 原生安装可传 `-Container none`，安装结束后把 `mcp-import.json` 导入该 VPS 的 Rethos。`-NoRegisterMcp` 保留导入文件，跳过自动注册。

已有独立 `cua-driver-serve` 登录任务的电脑，请先停用原任务并结束原 CUA，再由本安装器接管。新装 OpenSSH 监听本机回环地址；已有 sshd 配置继续沿用，`LocalSshPort` 要匹配实际端口。每台电脑分别运行安装器生成自己的密钥与身份，复用时复制发行包即可。

VPS SSH 需允许反向转发，且 Docker 网关能访问 VPS 的 SSH 端口。安装器为每台电脑添加带固定命令的密钥授权，反向端口监听 `127.0.0.1`，首次登记后固定核验双方主机密钥。MCP 注册使用一小时管理凭据，执行结束即撤销并删除临时文件。

## 手工部署说明

本机运行独立 `cua-driver` 和 OpenSSH Server。`Start-RethosTunnel.ps1` 建立出站 SSH，将 VPS 的 `127.0.0.1:22222` 转发至本机 SSH 回环端口。断线后按 10、20、40、60 秒逐步重试，连接持续至少一分钟后恢复 10 秒间隔；同一桌面会话通过互斥锁保持一个实例。

为通道使用独立密钥，在 VPS 的 `authorized_keys` 设置 `restrict,port-forwarding,permitlisten="127.0.0.1:22222"`。首次连接校验并记录 VPS 主机密钥。VPS 通过核验过的 Windows 主机密钥连接这个反向端口。

脚本由当前 Windows 用户的登录计划任务运行，传入 `-VpsHost <VPS地址> -VpsUser <SSH用户>`。计划任务通过 `BackgroundLauncher.exe` 启动 PowerShell；该启动器使用 Windows GUI 子系统和 `CreateNoWindow`，避免 Windows Terminal 在登录时弹出黑窗口。启动器等待 PowerShell 结束并返回其退出码，通过 Windows Job Object 在任务停止时一并回收 PowerShell 和 SSH 子进程。同一用户登录时，独立 CUA daemon 运行于交互桌面；任务应设置 `MultipleInstances=IgnoreNew`。

将 `BackgroundLauncher.cs` 与隧道脚本一起复制到安装目录，使用 Windows 自带的 .NET Framework 编译器生成启动器：

```powershell
$localDir = Join-Path $env:USERPROFILE 'RethosDesktop'
& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:x64 /optimize+ "/out:$localDir\BackgroundLauncher.exe" "$localDir\BackgroundLauncher.cs"
if ($LASTEXITCODE -ne 0) { throw '后台启动器编译失败' }
```

任务的执行程序设为上述 EXE，第一个参数为 PowerShell 的完整路径，其后保留隧道脚本参数。注册步骤见 [桌面接入指南](../../docs/desktop-quickstart.md#4-首次连接电脑与-vps)。隧道运行日志沿用下方路径；启动器异常写入 `%LOCALAPPDATA%\Rethos\logs\background-launcher.log`。

SSH 子进程使用 `CreateNoWindow` 后台启动，标准输出和错误输出写入 `%LOCALAPPDATA%\Rethos\logs\desktop-tunnel.log`。日志超过 1 MiB 后保留一份 `.1` 备份，可通过 `-LogDirectory` 指定目录。连接失败时查看该日志中的退出原因和重试时间。

Docker 中的 MCP 经专门密钥 SSH 到 VPS 主机。该密钥的 `authorized_keys` 条目使用 `restrict,command="/home/zhouhl/rethos-desktop/cua-driver-desktop"`，固定启动桌面 MCP 转发脚本。容器凭据保存在数据卷内，权限 0600。外层 SSH 和反向通道分别使用独立密钥，转发端口只监听 VPS 回环地址。

部署后的配置和验收结果记录在 [VPS 部署维护文档](../../docs/rethos-vps.md)。
