# Rethos Android 0.1.1

登录页增加应用内扫码登录。点击“扫码登录”，允许相机权限后扫描电脑端 Rethos 设置中生成的登录二维码，回到应用确认登录。顶部菜单同样提供扫码入口。

- 内置 ZXing 扫码，支持 Android 8.0 及以上和未安装 Google Play 服务的设备。
- 校验二维码的服务器地址、`/pair` 路径及登录凭据格式，登录继续在当前应用的 WebView 内完成。
- 连续扫码会重新加载登录流程；取消扫码返回原页面。
- 自动连接现有 Web 0.1.154 登录页上的手机入口；适配扫码界面的系统栏和屏幕缺口。
- 应用 ID `cc.hopesy.rethos`，versionCode 2，使用 0.1.0 的原签名覆盖升级。

[下载签名 APK](https://github.com/Hopesy/Rethos/releases/download/android-v0.1.1/Rethos-Android-0.1.1.apk)。覆盖安装后，点击“扫码登录”并允许相机权限。二维码在电脑网页“设置 → 通用 → 手机扫码登录”中生成。

公开发行包的摘要、签名与源码提交记录在同一 Release 的 `SHA256SUMS-android.txt`、`SIGNATURE.txt` 和 `BUILD-INFO-android.json` 中。

## 2026-11-10 验证

| 检查 | 结果 |
| --- | --- |
| Kotlin 单元测试 | 6 项通过，覆盖地址、同源约束与二维码格式 |
| Android 仪器测试 | Android 35 专用模拟器，6 项通过 |
| 仪器测试新增流程 | 真实触摸打开相机、取消扫码、合成点击校验、跨站二维码校验、连续扫码与 `/pair` 文档重载 |
| 网页与服务端登录测试 | `server/token-login.test.ts`、`src/lib/session.test.ts` 共 26 项通过 |
| Debug / Release Lint | 0 errors；保留依赖版本和屏幕方向提示 |
| 正式签名 | apksigner 校验通过，证书摘要与 0.1.0 相同 |
| 覆盖升级 | 模拟器中从 versionCode 1 / 0.1.0 升级至 versionCode 2 / 0.1.1 成功 |
| 现有 VPS 兼容 | 正式包加载当前登录页，显示“扫码登录”；点击后出现相机权限提示并进入原生扫码界面 |

仪器测试使用 debug 专用隔离页面，扫码结果回传由 Android ActivityMonitor 提供；真实相机 Activity 的打开与取消单独验证。现有 VPS 的检查仅打开未登录页面和本地相机入口。实体手机的摄像头识别效果待手机覆盖安装后验收。

本地验证 APK SHA-256：`b4b6d4efc5d79c61e9ebf3fa47a18721701d2a6677be68fa4eadd0f87c8c93dc`。GitHub Actions 的独立构建摘要以公开发行校验文件为准。

签名证书 SHA-256：`30f188219812d83ee815ebab1ea3a01610526e268c80e02e93ab54223b3a6781`

构建日志、仪器测试输出、签名结果与界面证据保存在 `.Rethos-temp/android/`。

## 公开发行核对

2026-11-10 北京时间 19:12 公开发布。[GitHub Actions](https://github.com/Hopesy/Rethos/actions/runs/42804470560) 的验证、签名及发布三个任务全部通过，来源提交 `ec445afe74c0249fa497d8ed7f504404f4f9726d`。

4 个公开附件逐一匿名下载，字节数和 SHA-256 与 GitHub 附件摘要及 BUILD-INFO 相符。下载后的 APK 再次经 apksigner 校验，原签名、`cc.hopesy.rethos`、versionCode 2 和 versionName 0.1.1 均相符。

公开 APK：1,964,498 字节，SHA-256 `04d6bd3caabc4916aaa60352f1be0429daddd776aff0b70f42e9b2cb7c8cff6c`。公网网页 0.1.155 的下载入口已经同步。发行证据位于 `.Rethos-temp/release-0.1.155/`。
