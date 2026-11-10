# Rethos Android

Kotlin + 系统 WebView 客户端，默认访问 `https://rethos.hopesy.cc`。网页与 VPS 共用版本，应用外壳独立发布。

## 使用

安装签名 APK，打开 Rethos，输入已有访问 Token 登录。登录 Cookie 保存在应用内；关掉应用再打开会恢复会话。顶部菜单提供刷新、服务器地址和在浏览器中打开。更换服务器时清除旧站点 Cookie 与网页存储，随后在新地址登录。

- 支持 Android 8.0 及以上；系统 WebView 保持更新。
- 返回键先返回网页上一页，再退出当前应用窗口。
- 文件上传使用系统文件选择器；同服务器 HTTPS 文件下载使用系统“保存文件”窗口。
- 主页面连接失败显示重试入口，TLS 证书由系统验证。
- 外部网页链接交给系统浏览器。网页生成的 `blob:` 导出文件可通过“在浏览器中打开”保存。
- 手机浏览器与 APK 各自保持登录。当前 APK 使用 Token 登录；应用内相机扫码、App Links 与后台系统推送列为后续能力。现有网页二维码仍可由手机相机扫描，在手机浏览器完成登录。
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

升级时下载新版 APK 并覆盖安装。相同应用 ID、相同签名和递增版本号支持保留应用数据。签名密钥需要长期备份；卸载应用会清除应用内登录状态。

## 验证

单元测试覆盖 HTTPS 地址校验、同源凭据约束、下载文件名。Android 仪器测试在专用 `FixtureActivity` 中拦截全部请求，通过触摸事件操作隔离页面，覆盖 WebView 渲染、网页存储与 HttpOnly Cookie 保持、页面返回、系统文件选择结果回传、HTTP 503 错误提示及重试。测试文件由 debug 专用 FileProvider 提供；测试入口与文件 Provider 仅存在于调试包。

本机有真实设备连接时，使用指定模拟器序列号执行安装与测试，避免对其他设备安装调试包。过程记录放在 `.Rethos-temp/android/`。
