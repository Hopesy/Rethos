# Rethos Android 0.1.2

配合 Rethos Windows / Web 0.1.155 发布，沿用应用内扫码登录、Token 登录和 WebView 会话保存。

- 应用 ID `cc.hopesy.rethos`，versionCode 3，沿用正式签名，可覆盖安装 0.1.1 并保留应用数据。
- 登录页和顶部菜单均提供“扫码登录”，支持 Android 8.0 及以上。
- 网页下载按钮和下载二维码同步指向本次签名 APK。

[下载 Rethos Android 0.1.2](https://github.com/Hopesy/Rethos/releases/download/android-v0.1.2/Rethos-Android-0.1.2.apk)。安装后可输入现有 Token，或扫描电脑网页“设置 → 通用 → 手机扫码登录”生成的二维码。

发布工作流执行单元测试、Lint、Android 模拟器验收和正式签名验证。源码提交、APK 摘要和证书摘要随 Release 的 `BUILD-INFO-android.json`、`SHA256SUMS-android.txt`、`SIGNATURE.txt` 提供。

## 2026-11-11 发布验证

[Android 构建与发布](https://github.com/Hopesy/Rethos/actions/runs/42962738440)的验证、签名与发布三个任务全部通过，源码提交为 `264eaf3b105fac205d07ca0b8b9cf61e63bbfa88`。

4 个公开附件已匿名下载并核对摘要。APK 为 1,964,506 字节，SHA256 `9b8b93b6066633c78a624a4b80066acdc15c06bf6fd04200f1aa6124dd701b9e`。下载后的 APK 经 apksigner 验证通过，manifest 确认为 `cc.hopesy.rethos`、versionCode 3、versionName 0.1.2。

签名证书 SHA256 `30f188219812d83ee815ebab1ea3a01610526e268c80e02e93ab54223b3a6781`，与 0.1.1 相同。现有安装可直接覆盖升级。公网网页下载入口已同步。
