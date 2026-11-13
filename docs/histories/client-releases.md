# 客户端发布记录

### Windows 与 Android 0.1.160

2026-11-13 已发布 [Rethos 0.1.160](https://github.com/Hopesy/Rethos/releases/tag/v0.1.160)，两端和 VPS 均来自提交 `6bdd48a6684fb413ce78a28a74a0f6655cc0a7db`。共享 API 运行时每轮额度提高到 1,024 步和 10,000 次工具调用；MCP 响应帧保护按请求计数，正常工具搜索保持安静。

- [源码 CI](https://github.com/Hopesy/Rethos/actions/runs/43416075239) 的 29 项检查通过；[联合构建与发布](https://github.com/Hopesy/Rethos/actions/runs/43418833645)通过 Windows 实际安装启动、Android 模拟器及正式签名验证。原有 64 步的端到端断言已同步，长任务达到额度后的原地续接和停滞处理通过复核。
- 五个公开文件已完整下载，GitHub 摘要及 SHA256SUMS 逐项一致。Windows 内部版本为 0.1.160；APK 为 0.1.160 / 1160，原应用 ID 和签名证书验证通过；两个 Latest 下载入口均指向本版本。
- Windows 安装程序为 267679185 字节，SHA256 `1f7afa204cfe14e6d10ed4d3a93f7cf583dd10ac1a2789a5bdfccf84838ea00a`；APK 为 2006675 字节，SHA256 `b70c9d09442f1358c075409978bf57afcc45812991009dba0da4075c6a073f68`。
- [双架构镜像构建与验收](https://github.com/Hopesy/Rethos/actions/runs/43416075082)通过，VPS 固定镜像摘要 `sha256:2986093541332b13af5d7ece7ae42802209b8910c39bbc98330e162ea793e6ce`。运行中的服务包直接核验新版额度、按请求计数及重复提示移除；公网资源和原 Token、6 个 Bot 配置、1 个 MCP、2 个监控的计划与启用状态保留。
- 本地长任务相关回归 182 项通过，MCP 回归 115 项通过，发布预检 63 项通过。隔离服务完成 300 次工具调用，并在另一轮执行 225 次调用后正常取消；连续两轮搜索与调用 160 个工具目录的验收通过。证据位于 `.Rethos-temp/release-0.1.160/`、`.Rethos-temp/long-task-limits/` 和 `.Rethos-temp/tool-search-notice/`。

### Windows 与 Android 0.1.159

2026-11-13 已发布 [Rethos 0.1.159](https://github.com/Hopesy/Rethos/releases/tag/v0.1.159)，两端和 VPS 均来自提交 `8a5ea8d1f7f8013170aa2630bc9281dee2f1637c`。本次补齐默认主 Bot 全部可用工具与记忆规则，修复复制 Bot 能力限制、工具保存时序、迟到响应、外层保存、跨模式记忆草稿及保存期间继续输入的七项问题。

- [源码 CI](https://github.com/Hopesy/Rethos/actions/runs/43396037989) 的 29 项检查通过；[联合构建与发布](https://github.com/Hopesy/Rethos/actions/runs/43398573263)通过 Windows 实际安装启动、Android 7 项模拟器测试及正式签名验证。Android 首轮输入焦点错误在新的模拟器验收中通过。
- 五个公开文件已完整下载，GitHub 摘要及 SHA256SUMS 逐项一致。Windows 内部版本为 0.1.159；APK 为 0.1.159 / 1159，原应用 ID 和签名证书验证通过；两个 Latest 下载入口均指向本版本。
- Windows 安装程序为 267679061 字节，SHA256 `d95d7f12a4c7f4d44ec1a45cb5dc46027af92d7af854f2b7ac65be3bb396df41`；APK 为 2006675 字节，SHA256 `c7c256715bc056cea5872d66f1c50dc6b378b09ad99e0d8daf4c0f8d2d2b25f4`。
- [双架构镜像构建与验收](https://github.com/Hopesy/Rethos/actions/runs/43396037979)通过，VPS 固定镜像摘要 `sha256:9f4c326c612630cbfd6f146ff300fdd79a69a7b9ff02942ad84fb88e2c8e4b9b`。公网版本、新版工具和记忆设置资源、原 Token、Bot 模型与审批、MCP、模型目录、监控计划和启用状态均通过检查。升级前完整备份位于 `/home/zhouhl/rethos-backups/rethos-before-clients-0.1.159-20261113-091729`。
- 发布预检 63 项通过；模块抽取后相关回归 448 项通过、1 项平台相关跳过。发布过程中修正 MCP 测试对主 Bot 的旧配置假设，以及房间测试和页面高度测试的等待逻辑；三类模型的 25 个隔离场景与另外 39 项测试通过。证据位于 `.Rethos-temp/release-0.1.159/`。

### Windows 与 Android 0.1.158

2026-11-13 已发布 [Rethos 0.1.158](https://github.com/Hopesy/Rethos/releases/tag/v0.1.158)，两端来源提交均为 `8ff70261bebaa7c4052b5b660e6461053492cfc2`。默认主 Bot 保持全部可用工具和记忆，设置草稿及保存错误在模式切换后继续保留，简易模式增加工具与记忆状态入口。

- [联合构建与发布](https://github.com/Hopesy/Rethos/actions/runs/43356989048)通过，包含 Windows 实际安装启动、Android 模拟器及签名验证；[源码 CI](https://github.com/Hopesy/Rethos/actions/runs/43354019118)的 29 项检查通过。此前同一提交的[候选构建验收](https://github.com/Hopesy/Rethos/actions/runs/43354020769)也已通过。
- 五个公开文件已完整下载，GitHub 摘要及 SHA256SUMS 逐项一致。Windows 内部版本为 0.1.158；APK 为 0.1.158 / 1158，原应用 ID 和签名证书验证通过；两个 Latest 下载入口均指向本版本。
- Windows 安装程序为 267671865 字节，SHA256 `a5ead8f8f16833aaeb194a55ef58b72ec9c1ab7bff637ae3eeace1991ddb45b0`；APK 为 2006675 字节，SHA256 `300cb56f71821053ee76a7b7f978fd6380ea0849d85117a8cc49de9702926a76`。
- [双架构镜像构建与验收](https://github.com/Hopesy/Rethos/actions/runs/43354019064)通过，VPS 固定镜像摘要 `sha256:0de3a7d90743ffd9478bf49e1f829c79df75309a82e69971d8d603821de50993`。公网版本、新版工具和记忆设置资源通过检查，原 Token、模型选择、工具设置、记忆状态和桌面 MCP 配置保留。
- 发布前相关回归共 466 次通过、0 失败，1 项平台相关跳过、3 项原有待办。隔离浏览器覆盖草稿、跨模式失败重试、主 Bot 工具与 390px 记忆页。证据位于 `.Rethos-temp/release-0.1.158/` 和 `.Rethos-temp/default-bot-fix-verification.json`。

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
