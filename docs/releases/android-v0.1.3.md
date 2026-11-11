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
