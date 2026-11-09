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

源码构建完成；此次变更的发布与 VPS 更新单独执行。
