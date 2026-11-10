# Windows 桌面一键安装验证

日期：2026-11-10。交付脚本位于 `deploy/desktop`，复用说明见其中的 README。发行包 `Rethos-Desktop-Setup-1.0.0.zip` 包含 11 个安装/维护文件及官方 CUA 0.46.1 压缩包，另附每个文件的 SHA-256 manifest。

## 已完成

- Windows PowerShell 5.1 实际运行参数转义测试，覆盖空参数、空格、引号、反斜杠、中文和 shell 字符；实际调用 ssh-keygen 生成专用密钥，实际编译 WinExe 后台启动器。
- 在临时安装目录运行完整 Install / Update / Check / Uninstall 流程。操作系统服务、计划任务和 VPS 操作使用隔离替身；验证两项后台登录任务、配置保存、重复安装身份和端口保持、授权幂等、卸载保留其他密钥。
- 实际解压发行包中的 CUA，校验固定压缩包 SHA-256 与 Cua AI Authenticode 签名；首次及重复安装验证通过，执行版本为 0.46.1。
- WSL Linux 下 4 项测试通过：真实生成 SSH 密钥、用 ssh -G 解析回连配置、重复准备、端口冲突、电脑身份冲突、保留其他授权、移除、状态检查及 Base64 初始化协议。
- 按仓库规范启动独立 `control-omb.ts launch` fixture，通过真实 Rethos API 注册 MCP、重复注册、连接工具发现及移除。每次操作后校验临时管理凭据已撤销且凭据文件已删除。
- 发行 ZIP 逐文件核验 manifest、12 个内容文件的摘要和字节数、官方 CUA 内嵌压缩包及文件清单。安装配置与本机凭据均留在运行数据目录，打包采用明确文件清单。
- 当前笔记本的 `Rethos-Desktop-Tunnel` 使用 WinExe 启动器运行；实际停止/启动验证可回收整条子进程链，VPS 回连 CUA 0.46.1 成功，当前任务为 Running。

## 后续现场验收

首次在新 Windows 系统启用 OpenSSH 可选功能、管理员登录任务创建、整机重启后启动及新 VPS Docker 网络连接，需要在目标电脑与目标 VPS 完成。安装结束会自动检查 CUA、登录任务和 VPS 回连，并测试自动注册的 MCP；可重复运行 Check.cmd。

所有测试过程脚本与记录位于 `.Rethos-temp/desktop-installer`；打包暂存位于 `.Rethos-temp/desktop-package-*`。本次测试使用隔离 fixture 进行应用写入。

发行 ZIP SHA-256：`98da86fed34bcf0de6dbf8474f9f8a41e3f280fbe9e90ec4fc4e85191380c65a`
