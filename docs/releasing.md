# Rethos 安装包发布与维护

当前桌面发布目标为 **Windows x64**。VPS 的 Docker 镜像由独立工作流发布；手机继续通过 HTTPS 网页访问。macOS 打包留到后续配置。

## 已发布版本

2026-11-09 已发布 [Rethos 0.1.149](https://github.com/Hopesy/Rethos/releases/tag/v0.1.149)，[GitHub Actions 42551723554](https://github.com/Hopesy/Rethos/actions/runs/42551723554) 的构建与发布作业均通过，来源提交为 `b9f8023c44e39ce75e68270e64a91520c57c5ff5`。

- 116 项更新文件、鉴权、桌面会话与启动相关回归测试通过。
- 内置浏览器、独立服务端、安装后桌面渲染、preload 和写操作鉴权通过实际运行验证。
- 7 个 Release 文件的上传摘要与本地构建字节一致，固定安装包下载地址经匿名访问返回 HTTP 200。
- Windows 安装程序为 267,606,661 字节，便携 ZIP 为 371,460,148 字节；当前签名状态为未签名。

此次验收修复了桌面鉴权请求头在产品改名后的不一致；鉴权使用稳定的内部协议标识。测试用户目录包含 Windows 标准文件夹，桌面验收结果同时写入独立 JSON，方便诊断 GUI 进程的启动问题。

## 用户下载与安装

- [Windows 安装程序（固定下载地址）](https://github.com/Hopesy/Rethos/releases/latest/download/Rethos-setup.exe)
- [全部版本与便携 ZIP](https://github.com/Hopesy/Rethos/releases)

运行 `Rethos-<版本>-setup.exe` 后，从开始菜单打开 Rethos。也可解压 `Rethos-<版本>-x64.zip`，运行其中的 `Rethos.exe`。当前 Windows 版本未配置代码签名，Windows SmartScreen 可能显示未知发布者提示；下载来源和校验值均在 Release 页面公开。

PowerShell 校验下载文件：

```powershell
Get-FileHash .\Rethos-setup.exe -Algorithm SHA256
```

将结果与该版本的 `SHA256SUMS-windows-x64.txt` 对照。`BUILD-INFO.json` 记录版本、源码提交、架构、签名状态以及各文件的 SHA256。

桌面客户端包含本机服务和桌面集成，用户数据沿用 `~/.openmausbot`。已有 VPS 的日常使用入口继续见 [VPS 部署文档](rethos-vps.md)，本机独立 CUA 与反向 SSH 的维护方式见 [桌面接入](../deploy/desktop/README.md)。

## 一键 Windows 发布

打开 [Actions → Rethos Windows installer](https://github.com/Hopesy/Rethos/actions/workflows/package-win.yml)，选择 **Run workflow**：

1. 选择 `main`，或在 `ref` 填写要打包的提交、标签或分支。
2. 默认仅构建并保留 Actions artifact，适合候选版本验证。
3. 勾选 `publish`，通过所有验证后发布到本仓库 GitHub Releases。

命令行等价入口：

```sh
# 构建验证，保存 Actions artifact 30 天
gh workflow run package-win.yml --repo Hopesy/Rethos --ref main

# 构建、验证并发布
gh workflow run package-win.yml --repo Hopesy/Rethos --ref main -f publish=true

# 查看当前运行
gh run list --repo Hopesy/Rethos --workflow package-win.yml --limit 5
```

工作流在 Windows runner 完成以下步骤：

- 按锁文件安装依赖并清理旧输出，编译前端、服务端、桌面资源和原生依赖。
- 构建 NSIS 安装程序及 ZIP，验证内置浏览器和独立服务端运行。
- 在临时用户数据目录实际安装，启动安装后的 `Rethos.exe`，检查桌面渲染、preload、服务健康和桌面访问权限。
- 检查更新地址为 `Hopesy/Rethos`，验证 `latest.yml` 的版本、路径、文件大小和 SHA512。
- 汇总安装包、ZIP、差分更新文件、固定下载名、SHA256 和构建来源。
- 发布作业仅在构建成功且勾选 `publish` 时执行：先上传草稿、对照 GitHub 返回的文件摘要，随后公开 Release。

构建作业使用只读权限，发布作业使用当前仓库的 `contents: write`。Windows 发布使用工作流内置的 `GITHUB_TOKEN`。测试数据和诊断位于 `.Rethos-temp/desktop-release/`，失败时上传日志。

## 更新版本

1. 修改并提交 `package.json` 中的版本，例如从 `0.1.149` 提升到 `0.1.150`。也可通过 **Prepare next release** 创建版本 PR。
2. 推送并运行 Windows 发布工作流。已公开的同版本 Release 会受到保护，发布修复应提升版本号。
3. 确认 Release 中同时存在安装程序、`.exe.blockmap` 和 `latest.yml`。固定下载名 `Rethos-setup.exe` 是同一安装程序的副本。
4. 已安装桌面端从同一仓库读取更新；也可下载新安装程序进行覆盖升级。

卸载使用 Windows **设置 → 应用 → 已安装的应用 → Rethos**。便携 ZIP 的程序目录可在退出后删除。用户数据单独保留；涉及删除数据时先备份。

首次发布的工作流验证覆盖安装与启动、更新文件完整性。两个正式版本之间的实际自动升级将在下一版本发布时验证。

## 产物与工作流

| 产物 | 入口 | 用途 |
| --- | --- | --- |
| Windows 安装程序、便携 ZIP、更新文件 | `package-win.yml` | Windows 桌面安装和升级；支持直接发布 Release |
| Ubuntu DEB、AppImage | `package-linux.yml` | 保留独立构建入口，按该平台工作流单独验收 |
| VPS Docker 镜像 | `docker.yml` | `ghcr.io/hopesy/rethos`，AMD64 / ARM64 |
| npm `.tgz` | `npm-package.yml`、`pnpm package:npm` | 服务端与 CLI；公共 npm 发布需配置包所有权和发布认证 |
| 全平台 Release | `release.yml` | 手动入口，需先具备 macOS 签名及 notarization 凭据，并完成各平台验收 |

Windows 发布流程独立执行，版本修改通过手动发布入口推进。全平台 Release 的自动版本触发已关闭，避免版本提交立即启动 macOS 签名任务。Docker 和 npm 的发布命令分别按对应工作流执行。

## 本地构建

```sh
pnpm install --frozen-lockfile
pnpm package:win
```

`release/` 保存构建输出。安装后的桌面验收脚本仅在 GitHub Actions 的临时 Windows runner 执行。源代码中的 `after-pack.mjs` 继续检查浏览器、cloudflared、数据引擎及许可文件；第三方资源来源和固定版本保留在相应准备脚本中。
