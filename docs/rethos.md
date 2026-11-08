# Rethos 维护说明

2026-11-08，基于 OpenMausBot `d7ce39ea0`、版本 `0.1.149` 整理。

## 修改记录

- 移除专有许可的 `enterprise/` 全目录，以及专用于该目录的 CLA 和贡献者工作流。
- 服务端与 npm 构建取消商业模块打包，增加 `pnpm check:oss`。
- Web、语言包、默认助手、桌面提示和安装包的产品名称改为 Rethos。
- npm 包名和命令为 `rethos`，桌面应用标识为 `com.hopesy.rethos`。
- 保留 `LICENSE`、上游版权、`NOTICE` 和第三方许可。
- 更新来源指向已存在的 `Hopesy/ZelosBot` 仓库。
- 移除上游旧发布仓库的镜像同步流程，发布校验使用 Rethos 的安装包名称。
- Docker 镜像统一为 `ghcr.io/hopesy/rethos`，支持 AMD64/ARM64；发布前验证实际容器，Compose 使用预构建镜像更新。
- VPS 安装、升级、备份、回退和迁移验收统一见 [部署维护文档](rethos-vps.md)。
- 清理直接依赖已删除企业适配器的集成测试及相应验证文档。

## 兼容项

`OMB_*`、`OPENMAUSBOT_*` 环境变量、`~/.openmausbot` 数据目录、内部协议、API 标识和部分源文件名继续沿用，保持已有数据格式和设备连接行为。

上游服务名称与第三方下载地址保留真实归属。原生客户端、官方托管服务、OAuth 和移动推送的配置按实际部署逐项验收。

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

本次生成本地 npm 安装包。生产部署、公共 npm 发布和各平台桌面安装包签名另行执行。
