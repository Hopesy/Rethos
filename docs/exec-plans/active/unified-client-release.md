# 客户端版本统一与手机聊天改进

2026-11-11 用户要求：Android 与 PC 版本一致，同一 GitHub Release 显示两端安装包，精简资产；拓宽手机 Agent 回复，避免语音与发送误触。

## 接续

- 当前切片：0.1.156，沿用原 Android 签名和应用 ID。
- package.json 为两端版本的唯一来源；Android versionCode 按 major × 1000000 + minor × 1000 + patch 递增。
- 联合发布等待 Windows 安装验收、Android 模拟器与签名检查全部通过，两个构建固定同一提交。
- 公开资产：Windows 安装包、Android APK、Windows 更新索引与差分信息、合并 SHA256；详细构建信息与便携 ZIP 保留 Actions artifact。
- 手机 Agent 消息使用可用行宽，操作按钮在回复下方；输入文本后语音通话入口切换为 44px 发送按钮。
- 待完成：实现联合发布、手机真实浏览器验收、构建发布、线上更新与下载校验。
- 临时证据：`.Rethos-temp/release-0.1.156/`。

原会话正在维护 `deploy/computer-use/` 与 `deploy/desktop/README.md`，本任务保留其工作区内容。
