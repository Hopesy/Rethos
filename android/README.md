# Rethos Android

Kotlin + 系统 WebView 客户端，默认访问 `https://rethos.hopesy.cc`。网页与 VPS 共用版本，应用外壳独立发布。

## 使用

[下载签名 APK](https://github.com/Hopesy/Rethos/releases/download/android-v0.1.1/Rethos-Android-0.1.1.apk) · [发布页与校验文件](https://github.com/Hopesy/Rethos/releases/tag/android-v0.1.1)

安装签名 APK，打开 Rethos，输入已有访问 Token 登录。0.1.1 增加应用内扫码：点击登录页“扫码登录”，或顶部菜单“扫码登录”，允许相机权限后扫描电脑端设置中生成的登录二维码，返回应用确认登录。登录 Cookie 保存在应用内；关掉应用再打开会恢复会话。顶部菜单还提供刷新、服务器地址和在浏览器中打开。更换服务器时清除旧站点 Cookie 与网页存储，随后在新地址登录。

- 支持 Android 8.0 及以上；系统 WebView 保持更新。
- 返回键先返回网页上一页，再退出当前应用窗口。
- 文件上传使用系统文件选择器；同服务器 HTTPS 文件下载使用系统“保存文件”窗口。
- 主页面连接失败显示重试入口，TLS 证书由系统验证。
- 外部网页链接交给系统浏览器。网页生成的 `blob:` 导出文件可通过“在浏览器中打开”保存。
- 手机浏览器与 APK 各自保持登录。应用内扫描当前服务器的登录二维码，登录保留在 APK 内。相机扫码使用内置 ZXing，支持缺少 Google Play 服务的设备；首次使用申请相机权限。App Links 与后台系统推送列为后续能力。
- 手机回到前台会请求重连现有事件流。任务执行和桌面监控继续运行于 VPS。

## 本地构建

需要 JDK 21、Android SDK 36 与 Build Tools 36.0.0。设置 `JAVA_HOME`、`ANDROID_HOME` 后：

```sh
./gradlew assembleDebug testDebugUnitTest lintDebug
```

Windows 使用 `gradlew.bat`。调试包使用独立应用 ID `cc.hopesy.rethos.debug`，正式包为 `cc.hopesy.rethos`。

正式签名参数通过环境变量传入：`RETHOS_ANDROID_KEYSTORE`、`RETHOS_ANDROID_STORE_PASSWORD`、`RETHOS_ANDROID_KEY_ALIAS`、`RETHOS_ANDROID_KEY_PASSWORD`。配置后运行 `./gradlew assembleRelease lintRelease`。

## GitHub Actions 发布

运行 **Rethos Android APK**，选择源码 ref，并按需要勾选 `publish`。流程先做单元测试、Lint 和 Android 模拟器隔离验收，再构建签名 APK；发布前核对 GitHub 上传摘要。测试页面只进入 debug 构建。

仓库 Secrets：

- `RETHOS_ANDROID_KEYSTORE_BASE64`：正式签名文件的 Base64。
- `RETHOS_ANDROID_STORE_PASSWORD`：签名库密码。
- `RETHOS_ANDROID_KEY_ALIAS`：签名别名。
- `RETHOS_ANDROID_KEY_PASSWORD`：签名密钥密码。

每次发布同时增加 `app/build.gradle.kts` 的 `versionCode` 和 `versionName`，新增 `docs/releases/android-v<版本>.md`。标签为 `android-v<版本>`，APK 命名为 `Rethos-Android-<版本>.apk`。Android Release 独立于 Windows 的 Latest 更新入口。

网页“获取手机应用”仅提供 Rethos Android，二维码与下载按钮共用 `src/lib/app-links.ts` 中的 `ANDROID_APK_URL`。新版 APK 发布后，将此地址和本文下载链接更新为该版本的实际资源地址，再发布网页更新。

升级时下载新版 APK 并覆盖安装。相同应用 ID、相同签名和递增版本号支持保留应用数据。签名密钥需要长期备份；卸载应用会清除应用内登录状态。

## 验证

单元测试覆盖 HTTPS 地址校验、同源凭据约束、下载文件名。Android 仪器测试在专用 `FixtureActivity` 中拦截全部请求，通过触摸事件操作隔离页面，覆盖 WebView 渲染、网页存储与 HttpOnly Cookie 保持、页面返回、系统文件选择结果回传、HTTP 503 错误提示及重试。测试文件由 debug 专用 FileProvider 提供；测试入口与文件 Provider 仅存在于调试包。

本机有真实设备连接时，使用指定模拟器序列号执行安装与测试，避免对其他设备安装调试包。过程记录放在 `.Rethos-temp/android/`。

已发布版本的实际证据见 [Android 0.1.0 验证记录](../docs/releases/android-v0.1.0-verification.md)。

0.1.1 使用与 0.1.0 相同的应用 ID 和正式签名，支持覆盖升级。新增测试覆盖登录入口真实触摸启动相机、取消扫码、同源二维码返回、连续扫码重载、其他站点二维码与程序合成点击的校验。网页 0.1.154 的登录卡片在应用内自动接上扫码入口，可直接配合现有 VPS 使用。
