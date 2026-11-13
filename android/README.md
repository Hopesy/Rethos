# Rethos Android

Kotlin + 系统 WebView 客户端，默认访问 `https://rethos.hopesy.cc`。Windows、Android 与网页共用 `package.json` 版本。

## 使用

[下载签名 APK](https://github.com/Hopesy/Rethos/releases/latest/download/Rethos-Android.apk) · [发布页与校验文件](https://github.com/Hopesy/Rethos/releases/latest)

当前版本 0.1.159，versionCode 1159，沿用原签名与应用 ID，可直接覆盖安装旧版。

安装签名 APK，打开 Rethos，输入已有访问 Token 登录。也可点击登录页“扫码登录”，允许相机权限后扫描电脑端设置中生成的登录二维码，返回应用确认登录。登录 Cookie 保存在应用内；关掉应用再打开会恢复会话。0.1.3 移除了外壳的图标、标题和菜单顶栏，网页直接铺满系统状态栏下方。

- 支持 Android 8.0 及以上；系统 WebView 保持更新。
- 返回键依次关闭当前菜单、设置详情、设置和侧栏，再返回网页或退出当前应用窗口。
- 文件上传使用系统文件选择器；同服务器 HTTPS 文件下载使用系统“保存文件”窗口。
- 主页面连接失败显示重试入口，TLS 证书由系统验证。
- 外部网页链接交给系统浏览器。
- 手机浏览器与 APK 各自保持登录。应用内扫描当前服务器的登录二维码，登录保留在 APK 内。相机扫码使用内置 ZXing，支持缺少 Google Play 服务的设备；首次使用申请相机权限。App Links 与后台系统推送列为后续能力。
- 手机回到前台会请求重连现有事件流。任务执行和桌面监控继续运行于 VPS。
- 手机网页提供大触控菜单、设置分类与详情、逐层返回和 Enter 换行，触控横屏沿用手机布局。
- 对话菜单的“下载为 .md”打开系统保存文件界面，支持 UTF-8 中文内容，单次导出上限为 8 MiB。

## 本地构建

扫码入口保留在登录页；连接失败页提供重试和服务器地址设置。Markdown 导出通过限定服务器来源的 WebView 消息桥调用系统保存文件界面。

需要 JDK 21、Android SDK 36 与 Build Tools 36.0.0。设置 `JAVA_HOME`、`ANDROID_HOME` 后：

```sh
./gradlew assembleDebug testDebugUnitTest lintDebug
```

Windows 使用 `gradlew.bat`。调试包使用独立应用 ID `cc.hopesy.rethos.debug`，正式包为 `cc.hopesy.rethos`。

正式签名参数通过环境变量传入：`RETHOS_ANDROID_KEYSTORE`、`RETHOS_ANDROID_STORE_PASSWORD`、`RETHOS_ANDROID_KEY_ALIAS`、`RETHOS_ANDROID_KEY_PASSWORD`。配置后运行 `./gradlew assembleRelease lintRelease`。

## GitHub Actions 发布

运行 **Rethos client release** 并勾选 `publish`，两端完成验证后一起发布。**Rethos Android APK** 单独运行时生成候选包和验收记录。流程执行单元测试、Lint、Android 模拟器隔离验收、正式签名与 APK manifest 版本检查。

仓库 Secrets：

- `RETHOS_ANDROID_KEYSTORE_BASE64`：正式签名文件的 Base64。
- `RETHOS_ANDROID_STORE_PASSWORD`：签名库密码。
- `RETHOS_ANDROID_KEY_ALIAS`：签名别名。
- `RETHOS_ANDROID_KEY_PASSWORD`：签名密钥密码。

每次发布只更新 `package.json` 版本；Gradle 自动生成相同的 versionName，versionCode 为 major × 1000000 + minor × 1000 + patch。版本规则和联合发布步骤见[发布指南](../docs/releasing.md)。

网页下载按钮与二维码共用 `src/lib/app-links.ts` 的 `ANDROID_APK_URL`，固定指向 Latest 的 `Rethos-Android.apk`。

升级时下载新版 APK 并覆盖安装。相同应用 ID、相同签名和递增版本号支持保留应用数据。签名密钥需要长期备份；卸载应用会清除应用内登录状态。

## 验证

单元测试覆盖 HTTPS 地址校验、同源凭据约束、下载文件名。Android 仪器测试在专用 `FixtureActivity` 中拦截全部请求，通过触摸事件操作隔离页面，覆盖 WebView 渲染、网页存储与 HttpOnly Cookie 保持、页面返回、系统文件选择结果回传、HTTP 503 错误提示及重试。测试文件由 debug 专用 FileProvider 提供；测试入口与文件 Provider 仅存在于调试包。

本机有真实设备连接时，使用指定模拟器序列号执行安装与测试，避免对其他设备安装调试包。过程记录放在 `.Rethos-temp/android/`。

已发布版本的实际证据见 [Android 0.1.0 验证记录](../docs/releases/android-v0.1.0-verification.md)。

0.1.1 使用与 0.1.0 相同的应用 ID 和正式签名，支持覆盖升级。新增测试覆盖登录入口真实触摸启动相机、取消扫码、同源二维码返回、连续扫码重载、其他站点二维码与程序合成点击的校验。网页 0.1.154 的登录卡片在应用内自动接上扫码入口，可直接配合现有 VPS 使用。
