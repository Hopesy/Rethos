# Rethos 桌面连接

本机运行独立 `cua-driver` 和 OpenSSH Server。`Start-RethosTunnel.ps1` 建立出站 SSH，将 VPS 的 `127.0.0.1:22222` 转发至本机 SSH 回环端口。断线后按 10、20、40、60 秒逐步重试，连接持续至少一分钟后恢复 10 秒间隔；同一桌面会话通过互斥锁保持一个实例。

为通道使用独立密钥，在 VPS 的 `authorized_keys` 设置 `restrict,port-forwarding,permitlisten="127.0.0.1:22222"`。首次连接校验并记录 VPS 主机密钥。VPS 通过核验过的 Windows 主机密钥连接这个反向端口。

脚本适合由当前 Windows 用户的登录计划任务运行，传入 `-VpsHost <VPS地址> -VpsUser <SSH用户>`，PowerShell 使用 `-WindowStyle Hidden`。同一用户登录时，独立 CUA daemon 运行于交互桌面；任务应设置 `MultipleInstances=IgnoreNew`。

SSH 子进程使用 `CreateNoWindow` 后台启动，标准输出和错误输出写入 `%LOCALAPPDATA%\Rethos\logs\desktop-tunnel.log`。日志超过 1 MiB 后保留一份 `.1` 备份，可通过 `-LogDirectory` 指定目录。连接失败时查看该日志中的退出原因和重试时间。

Docker 中的 MCP 经专门密钥 SSH 到 VPS 主机。该密钥的 `authorized_keys` 条目使用 `restrict,command="/home/zhouhl/rethos-desktop/cua-driver-desktop"`，固定启动桌面 MCP 转发脚本。容器凭据保存在数据卷内，权限 0600。外层 SSH 和反向通道分别使用独立密钥，转发端口只监听 VPS 回环地址。

部署后的配置和验收结果记录在 [VPS 部署维护文档](../../docs/rethos-vps.md)。
