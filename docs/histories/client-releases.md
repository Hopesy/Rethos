# 客户端发布记录

### Windows 与 Android 0.1.167

2026-11-18 北京时间 11:27 发布 [Rethos 0.1.167](https://github.com/Hopesy/Rethos/releases/tag/v0.1.167)，11:47 完成 VPS 升级。Windows、Android 和服务端镜像来自 `e05d7d9022d235109925cae0c87f14eb5f1878ab`。本版修复共享电脑刷新登记导致定时任务及对话中的在途请求误失效，并在实际授权变化后丢弃旧请求和目录审批。

- [客户端联合发布](https://github.com/Hopesy/Rethos/actions/runs/44227326996)、[源码 CI](https://github.com/Hopesy/Rethos/actions/runs/44227324405) 和 [Docker 双架构构建](https://github.com/Hopesy/Rethos/actions/runs/44227324289) 均通过。Android WebView 和 Linux 项目协作用例首轮失败，在相同提交复跑通过。公开标签指向该提交，5 个发布文件的 SHA256 与校验清单交叉核对，Windows 更新索引版本为 `0.1.167`。
- VPS 通过 Docker Compose 固定到 `ghcr.io/hopesy/rethos@sha256:46761f275ac645c1509bf8956c1102fd7d8bbd93371486e6d504dc956a645dd5`。切换前确认 Bot 空闲，停止服务后备份并校验数据卷；配置及备份归档保存在 `/home/zhouhl/rethos-backups/rethos-before-clients-0.1.167-20261118-034723`。
- 升级后容器健康，公网健康端点和环境版本通过核对。6 个 Bot 的抽查配置、2 个定时任务的调度与启停状态、7 份记忆和角色文件的升级前后摘要一致。两个任务均保持暂停。发布与核验记录在 `.Rethos-temp/release-0.1.167/`。

### Windows 与 Android 0.1.166

2026-11-17 北京时间 17:40 已发布 [Rethos 0.1.166](https://github.com/Hopesy/Rethos/releases/tag/v0.1.166)，Windows、Android 和 VPS 均来自提交 `47a7a9a23f8ea5877a97c0eef1133e5b5a48fb88`。选择已连接电脑后恢复完整电脑面板，移除工作位置与访问设置中的重复设备列表，并修复简易模式“打开计划”的跳转。

- [正式联合发布](https://github.com/Hopesy/Rethos/actions/runs/44055991424)使用 `publish=true`，5 个作业全部通过，构建、验收和附件上传均在 GitHub Runner 完成。Windows 通过实际安装启动验收，Android 通过模拟器和签名验收。[源码 CI](https://github.com/Hopesy/Rethos/actions/runs/44055990697) 29 项检查全部通过，[Docker 双架构构建与验收](https://github.com/Hopesy/Rethos/actions/runs/44055990926) 4 个作业通过。
- 五个公开文件摘要与 `SHA256SUMS.txt` 交叉核对通过，两个 Latest 下载入口指向本版。Windows 安装程序为 268810184 字节、SHA256 `8fd8a7404938273fe997cee896d692dcc357ac36bb13723b176496e12bd2777a`；APK 为 2006671 字节、SHA256 `ee0845aad664d9e753b99562ef01a13ceaca48719bc254e4345907b9cfbb2629`。公开 APK 下载后验证为 0.1.166 / 1166，应用 ID `cc.hopesy.rethos` 与原签名证书保留。本次本机 Windows 客户端保持原安装状态。
- VPS 经 Docker Compose 更新并固定镜像 `ghcr.io/hopesy/rethos@sha256:e2f5d2ddc9c216d6303f1b2ee911a30403946ea87fd55416611e446fc5056fc8`，容器健康，公网版本和新前端资源核对通过。升级前完整配置与停止状态的数据卷备份位于 `/home/zhouhl/rethos-backups/rethos-before-clients-0.1.166-20261117-095501`。Token、6 个 Bot 的模型与权限、工作位置、会话目录、设备身份与接入权限、模型连接、2 个定时任务及 7 份记忆/角色文件摘要核对一致。
- 升级期间暂停五项目监控，待当前 Bot 轮次结束并确认全部空闲后备份、切换容器；升级后恢复每 5 分钟运行，旧只读监控保持暂停。线上确认 `zhouh` 在线，6 个 Bot 均提供该设备；电脑面板实际显示屏幕、浏览器、数据、文件，设备卡片为一张，简易模式“打开计划”进入任务列表。
- 本地 14 个文件的 123 项回归检查通过，类型、代码规范和文件长度检查通过。版本兼容检查 15 项通过、1 项平台跳过。隔离服务与原生连接客户端覆盖工作位置、访问设置、面板标签、两种模式、目录保存和刷新恢复、键盘导航、暂停/继续、双主题及 390px 布局；用户已查看本地预览后要求发布。
- 发布与部署证据位于 `.Rethos-temp/release-0.1.166/`，包括 `workflow-public-verification.json`、`public-android-verification.json`、`deployment.log`、`web-production.json`、`ui-production.json`、配置及记忆保留检查和监控状态记录。隔离界面证据位于 `.Rethos-temp/computer-panel-repair/`。

### Windows 与 Android 0.1.165

2026-11-17 北京时间 15:55 已发布 [Rethos 0.1.165](https://github.com/Hopesy/Rethos/releases/tag/v0.1.165)，Windows、Android 和 VPS 均来自提交 `8cb795644b053d32b2c030d4439df126d8cb8d26`。本版修复自托管定时任务访问已授权电脑的身份传递，并沿主 Bot 的可信委派链向项目 Bot 传递授权；任务暂停、配置变更和凭据撤销会使对应授权失效。保留上游调度器，`server/routines.ts` 无修改。

- [正式联合发布](https://github.com/Hopesy/Rethos/actions/runs/44040941883)使用 `publish=true`，5 个作业全部通过，由 GitHub Actions 完成构建、安装验收、附件上传及公开。Windows 已在隔离 Runner 实际安装启动；Android 完成模拟器和正式签名验收。[源码 CI](https://github.com/Hopesy/Rethos/actions/runs/44032609682) 29 项检查通过，[Docker 双架构构建与验收](https://github.com/Hopesy/Rethos/actions/runs/44032609660)通过。
- 五个公开文件的 GitHub 摘要与 `SHA256SUMS.txt` 交叉核对通过，两个 Latest 下载入口指向本版。Windows 安装程序为 268810748 字节、SHA256 `e450f40fc17566ab6d7e87c5bcb447ed11debf721a47713edee90abc4d709d2b`；APK 为 2006675 字节、SHA256 `91d769d4ff9c2471630d10f85766917b233f3c358e071c3c1e29f7b13c45afe0`。公开 APK 下载后核验为 0.1.165 / 1165，应用 ID `cc.hopesy.rethos` 与原签名证书保留。本次用户本机 Windows 客户端保持原安装状态。
- VPS 经 Docker Compose 更新并固定镜像 `ghcr.io/hopesy/rethos@sha256:a9c70a1b3efe2c418d33a57e1b2b3f01ead31187c4c215c3a791c196bd9ad5c1`，容器健康，公网版本与前端资源核对通过。升级前配置及停止状态的完整数据卷备份位于 `/home/zhouhl/rethos-backups/rethos-before-clients-0.1.165-20261117-071117`。原 Token、6 个 Bot 的模型与权限、主 Bot 能力、会话电脑和工作目录、设备身份与接入权限、模型连接、2 个定时任务及 7 份记忆/角色文件摘要核对一致。
- 升级后通过网页配置 6 个 Bot 的默认工作位置为已连接电脑 `zhouh`，保存监控授权并恢复“五项目监控与自动推进”，每 5 分钟执行；旧只读监控继续暂停。本机沿用原连接组件和设备 ID。首轮实际列出电脑、读取本机 Codex session，并委派五个项目 Bot 读取上下文；Rethos 结果对话已收到核验报告。16:04 的 XDTag 报告识别到最新人工答复及随后人工中断，保留中断状态。
- 首轮并行读取出现电脑占用，主 Bot 随后串行补查。已保存共享电脑串行访问规则，项目 Bot 需要读取同一台电脑时逐个委派，已有材料的分析可并行。最终状态核对确认 6 个工作位置、串行规则、监控启用状态、旧监控暂停及实际通知；该证据覆盖监控访问与回报链路，后续项目推进由运行中的监控继续处理。
- 初次源码 CI 暴露旧 phone/card 路径的任务发起人归属回归及测试时间戳碰撞，已收窄为仅记录已授权电脑作者并使用确定递增的夹具时钟，相关隔离复验 63 项通过、8 项平台跳过。最终源码 CI 的既有重复启动测试曾超时，单独复验及失败分片重跑通过。发布预检 33 项通过、1 项平台跳过。
- 最终公开附件由正式联合 workflow 生成；前期候选包手动中转流程已停止，VPS 临时中转文件已清理。证据位于 `.Rethos-temp/release-0.1.165/`，包括 `workflow-public-verification.json`、`public-android-verification.json`、`deployment.log`、`web-production.json`、配置及记忆保留记录和 `final-monitor-state.json`。

### Windows 与 Android 0.1.164

2026-11-16 已发布 [Rethos 0.1.164](https://github.com/Hopesy/Rethos/releases/tag/v0.1.164)，Windows、Android 和 VPS 均来自提交 `d484393aac616772236eb9725d651f0ba1a21061`。工作位置保留原有卡片网格，连接电脑直接显示设备名称与状态；简易会话面板收起默认自动时的重复选项，使用“跟随 Bot”和“Bot 所在电脑”区分含义。可见面板自动刷新设备状态，保留电脑与工作目录选择。

- [源码 CI](https://github.com/Hopesy/Rethos/actions/runs/43851249026) 29 项检查通过。[联合候选构建](https://github.com/Hopesy/Rethos/actions/runs/43851251163)通过 Windows 实际安装启动及 Android 模拟器、正式签名验收。[Docker 双架构构建](https://github.com/Hopesy/Rethos/actions/runs/43851249200)通过。首轮 CI 出现 Linux 重复启动测试等待超时及 Windows 隔离服务重启时的数据目录占用错误，相关 11 项本地隔离复验与两个 CI 分片复跑均通过。
- 五个公开文件已重新下载，GitHub 摘要与 SHA256SUMS 逐项一致。Windows 内部产品与文件版本均为 0.1.164；APK 为 0.1.164 / 1164，应用 ID `cc.hopesy.rethos` 与原签名证书保留，两个 Latest 下载入口指向本版本。Windows 安装程序为 268807797 字节、SHA256 `b3b705ac0d02606b746ef3118725690375d9932edd023d046164dce33a0859a6`；APK 为 2006675 字节、SHA256 `16baa235668305f98c143e2498def20427b9860e7793ca6fa3b98f5a547645b3`。
- VPS 已固定镜像 `ghcr.io/hopesy/rethos@sha256:0c399d8066903d055be4405847f1543a4a30a286ebdc4e108be28a016572e366`，容器健康，公网版本和新前端资源核对通过。升级前配置与完整数据卷备份位于 `/home/zhouhl/rethos-backups/rethos-before-clients-0.1.164-20261116-111222`。原 Token、6 个 Bot 的模型与权限、主 Bot 能力、会话电脑和工作目录、电脑接入权限、模型连接、2 个定时任务及 7 份记忆/角色文件摘要核对一致。
- 本机 `zhouh` 使用原设备 ID `7a99cb9d-e93a-413b-805e-2d0a3154c726` 自动重连，状态在线且接入启用；6 个 Bot 的工作位置 API 均提供该电脑，显示在线且可选。
- 发布预检 125 项通过、3 项既有待办；类型、Lint、翻译目录检查通过。数据格式版本记录同步为 0.1.164，对应检查 15 项通过、1 项平台跳过。隔离原生连接和浏览器验证电脑后上线、暂停恢复、选择与目录保存、模式切换及刷新、390px 布局和双主题；最终网格为单组卡片，简易三列、高级两列。发布证据位于 `.Rethos-temp/release-0.1.164/`，界面证据位于 `.Rethos-temp/work-target-picker/`。

### Windows 与 Android 0.1.163

2026-11-16 已发布 [Rethos 0.1.163](https://github.com/Hopesy/Rethos/releases/tag/v0.1.163)，Windows、Android 和 VPS 均来自提交 `792b0a526bce7dcdac68f9cb8bacda5595559c45`。本版合入通用上游更新，支持主 Bot 创建项目 Bot、带文件分派、收回结果并维护项目记忆；单 Bot 与团队目标取消固定 13 轮上限，继续保留完成、取消、预算和人工审核条件。

- [源码 CI](https://github.com/Hopesy/Rethos/actions/runs/43831656991) 29 项检查通过。[联合候选构建](https://github.com/Hopesy/Rethos/actions/runs/43831658128)通过 Windows 实际安装启动、连接电脑权限、Android 模拟器与正式签名验收。[Docker 双架构构建](https://github.com/Hopesy/Rethos/actions/runs/43831656828)通过启动、OSS、浏览器、HTTPS 配对及持久化检查。Windows 大工作区测试的夹具准备曾超时，单独复验 6 项通过，对应 CI 分片重跑通过。
- 五个公开文件已重新下载，GitHub 摘要与 SHA256SUMS 逐项一致。Windows 内部产品与文件版本均为 0.1.163；APK 为 0.1.163 / 1163，应用 ID `cc.hopesy.rethos` 与原签名证书保留，两个 Latest 下载入口指向本版本。Windows 安装程序为 268807182 字节、SHA256 `e56993a055b39dca01e39659054fdf5ff0a1cbdfc527c85840adf122baa244cb`；APK 为 2006671 字节、SHA256 `f9e97a78cdd1389e865c74ad23c4a449b0832c36e2642b4fc47738ff3a1e3251`。
- VPS 已固定镜像 `ghcr.io/hopesy/rethos@sha256:eabe5f65c1a86c11dcd9b662d8d73286c4c2669b2ddbd854d0183501447e8351`，容器健康，公网版本与新前端资源核对通过。升级前配置与完整数据卷备份位于 `/home/zhouhl/rethos-backups/rethos-before-clients-0.1.163-20261116-085838`。原 Token、6 个 Bot 的模型、权限、工作位置与主 Bot 能力、模型连接、2 个定时任务的计划和启用状态、7 份记忆/角色文件摘要核对一致。
- 修复 Bot 暂停后接收新任务、部门重命名丢失暂停状态、桌面接管期间切换工作位置、隔离模式切换中的接管竞态、设置弹层焦点及手机设置链接。补齐 693 项简体中文文案并保持完整目录；移除过时的套餐并发限制，诊断与并发说明使用悬浮帮助。官方商业云、购买、套餐、试用和推广入口保持移除。
- 隔离服务验证共享 VM 的 66 项接管情景，团队首次进入、文件迁移、默认成员权限与暂停 24 项，成员例行任务与主 Bot 分派 16 项。Ego 检查真实聊天和设置页面、自定义模型入口、私有桌面卡片与悬浮帮助，并核对 Daylight、Midnight。证据位于 `.Rethos-temp/release-0.1.163/`。

### Windows 与 Android 0.1.162

2026-11-16 已发布 [Rethos 0.1.162](https://github.com/Hopesy/Rethos/releases/tag/v0.1.162)，Windows、Android 和 VPS 均来自提交 `e0f01c55a7b17e370a84951aeee1ca29f91ec7ee`。本次统一具体电脑与工作目录、Bot/会话目标和按服务器管理的接入权限，并移除商业托管账号、购买、套餐、试用、Boat 执行器及相关后台入口。

- [源码 CI](https://github.com/Hopesy/Rethos/actions/runs/43745559497) 的 40 项检查通过；[联合候选构建](https://github.com/Hopesy/Rethos/actions/runs/43745562476)通过 Windows 实际安装启动、原生电脑权限、Android 7 项模拟器操作和正式签名验证。Linux 打包桌面与三平台浏览器检查通过。
- 五个公开文件已重新下载，GitHub 摘要与 SHA256SUMS 一致。Windows 内部版本为 0.1.162；APK 为 0.1.162 / 1162，原应用 ID 和签名证书保留，两个 Latest 下载入口指向本版本。Windows 安装程序为 267173222 字节、SHA256 `e6348e8539b4cdb0bc2a9dcb218516adcd964491139ff878d3f12ad6c5ca72f9`；APK 为 2006675 字节、SHA256 `1b1283630c803ccc354959e3e0504d37be7eb028738e1f30cb59e268a1c154a7`。
- [发布镜像构建与验收](https://github.com/Hopesy/Rethos/actions/runs/43748751129)通过。VPS 已固定镜像 `ghcr.io/hopesy/rethos@sha256:4ff2de694a954136c282a322a77383659d08d34ebb78e3e585c15941aee4da70`，升级前配置与完整数据卷备份在 `/home/zhouhl/rethos-backups/rethos-before-clients-0.1.162-20261115-185434`。原 Token、6 个 Bot 的模型与权限、2 个定时任务的计划和启用状态、7 份记忆/角色文件摘要核对一致。
- 本机连接器已备份升级，`zhouh` 沿用设备 ID `7a99cb9d-e93a-413b-805e-2d0a3154c726` 和连接凭据重新上线；三个会话目录保持预授权只读，终端、屏幕及跟随 Bot 权限保留。6 个 Bot 的工作位置 API 均提供该电脑；两个旧 MCP 保持移除。
- 隔离浏览器覆盖具体电脑/目录保存、简易与高级模式、会话关闭/跟随、服务器暂停恢复和 390px 布局；原生连接器覆盖 Full/Ask、拒绝、Stop、设备隔离及撤销后的重启。补齐安装包资源、首次启动默认工作区、初始化顺序和遗留权限回调；浏览器历史测试及连接器权限测试消除主机缓存/内存容量假设，后者在 Windows 与 Linux 均 7/7 通过。
- 发布与部署证据位于 `.Rethos-temp/release-0.1.162/`；功能验收位于 `.Rethos-temp/work-location/`、`.Rethos-temp/connected-computer/`。[完成计划](../exec-plans/completed/computer-access-and-commercial-removal.md)记录产品契约与验收范围。

### Windows 与 Android 0.1.161

2026-11-15 已发布 [Rethos 0.1.161](https://github.com/Hopesy/Rethos/releases/tag/v0.1.161)，两端和 VPS 均来自提交 `e3d2b1b714c4a2c84612ca0e5d2829af7a19e0c6`。已连接电脑统一提供文件、终端和 CUA 桌面能力，本机与 VPS 复用同一套 Bot 权限规则；普通模式保留目录申请，完全访问模式按当前系统账号权限执行。

- [源码 CI](https://github.com/Hopesy/Rethos/actions/runs/43697155385) 的 29 项检查通过；[联合候选构建与验收](https://github.com/Hopesy/Rethos/actions/runs/43697250165)通过 Windows 实际安装启动、原生电脑隔离验收、Android 真实触摸及正式签名验证。五个联合产物复用仓库发布器上传，逐项核对 GitHub 摘要后公开并设为 Latest。
- 五个公开文件已完整下载，GitHub 摘要和 SHA256SUMS 逐项一致。Windows 内部版本为 0.1.161；APK 为 0.1.161 / 1161，原应用 ID 和签名证书验证通过；两个 Latest 下载入口均指向本版本。
- Windows 安装程序为 267685189 字节，SHA256 `fc3c900d80f3577770053fbb9e1b4b038af66381044fca7d07dda208c7a3a460`；APK 为 2006667 字节，SHA256 `d764537ab0c787ecfb0a4296c09f72b6ff49582027f997ead816bcd47872fea5`。
- [双架构镜像构建与验收](https://github.com/Hopesy/Rethos/actions/runs/43697155302)通过，VPS 固定镜像摘要 `sha256:54fa5c6a610abcf14d582b6d495fe51ac4a1bd2bf1010e6438da98172e1cd9b7`。完整备份位于 `/home/zhouhl/rethos-backups/rethos-before-clients-0.1.161-20261115-091930`；原 Token、6 个 Bot 的模型与权限、2 个监控的计划和启用状态均保留。
- 本机 `zhouh` 在服务升级后以原 ID 自动重连，文件、终端和桌面能力在线；Codex 与 Claude 的三个会话目录保持预授权只读，“跟随 Bot 权限”开启，两个旧 MCP 保持移除。普通模式申请、完全访问、拒绝、停止、伪造授权范围及连接器重启后的撤销状态均在隔离环境完成验证。
- 发布预检 82 项通过；补全原生权限翻译，并完善隔离端口分配与 Android 触摸前的焦点、绘制等待。证据位于 `.Rethos-temp/release-0.1.161/`，电脑权限验收说明见 [connected-computer.md](../verification/connected-computer.md)。

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
