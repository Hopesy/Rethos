# Rethos Android 0.1.3

本次沿用现有网页界面，完善手机响应式布局与操作体验。

- 移除安卓外壳的图标、标题和菜单顶栏，登录页保留原生相机扫码入口。
- 返回键按菜单、设置详情、设置和侧栏逐层关闭，保留输入草稿。
- 手机默认 Enter 换行，通过发送按钮提交消息；沿用手动保存的发送按键偏好。
- 菜单适配触摸操作，扩大点击区域，优化横屏和键盘占用空间时的布局。
- 设置提供可搜索的分类列表与详情页，复用现有表单。
- 对话 Markdown 导出接入安卓系统保存文件界面，支持中文内容。

[下载 Rethos Android 0.1.3](https://github.com/Hopesy/Rethos/releases/download/android-v0.1.3/Rethos-Android-0.1.3.apk)。Android 8.0 及以上可用。应用 ID 为 `cc.hopesy.rethos`，versionCode 为 4，沿用正式签名，可直接覆盖安装 0.1.2 并保留应用数据。

网页改动由 VPS 同步部署，应用外壳随本次 APK 更新。网页下载按钮与二维码共用本版下载地址。

发布工作流先执行单元测试、Lint 和 Android 模拟器验收，再构建正式签名 APK，并核对上传摘要。源码提交、APK 摘要和证书摘要随 Release 的 `BUILD-INFO-android.json`、`SHA256SUMS-android.txt`、`SIGNATURE.txt` 提供。

## 2026-11-11 发布验证

[Android 构建与发布](https://github.com/Hopesy/Rethos/actions/runs/42985650191)全部通过，Android 15 模拟器执行 7 项测试通过。来源提交为 `b2b9eea5a0563be2842aa9cc7b3d2df08dd4eecd`。

4 个公开附件已匿名下载并核对摘要，APK 经 apksigner 与 manifest 复核通过。APK 为 2,006,699 字节，SHA256 `0292c03f2ad1d817829342466dd64738b9b5a8b5ecb5350cecc7456fd70c5410`。签名证书 SHA256 `30f188219812d83ee815ebab1ea3a01610526e268c80e02e93ab54223b3a6781`，与 0.1.2 一致。

VPS 已部署配套网页，[双架构镜像验收](https://github.com/Hopesy/Rethos/actions/runs/42985614500)通过。下载按钮和二维码均指向本次 APK，原 Token、模型与桌面连接配置核对一致。
