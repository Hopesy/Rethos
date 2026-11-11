# Rethos 安装包发布与维护

从 0.1.156 起，Windows x64 与 Android 8.0+ 共用 `package.json` 版本和 `v<版本>` Release。详细发布结果记录于[客户端发布历史](histories/client-releases.md)。

## 用户下载与安装

- [Windows 安装程序](https://github.com/Hopesy/Rethos/releases/latest/download/Rethos-setup.exe)
- [Android APK](https://github.com/Hopesy/Rethos/releases/latest/download/Rethos-Android.apk)
- [最新统一发布页](https://github.com/Hopesy/Rethos/releases/latest)

Windows 运行 `Rethos-setup.exe`，从开始菜单打开 Rethos。Android 下载 `Rethos-Android.apk` 覆盖安装，沿用原签名和应用 ID，保留登录数据。Windows 当前为未签名构建，SmartScreen 可能显示未知发布者提示。

公开上传 5 个发布文件：两个安装包、`Rethos-setup.exe.blockmap`、`latest.yml` 和 `SHA256SUMS.txt`。GitHub 另提供两个源码归档。`.blockmap` 和 `latest.yml` 由 Windows 自动更新使用；详细构建信息、Android 签名报告与 Windows 便携 ZIP 保留在该次 Actions artifact。

```powershell
Get-FileHash .\Rethos-setup.exe -Algorithm SHA256
Get-FileHash .\Rethos-Android.apk -Algorithm SHA256
```

## 联合发布

运行 **Rethos client release**（`release-clients.yml`），选择 ref，并按需要勾选 `publish`。入口先把 ref 解析为固定提交，再分别构建两端；全部验收通过后合并资产、核对版本和来源，并公开同一个 Release。

```sh
gh workflow run release-clients.yml --repo Hopesy/Rethos --ref main -f publish=true
gh run list --repo Hopesy/Rethos --workflow release-clients.yml --limit 5
```

Windows 继续验证浏览器、独立服务端、NSIS 安装后桌面启动和更新摘要。Android 继续执行单元测试、Lint、模拟器真实触摸验收和正式签名检查。公开前逐个核对 GitHub 返回的资产 SHA256。

单独运行 `package-win.yml` 或 `package-android.yml` 可构建候选包并保存 Actions artifact；联合入口负责公开版本。已公开的版本保持原样，后续修改提升版本号。

## 更新版本

1. 修改 `package.json` 版本并新增 `docs/releases/v<版本>.md`，提交代码。
2. Android Gradle 自动读取此版本，versionCode 为 major × 1000000 + minor × 1000 + patch。minor 与 patch 范围为 0–999，major 范围为 0–2000。
3. 运行联合发布流程，核对两端版本、安装包和 SHA256。
4. 更新 VPS 镜像并检查在线网页。网页下载按钮与二维码共用 Android Latest 固定链接。

Windows 自动更新仍从同一仓库读取 `latest.yml`。Android 通过原签名覆盖安装；卸载会删除应用登录数据。

## 其他构建入口

| 产物 | 入口 | 用途 |
| --- | --- | --- |
| Windows + Android | `release-clients.yml` | 统一版本、联合验收与公开 Release |
| Windows / Android 单端 | `package-win.yml` / `package-android.yml` | 候选包和隔离验收 |
| Linux DEB、AppImage | `package-linux.yml` | 按平台验收 |
| VPS Docker | `docker.yml` | `ghcr.io/hopesy/rethos`，AMD64 / ARM64 |
| npm | `npm-package.yml` | 服务端和 CLI，按包所有权配置 |
| macOS 等全平台 | `release.yml` | 需先完成签名配置和各平台验收 |

```sh
pnpm install --frozen-lockfile
pnpm package:win
```

`release/` 保存安装包构建输出；测试过程与证据位于 `.Rethos-temp/`。第三方资源的固定版本和许可检查继续由现有打包脚本执行。
