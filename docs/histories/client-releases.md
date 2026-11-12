# 客户端发布记录

### Windows 与 Android 0.1.157

2026-11-12 已发布 [Rethos 0.1.157](https://github.com/Hopesy/Rethos/releases/tag/v0.1.157)，Windows 与 Android 均来自提交 `2cde7d971ad447aa5df4c7614a163d7bc72b7ac9`。本次精简高级设置说明，补齐条件设置，修复帮助浮层重叠及浏览器状态说明。

- [联合发布](https://github.com/Hopesy/Rethos/actions/runs/43201956413)通过，包含 Windows 实际安装启动、Android 模拟器验收及正式签名；[源码 CI](https://github.com/Hopesy/Rethos/actions/runs/43201954132)通过。
- 五个公开文件完整下载后，GitHub 摘要与 SHA256SUMS 逐项一致。Windows PE 产品和文件版本为 0.1.157；APK 为 0.1.157 / 1157，应用 ID 与原签名证书保持一致。两个 Latest 下载入口均已核对。
- Windows 安装程序为 267670422 字节，SHA256 `b6edba1493ff53d17b78c89e045e13d00652f735f1a0cad96760ba60a18885c8`；APK 为 2006675 字节，SHA256 `0ea69e4b6128d89499a1611bfe929c5a3e134ab66dc542a8e67560546fd85431`。
- [双架构镜像构建与验收](https://github.com/Hopesy/Rethos/actions/runs/43201954029)通过，VPS 已固定镜像摘要 `sha256:adfe95607b2c8e061532abc752db41c60fb9b326813930a58c5fc0ce2ac6d15d`。公网版本、新帮助组件与说明资源核对通过，原 Token、Bot 模型与工具白名单、模型列表和桌面 MCP 配置保留。
- 发布前 351 项设置及默认 Bot 相关测试通过，桌面与 390px 帮助交互在隔离浏览器验证。发布证据位于 `.Rethos-temp/release-0.1.157/`，界面复核证据见 `.Rethos-temp/settings-recheck-verification.json`。

### Windows 与 Android 0.1.156

2026-11-11 已发布 [Rethos 0.1.156](https://github.com/Hopesy/Rethos/releases/tag/v0.1.156)，两端来源提交均为 `3568771184cb7bee88b748747c7d6770ec6da534`。版本由 `package.json` 统一提供；联合发布等待两端验收完成，再将同一 Release 设置为 Latest。

- [联合构建与发布](https://github.com/Hopesy/Rethos/actions/runs/42999700293)通过，包含 Windows 实际安装与启动、Android 模拟器和签名验证；[最终源码 CI](https://github.com/Hopesy/Rethos/actions/runs/42999698536) 的 29 项检查通过。公开文件精简为两个安装包、Windows 更新索引和差分文件、合并校验表；GitHub 页面已实际核对两个安装入口。
- 五个公开文件已完整下载并逐项核对 GitHub 摘要和校验表。Windows PE 产品和文件版本均为 `0.1.156`；APK manifest 为 `0.1.156` / `1156`，应用 ID `cc.hopesy.rethos`，原签名证书验证通过。两端固定 Latest 下载入口均指向本版本。
- APK 为 2,006,675 字节，SHA256 `7644eca3f9eeb52f30af9a158ed71b2a35195c89febc0c1f45086e5069ce71d4`；Windows 安装程序为 267,664,502 字节，SHA256 `d379ea46e3ee2cd15cc7491176d8a44087862137592de7991eafd6d2bf13e72c`。
- Ego Lite 隔离实例覆盖简洁与完整界面的 12 组尺寸，390px 手机正文与表格宽度由原正文 268.4px 扩展到 342.4px；手机发送按钮为 44px，输入时隐藏通话触发按钮，添加菜单仍保留通话事件处理。实际发送、触摸消息菜单、草稿保留和页面溢出检查通过。
- [双架构镜像构建与验收](https://github.com/Hopesy/Rethos/actions/runs/42999698426)通过，VPS 已部署镜像摘要 `sha256:9182647b16646ecb508f8e2f6ad510540124986229fb78600d060c58be43c9c4`。公网版本及新版静态资源核对通过，原 Token、模型选择、模型列表和桌面 MCP 配置保留。
- 证据位于 `.Rethos-temp/release-0.1.156/`，关键文件为 `browser-matrix-final.json`、`browser-release.json`、`public-download-verification.json`、`public-android-verification.json`、`web-production.json` 和 `deployment.log`；[完成计划](../exec-plans/completed/unified-client-release.md)记录实现决定。

### Android 0.1.3 与手机响应式网页

2026-11-11 已发布 [Android 0.1.3](https://github.com/Hopesy/Rethos/releases/tag/android-v0.1.3)，来源提交 `b2b9eea5a0563be2842aa9cc7b3d2df08dd4eecd`。[Android 验证、签名与发布](https://github.com/Hopesy/Rethos/actions/runs/42985650191)和[双架构镜像验收](https://github.com/Hopesy/Rethos/actions/runs/42985614500)全部通过，Android 15 模拟器的 7 项测试通过。

- APK 版本为 0.1.3，versionCode 4，应用 ID 和签名证书沿用旧版，可直接覆盖安装。
- 公开 APK 已完整下载，核对摘要、apksigner 和 manifest 通过。文件为 2,006,699 字节，SHA256 `0292c03f2ad1d817829342466dd64738b9b5a8b5ecb5350cecc7456fd70c5410`。
- VPS 已同步部署手机响应式优化，下载按钮与二维码指向 0.1.3；浏览器确认下载弹窗，原 Token、模型及桌面 MCP 配置核对一致。
- Windows Latest 继续指向 0.1.155。发布与部署证据位于 `.Rethos-temp/android-0.1.3/`。

### Windows 0.1.155 与 Android 0.1.2

2026-11-11 已发布 [Windows 0.1.155](https://github.com/Hopesy/Rethos/releases/tag/v0.1.155) 和 [Android 0.1.2](https://github.com/Hopesy/Rethos/releases/tag/android-v0.1.2)，源码提交均为 `264eaf3b105fac205d07ca0b8b9cf61e63bbfa88`。

- [Windows 构建与安装验收](https://github.com/Hopesy/Rethos/actions/runs/42962731665)、[Android 模拟器与签名发布](https://github.com/Hopesy/Rethos/actions/runs/42962738440)、[Docker 双架构构建](https://github.com/Hopesy/Rethos/actions/runs/42962728454)全部通过。
- [发布提交的主分支 CI](https://github.com/Hopesy/Rethos/actions/runs/42962728474) 29 项通过；此前 [CI 修复全量验证](https://github.com/Hopesy/Rethos/actions/runs/42957417956)覆盖三种系统的 20 个分片，40 项检查通过。
- 公开 Windows 安装程序完整下载后，SHA256 与发布元数据一致；PE 版本资源为 `0.1.155`。Latest 下载入口已指向该版本。
- 公开 APK 已匿名下载并通过 apksigner 与 manifest 复核：版本 `0.1.2`、versionCode `3`，签名证书与 0.1.1 相同。
- VPS 已同步新版网页，Android 下载按钮与二维码指向 0.1.2；原 Token、模型、桌面 MCP 配置与 SSH 隧道核对通过。发布及部署证据保存在 `.Rethos-temp/release-0.1.155-final/`。

### Android 0.1.1 与 VPS 0.1.155

2026-11-10 已发布 [Rethos Android 0.1.1](https://github.com/Hopesy/Rethos/releases/tag/android-v0.1.1)，源码提交 `ec445afe74c0249fa497d8ed7f504404f4f9726d`。[Android 构建与发布](https://github.com/Hopesy/Rethos/actions/runs/42804470560) 的模拟器验证、签名和公开发布全部通过。公开 APK 已匿名下载并重新验证签名、应用 ID、版本号和摘要，支持使用原签名覆盖安装。

- APK 为 1,964,498 字节，SHA-256：`04d6bd3caabc4916aaa60352f1be0429daddd776aff0b70f42e9b2cb7c8cff6c`。
- 登录页和顶部菜单提供原生相机扫码。电脑网页在“设置 → 通用 → 手机扫码登录”生成登录二维码。
- VPS 已部署 0.1.155，网页下载按钮与二维码均指向公开 0.1.1 APK。[双架构镜像构建与验收](https://github.com/Hopesy/Rethos/actions/runs/42804448567) 全部通过。
- Windows 的 Latest 发布入口继续指向 0.1.154；桌面连接安装器源码见 `deploy/desktop`。

### Android 0.1.0

2026-11-10 已发布 [Rethos Android 0.1.0](https://github.com/Hopesy/Rethos/releases/tag/android-v0.1.0)，源码提交为 `cae09ac35f00c281ef11f4eb31c59b47ef657ac7`。[构建与发布](https://github.com/Hopesy/Rethos/actions/runs/42752753773) 的验证、签名与发布任务全部通过，APK 大小约 1.61 MiB，详见 [验证记录](../releases/android-v0.1.0-verification.md)。

Android 使用 Kotlin + WebView，默认连接 `https://rethos.hopesy.cc`。安装后输入现有 Token 登录。后续使用相同签名和递增版本号覆盖安装。运行 `package-android.yml` 并勾选 `publish` 可自动发布；签名配置、版本号修改与使用步骤见 [Android 文档](../../android/README.md)。Android 标签独立使用 `android-v<版本>`，发布时保留 Windows 的 Latest 入口。

### 0.1.151

2026-11-10 北京时间 00:55 已发布 [Rethos 0.1.151](https://github.com/Hopesy/Rethos/releases/tag/v0.1.151)，源码提交为 `f959859ccdde1062de99bd316f59c4fa5a125892`。本次统一 Token 登录，简化登录页并增加手机扫码登录与访问 Token 管理，详见[版本说明](../releases/v0.1.151.md)。

- [Windows 构建与发布](https://github.com/Hopesy/Rethos/actions/runs/42657353977)通过：登录回归、NSIS 安装、安装后桌面启动、内置浏览器、服务端与更新元数据均完成验证。
- Release 的 7 个文件已公开，构建信息中的 SHA256 与 GitHub 上传摘要逐项一致；安装程序为 267,651,004 字节，便携 ZIP 为 371,533,907 字节。当前签名状态为未签名。
- [Docker 版本构建与发布](https://github.com/Hopesy/Rethos/actions/runs/42658410982)通过，AMD64 与 ARM64 的源码标签均为上述提交。
- `ghcr.io/hopesy/rethos:v0.1.151`、`latest` 与 VPS 正在运行的镜像均对应多架构摘要 `sha256:8c778da934e72f294abad7f260f225a01d678004423051a040f11b7eaa404229`。
- VPS 已更新；当前入口为 [rethos.hopesy.cc](https://rethos.hopesy.cc)。公网版本、登录页资源与管理员 Token 鉴权已核对，登录和二维码交互在隔离服务完成验证。

### 0.1.150

2026-11-09 已发布 [Rethos 0.1.150](https://github.com/Hopesy/Rethos/releases/tag/v0.1.150)，源码提交为 `593fcab46b444c0d35ac262165b0dfc033194c9e`。本次包含新图标、简化配对、自定义模型设置、中文与设置页优化，以及官方云和组织空间入口清理，详见[版本说明](../releases/v0.1.150.md)。

- [Windows 构建与发布](https://github.com/Hopesy/Rethos/actions/runs/42611670157)通过：NSIS 安装、安装后桌面启动、preload、鉴权、内置浏览器和更新元数据均完成验证。
- Release 的 7 个文件已上传；构建信息中的 SHA256 与 GitHub 上传摘要一致。安装程序为 267,642,695 字节，便携 ZIP 为 371,523,136 字节；沿用当前未签名状态。
- [Docker 构建与发布](https://github.com/Hopesy/Rethos/actions/runs/42611869265)通过：AMD64、ARM64 均经过启动、OSS、浏览器、HTTPS 配对和持久化验证。
- 镜像 `ghcr.io/hopesy/rethos:v0.1.150` 与 `latest` 指向相同的多架构摘要：`sha256:24a30bc0690f1eddb8720d14434c90beedaffa3e794a0d4c83769995e3db693a`。

### 0.1.149

2026-11-09 已发布 [Rethos 0.1.149](https://github.com/Hopesy/Rethos/releases/tag/v0.1.149)，[GitHub Actions 42551723554](https://github.com/Hopesy/Rethos/actions/runs/42551723554) 的构建与发布作业均通过，来源提交为 `b9f8023c44e39ce75e68270e64a91520c57c5ff5`。

- 116 项更新文件、鉴权、桌面会话与启动相关回归测试通过。
- 内置浏览器、独立服务端、安装后桌面渲染、preload 和写操作鉴权通过实际运行验证。
- 7 个 Release 文件的上传摘要与本地构建字节一致，固定安装包下载地址经匿名访问返回 HTTP 200。
- Windows 安装程序为 267,606,661 字节，便携 ZIP 为 371,460,148 字节；当前签名状态为未签名。

此次验收修复了桌面鉴权请求头在产品改名后的不一致；鉴权使用稳定的内部协议标识。测试用户目录包含 Windows 标准文件夹，桌面验收结果同时写入独立 JSON，方便诊断 GUI 进程的启动问题。
