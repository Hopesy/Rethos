# Rethos 维护说明

2026-11-08，基于 OpenMausBot `d7ce39ea0`、版本 `0.1.149` 整理。

## 修改记录

- 移除专有许可的 `enterprise/` 全目录，以及专用于该目录的 CLA 和贡献者工作流。
- 服务端与 npm 构建取消商业模块打包，增加 `pnpm check:oss`。
- Web、语言包、默认助手、桌面提示和安装包的产品名称改为 Rethos。
- npm 包名和命令为 `rethos`，桌面应用标识为 `com.hopesy.rethos`。
- 保留 `LICENSE`、上游版权、`NOTICE` 和第三方许可。
- 更新来源指向已存在的 `Hopesy/Rethos` 仓库。
- 移除上游旧发布仓库的镜像同步流程，发布校验使用 Rethos 的安装包名称。
- Docker 镜像统一为 `ghcr.io/hopesy/rethos`，支持 AMD64/ARM64；发布前验证实际容器，Compose 使用预构建镜像更新。
- VPS 安装、升级、备份、回退和迁移验收统一见 [部署维护文档](rethos-vps.md)。
- 清理直接依赖已删除企业适配器的集成测试及相应验证文档。

## 兼容项

`OMB_*`、`OPENMAUSBOT_*` 环境变量、`~/.openmausbot` 数据目录、内部协议、API 标识和部分源文件名继续沿用，保持已有数据格式和设备连接行为。

上游服务名称与第三方下载地址保留真实归属。产品入口使用自建服务器与本地工作空间；官方云购买、云账号和组织空间已从设置、菜单、配对页与桌面桥接中移除。机器人团队协作继续保留。

## 图标与配对页面

`build/icon.svg` 是 Rethos 的图标源文件。运行 `node scripts/build-brand-icons.mjs` 生成网页 SVG、PWA PNG、Apple touch icon、Windows ICO 和桌面窗口图标，并将生成的文件一起提交。

配对页自动生成设备名称，只需输入授权码并连接。获取授权码的命令放在折叠帮助中，按全局安装、源码和 Docker 部署显示。浏览器从链接填入授权码后仍需点击连接；桌面客户端可以直接交换链接中的授权码。会话和授权码校验继续由现有服务端完成。

0.1.150 的更新内容见 [版本说明](releases/v0.1.150.md)。

## 验证

```sh
pnpm check:oss
pnpm typecheck
pnpm exec vitest run server/enterprise.test.ts server/brand.test.ts src/lib/brand.test.ts server/update-check.test.ts
pnpm i18n:check
pnpm package:npm
```

依照 `docs/verification/README.md` 使用隔离 fixture 检查启动、品牌 API 和会话。测试过程文件放在 `.Rethos-temp/`。

同步上游时检查商业目录和打包步骤是否重新出现，再执行 OSS 检查与构建。正式发布前另外验证目标系统、签名、更新元数据和 npm 包所有权。

## 本次验证结果

2026-11-08 在 Windows 本地完成：

- TypeScript 类型检查、oxlint 和 16 个语言包校验通过。
- Web 生产构建、服务端构建和 npm 打包通过，产物为 `release/rethos-0.1.149.tgz`。
- 品牌、CLI、原生宿主标识、OSS 缺失企业模块、CI 配置与文档的相关回归检查通过。
- 隔离 fixture 返回 `edition: oss`、空功能列表和 `brand.name: Rethos`，PWA manifest 名称为 Rethos。
- 浏览器显示“认识 Rethos”；使用项目自带假模型完成一次消息发送与回复。
- 打包服务器通过独立启动、MCP、命令查询、备份及服务访问控制冒烟测试。

2026-11-09 已通过 GitHub Actions 发布 AMD64/ARM64 镜像并部署到 VPS，完成 Hermes/Tailscale 卸载及备份。网页通过真实模型和独立 CUA 查询并向本机 Codex 桌面发送指令，定时观察在容器重建后继续运行。飞书接入已取消，详见 [部署、使用与验收记录](rethos-vps.md)。

Windows 独立打包和发布入口为 `package-win.yml`，包含安装、启动和更新元数据校验，使用方法见 [发布文档](releasing.md)。全平台 Release 改为手动入口，macOS 延后。

2026-11-09 已完成 Windows `0.1.149` 的构建、实际安装启动与 Release 发布，产物包括安装程序、便携 ZIP、更新元数据、SHA256 和构建来源。116 项相关回归测试通过，安装后的桌面写操作鉴权已验证。记录见 [Actions 42551723554](https://github.com/Hopesy/Rethos/actions/runs/42551723554)。

本地 npm 安装包仍保留。公共 npm 发布和桌面代码签名另行配置。
