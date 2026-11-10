# Rethos Android 0.1.0

首个 Kotlin + WebView 安卓客户端，默认连接现有 Rethos VPS。

- 复用现有网页、Token 登录、聊天、任务进度和设置。
- 应用内保持登录，支持更换 HTTPS 服务器地址。
- 支持网页返回、文件上传、同服务器 HTTPS 文件下载、网络异常重试及系统浏览器打开外部链接。
- 网页与 VPS 同步更新；原生外壳通过签名 APK 更新。

支持 Android 8.0 及以上。下载 `Rethos-Android-0.1.0.apk` 安装，输入已有 Token 登录。Android 与浏览器各自保持会话；应用内扫码和后台系统推送安排在后续版本。

`SHA256SUMS-android.txt` 提供文件校验，`SIGNATURE.txt` 提供签名验证结果，`BUILD-INFO-android.json` 记录源码与签名证书摘要。
