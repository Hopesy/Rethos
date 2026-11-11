# Rethos Android 0.1.2

配合 Rethos Windows / Web 0.1.155 发布，沿用应用内扫码登录、Token 登录和 WebView 会话保存。

- 应用 ID `cc.hopesy.rethos`，versionCode 3，沿用正式签名，可覆盖安装 0.1.1 并保留应用数据。
- 登录页和顶部菜单均提供“扫码登录”，支持 Android 8.0 及以上。
- 网页下载按钮和下载二维码同步指向本次签名 APK。

[下载 Rethos Android 0.1.2](https://github.com/Hopesy/Rethos/releases/download/android-v0.1.2/Rethos-Android-0.1.2.apk)。安装后可输入现有 Token，或扫描电脑网页“设置 → 通用 → 手机扫码登录”生成的二维码。

发布工作流执行单元测试、Lint、Android 模拟器验收和正式签名验证。源码提交、APK 摘要和证书摘要随 Release 的 `BUILD-INFO-android.json`、`SHA256SUMS-android.txt`、`SIGNATURE.txt` 提供。
