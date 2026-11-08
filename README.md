# Rethos

Rethos 基于 [OpenMausBot](https://github.com/milind-soni/OpenMausBot)，用于自部署 AI 助手、管理会话与工具，并为远程桌面任务监控提供基础。

本版本已移除上游 `enterprise/` 商业目录，产品名称统一为 **Rethos**，npm 包名和命令为 `rethos`。源码沿用已有仓库 [Hopesy/ZelosBot](https://github.com/Hopesy/ZelosBot)。

## 模块

| 路径 | 用途 |
| --- | --- |
| `server/` | 会话、模型、MCP、调度、访问控制和 HTTP 服务 |
| `src/`、`public/` | Web 界面及手机浏览器安装入口 |
| `electron/` | 桌面客户端和本机集成 |
| `scripts/` | 构建、验证和 npm 打包 |
| `companion/`、`connector/` | 上游设备连接与转发能力 |
| `skills/` | 内置技能 |
| `third_party/` | 第三方许可和归属信息 |

## 源码运行

需要 Node.js 24+ 和 pnpm 10.33.0。

```sh
git clone https://github.com/Hopesy/ZelosBot.git Rethos
cd Rethos
pnpm install --frozen-lockfile
pnpm check:oss
pnpm rethos --help
pnpm rethos
```

首次启动按终端引导配置模型。模型账号、API 和外部服务按供应商规则使用和计费。

Web 开发分别运行 `pnpm dev:server` 和 `pnpm dev`。桌面开发运行 `pnpm dev:desktop`。

## VPS 镜像部署

镜像统一为 **`ghcr.io/hopesy/rethos`**，支持 `linux/amd64` 和 `linux/arm64`，包含 Web、服务端、Chromium、Claude Code 和 Codex CLI。模型账号及 API 在部署后配置。

有域名并开放 80/443 的 VPS：

```sh
git clone https://github.com/Hopesy/ZelosBot.git Rethos
cd Rethos/deploy
cp .env.example .env
# 编辑 .env，设置 DOMAIN=rethos.example.com
docker compose pull
docker compose up -d --no-build
docker compose exec rethos rethos pair
```

打开命令生成的 HTTPS 配对链接，即可使用网页。手机浏览器使用同一地址，可添加到主屏幕。

日常更新：

```sh
docker compose pull
docker compose up -d --no-build --force-recreate
docker compose ps
```

发布由 [Rethos Docker image](https://github.com/Hopesy/ZelosBot/actions/workflows/docker.yml) 执行：在两种架构上构建并验证实际镜像，再发布 `latest` 和 `sha-<完整提交号>`。手动运行 main 分支也会发布；PR 执行构建验证。`.env` 中的 `RETHOS_IMAGE` 可固定到提交标签或摘要。

数据卷保留会话、配置、模型登录状态。升级前备份数据；完整步骤、已有反向代理、回滚与卸载见 [Rethos VPS 部署维护](docs/rethos-vps.md)。

## 源码构建和 npm 安装

```sh
pnpm typecheck
pnpm build
pnpm package:npm
cd release/npm
npm pack
```

将生成的 `rethos-<版本>.tgz` 复制到目标机器后安装：

```sh
npm install -g ./rethos-<版本>.tgz
rethos --help
rethos
```

以上命令使用本地构建产物。公共 npm 发布需要单独配置包所有权和发布认证。

桌面安装包使用 `pnpm package:win`、`pnpm package:mac` 或 `pnpm package:linux`，产物位于 `release/`。各平台依赖及签名要求见 `docs/`。

## VPS 与桌面任务

计划采用：VPS 运行 Rethos 服务端和 Web；本机运行 `cua-driver`，通过本机主动建立的反向 SSH 通道提供 MCP 访问。网页或手机发送请求后，由 Rethos 查看并操作本机 Codex 桌面原会话。

桌面接入、反向通道、任务监控与通知的实施验收记录见 [部署维护文档](docs/rethos-vps.md)。自部署可使用自己的 HTTPS 反向代理。

## 更新与卸载

更新前备份数据和配置，停止当前服务。源码更新后重新构建：

```sh
git pull --ff-only
pnpm install --frozen-lockfile
pnpm check:oss
pnpm package:npm
```

安装新版产物后重新启动服务：

```sh
npm install -g ./rethos-<新版本>.tgz
```

卸载：

```sh
npm uninstall -g rethos
```

卸载保留用户数据。默认沿用 `~/.openmausbot`，可通过 `--data-dir` 或 `OMB_DATA_DIR` 指定目录。

## 兼容性与许可

- 产品显示名称为 Rethos；内部 `OMB_*`、`OPENMAUSBOT_*` 配置、历史文件名、数据目录和协议标识保留兼容。
- `server/enterprise.ts` 是 Apache 开源核心的兼容接口；商业实现与授权签发代码已删除。
- 安装包更新指向已有的 `Hopesy/ZelosBot` 仓库。发布前需准备本仓库的安装包、更新元数据及签名。
- 保留原作者及依赖的版权归属，详见 [LICENSE](LICENSE)、[NOTICE](NOTICE)、[LICENSING.md](LICENSING.md)。
- 本次修改说明和验证步骤见 [docs/rethos.md](docs/rethos.md)。
