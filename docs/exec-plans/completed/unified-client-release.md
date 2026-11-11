# 客户端版本统一与手机聊天改进

2026-11-11 用户要求：Android 与 PC 版本一致，同一 GitHub Release 显示两端安装包，精简资产；拓宽手机 Agent 回复，避免语音与发送误触。

## 完成记录

- 已交付：0.1.156，沿用原 Android 签名和应用 ID。
- package.json 为两端版本的唯一来源；Android versionCode 按 major × 1000000 + minor × 1000 + patch 递增。
- 联合发布等待 Windows 安装验收、Android 模拟器与签名检查全部通过，两个构建固定同一提交。
- 公开资产：Windows 安装包、Android APK、Windows 更新索引与差分信息、合并 SHA256；详细构建信息与便携 ZIP 保留 Actions artifact。
- 手机 Agent 消息使用可用行宽，操作按钮在回复下方；输入文本后语音通话入口切换为 44px 发送按钮。
- 已实现并推送：`356877118`，两端版本来源与联合发布、手机气泡及发送按钮。
- 已验收：Ego Lite 的简洁/完整界面共 12 组尺寸，390px 手机正文与表格宽 342.4px，发送 44px，无页面横向溢出；真实触摸打开消息菜单并保留草稿。最终矩阵为 `browser-matrix-final.json`。
- 本地检查：相关组件与发布校验测试、类型检查、Lint、生产构建通过；Android assembleDebug 成功，aapt 确认为 0.1.156-debug / 1156。
- 语音处理：输入内容时隐藏通话触发按钮，保留组件及菜单事件订阅；直接取消挂载会令添加菜单失去处理者，最终实现已修正。
- 联合发布 `42999700293` 与 Docker `42999698426` 已通过，公开五个文件的摘要、APK 原签名及 manifest、Windows PE 版本和两端 Latest 下载入口全部核对通过。
- VPS 已部署最终镜像并通过健康检查；公网版本和新版静态资源、原 Token、模型与桌面 MCP 配置核对通过。
- 最终 CI `42999698536` 的 29 项检查通过；联合发布、公开下载和 VPS 同步全部完成。隔离服务进程和 Ego Lite 测试空间已关闭。
- 首次短 SHA 构建在 checkout 阶段失败，后续统一使用完整提交号。被新改动替代的本任务旧 CI/镜像/安装包运行已取消。
- 临时证据：`.Rethos-temp/release-0.1.156/`。

原会话正在维护 `deploy/computer-use/` 与 `deploy/desktop/README.md`，本任务保留其工作区内容。
