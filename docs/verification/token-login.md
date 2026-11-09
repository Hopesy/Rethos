# Token 登录与手机扫码验收

此变更使用 `launchVerificationServer` 启动隔离数据目录与假模型服务。
过程脚本、fixture、日志和截图存放在 `.Rethos-temp/token-login/`。

## 使用流程

1. 首次接入：执行 `docker compose exec rethos rethos token create "Web login" --scope admin --expires 90d --out /data/rethos-admin-token`，读取生成的 Token 文件并在电脑网页登录。
2. 创建 Token：设置 → 通用 → 访问 Token → 管理 → 创建 Token；复制并保存到密码管理器。
3. 换浏览器：打开同一个 HTTPS 地址，输入已保存的 Token。每个浏览器使用自己的登录会话。
4. 手机登录：已登录的电脑网页打开设置 → 通用 → 手机扫码登录 → 显示二维码。手机相机扫码，确认服务器，点登录。
5. 撤销：在 Token 管理中点撤销并确认，关联浏览器和通过这些浏览器扫码登录的手机会话一起结束。

Token 有效期 90 天；手机二维码有效期 5 分钟，仅供一次登录。每次打开或刷新二维码生成新的临时凭据，关闭面板时取消尚未使用的凭据。扫码页会清理地址栏中的凭据。

## 自动化证据

- `server/token-login.test.ts`：多浏览器独立会话、退出、撤销、持久化与续期、范围继承、同源校验、失败限流、二维码过期和重放。
- `src/pair/PairPage.test.ts`：单一 Token 表单、成功清空输入、错误提示、显示切换、旧网页链接保持 Token 登录及桌面连接兼容。
- `src/pair/BrowserSignInPage*.test.ts`：确认前保持未登录、确认后交换凭据、成功跳转、错误重试。
- `src/components/BrowserAccessSettings.test.ts`：创建、复制、行内撤销确认、二维码刷新、StrictMode 异步清理、过期和生成失败。
- `.Rethos-temp/token-login/integration-result.json`：真实隔离 HTTP 服务的 Token 创建、双浏览器登录、二维码预览与兑换、拒绝重放、单独退出和关联撤销。

## 浏览器验收

Ego 与 Codex 内置浏览器实际验证了 Token 登录及设置二维码生成。已保存浅色、深色、错误提示、二维码设置页截图。390px 视口下，扫码确认页保留服务器与一个登录按钮，地址栏凭据已移除。

本次浏览器工具在后续截图和点击时发生超时，手机确认页的最终提交由组件交互测试和真实 HTTP 交换补验。手机相机真机扫码、软键盘与添加到主屏幕后的登录保持，仍需在部署后的 HTTPS 地址验证。

## 0.1.151 发布与部署证据

2026-11-10 已发布版本 `0.1.151`，源码提交 `f959859ccdde1062de99bd316f59c4fa5a125892`。本地 225 项相关测试、类型检查、前端构建、lint、i18n 与 OSS 检查通过。

- [Windows 工作流](https://github.com/Hopesy/Rethos/actions/runs/42657353977)完成实际安装和启动验证，7 项发布文件的摘要核对通过。证据：`.Rethos-temp/token-login/release-verification.json`。
- [Docker 版本工作流](https://github.com/Hopesy/Rethos/actions/runs/42658410982)完成 AMD64 / ARM64 构建与容器验收，版本标签和 `latest` 摘要一致。证据：`.Rethos-temp/token-login/image-verification.json`。
- VPS 已固定本次镜像摘要；备份与切换日志：`.Rethos-temp/token-login/deploy-151.log`。
- 当前生产地址为 `https://rethos.hopesy.cc`。公网只读检查确认版本、登录页资源、交付 Token 的管理员权限与有效期；证据：`.Rethos-temp/token-login/production-verification.json`。Token 值保存在本机私有文件中。
- Ego 实际打开生产登录页，确认临时配对入口、获取 Token 帮助与输入框上方标签均已移除。二维码兑换、重放、退出与撤销由上述隔离 HTTP 验证覆盖；手机相机真机扫码仍待用户设备验收。
