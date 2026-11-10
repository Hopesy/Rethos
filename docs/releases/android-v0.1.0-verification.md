# Rethos Android 0.1.0 验证记录

验证日期：2026-11-10。

- 发布源码：`cae09ac35f00c281ef11f4eb31c59b47ef657ac7`。
- [GitHub Actions](https://github.com/Hopesy/Rethos/actions/runs/42752753773)：验证、签名打包与发布三个任务全部成功。
- [正式发布](https://github.com/Hopesy/Rethos/releases/tag/android-v0.1.0)：`android-v0.1.0`，应用 ID `cc.hopesy.rethos`，版本号 `0.1.0` / `1`。
- APK 大小：1,689,470 字节，约 1.61 MiB。

## 构建与交互

本地与 GitHub Actions 均通过单元测试、Debug/Release Lint，以及 Android 15（API 35）模拟器交互测试。

4 项单元测试覆盖 HTTPS 地址校验、地址规范化、同源凭据约束与文件名处理。4 项仪器测试通过真实触摸事件操作隔离 HTML 页面，验证：

1. 登录状态的网页存储在 Activity 重建后保留，页面前进与系统返回正常。
2. HttpOnly Cookie 在 Activity 重建后保留，网页脚本无法读取该 Cookie。
3. 系统文件选择请求携带正确的文件类型，回传的测试文件内容可由网页读取。选择结果由测试监视器提供。
4. HTTP 503 提示可见，点击重试后回到正常首页。此项复现并修复了 WebView 错误回调早于加载开始回调时提示被清除的问题。

测试网络由 debug 专用 `FixtureActivity` 拦截，文件来自 debug 专用 FileProvider。本次验收使用隔离状态与文件。

正式签名包已在本地模拟器安装并打开 `https://rethos.hopesy.cc`，检查中文登录页、Token 输入框、软键盘避让、顶部菜单及服务器地址窗口。生产页面检查停留在登录页；聊天任务的服务端行为沿用现有 Web 实现。

## 发布文件

正式 APK 已从 GitHub Release 下载，核对全部 SHA-256 清单、构建来源与 APK 签名。证书与本地正式签名一致；正式 Manifest 中未包含调试 Activity 或测试文件 Provider。正式构建通过 `BuildConfig.DEBUG` 关闭 WebView 调试。

APK SHA-256：

```text
2463f5edfc1cade3cea44a854b85e88a87a95be60b5d979ce61fac9d59d41118
```

签名证书 SHA-256：

```text
30f188219812d83ee815ebab1ea3a01610526e268c80e02e93ab54223b3a6781
```

发布页同时提供 `BUILD-INFO-android.json`、`SIGNATURE.txt` 和 `SHA256SUMS-android.txt`。Windows Latest 仍为 `v0.1.151`。

本地过程证据保存在 `.Rethos-temp/android/`，包括单元与仪器测试输出、GitHub Actions 日志、APK 校验文件，以及登录页和键盘截图。下载的正式 APK 另保存于维护者桌面。

## 后续验收

实体手机安装、更多 Android 版本、应用内相机扫码、App Links 和锁屏后台系统通知继续保留为后续项目。当前手机端使用 Token 登录，前台查看服务器任务和聊天进度。
