# Rethos VPS 部署与维护

## 镜像与模块

| 组件 | 作用 | 部署位置 |
| --- | --- | --- |
| `ghcr.io/hopesy/rethos` | Web、模型会话、工具、MCP 和调度 | VPS Docker |
| Caddy | HTTPS、网页和流式消息转发 | VPS |
| 独立 `cua-driver` | 读取并操作当前 Codex 桌面应用 | Windows 本机 |
| 反向 SSH 通道 | 本机主动连接 VPS，使 VPS 可调用本机 CUA | Windows → VPS |
| 数据卷 `/data` | 配置、会话、模型凭据和浏览器会话 | VPS 持久化卷 |

镜像内置 Claude Code、Codex CLI 与浏览器，用于 VPS 的模型执行和网页工具。桌面原会话的监控与发送经本机 CUA 完成。

镜像支持 AMD64 和 ARM64。`latest` 跟随 main 的成功构建；`sha-<完整提交号>` 标记对应源码；`@sha256:<摘要>` 可固定具体镜像内容。版本标签触发时另发布 `v*` 标签。

## 首次部署：域名与自动 HTTPS

准备 Docker Engine 和 Compose 插件，将域名 A/AAAA 指向 VPS，开放 80、443。镜像发布在 GHCR。

```sh
git clone https://github.com/Hopesy/ZelosBot.git Rethos
cd Rethos/deploy
cp .env.example .env
```

编辑 `.env`：

```dotenv
DOMAIN=rethos.example.com
COMPOSE_PROJECT_NAME=rethos
RETHOS_IMAGE=ghcr.io/hopesy/rethos:latest
```

启动并配对：

```sh
docker compose pull
docker compose up -d --no-build
docker compose ps
docker compose exec rethos rethos pair
```

在电脑或手机浏览器打开生成的链接。手机添加到主屏幕后可使用 Web 应用。账号和模型在页面配置，也可使用 `docker compose exec rethos rethos setup`。Codex 登录可运行 `docker compose exec rethos codex login --device-auth`。

两个容器共享网络命名空间；应用在容器回环地址监听，Caddy 对外提供经过配对认证的入口。持久化卷默认名为 `rethos_data`；内部数据路径沿用 `/data/.openmausbot`，配置环境变量继续兼容 `OMB_*`。

## VPS 已有 Caddy 或 Nginx

使用仓库根目录的 `compose.yaml`，把入口绑定在主机回环地址。已有代理负责域名和证书。例如：

```dotenv
COMPOSE_PROJECT_NAME=rethos
RETHOS_IMAGE=ghcr.io/hopesy/rethos:latest
OMB_BIND_ADDRESS=127.0.0.1
OMB_HTTP_PORT=8790
OMB_PUBLIC_URL=https://rethos.example.com
OMB_HTTPS_HOST=rethos.example.com
```

在仓库根目录执行 `docker compose pull && docker compose up -d --no-build`。主机 Caddy 配置：

```caddyfile
rethos.example.com {
    reverse_proxy 127.0.0.1:8790 {
        flush_interval -1
    }
}
```

保留 Host 和代理协议头；同机入口用于两层代理之间的连接。`OMB_HTTPS_HOST` 和 `OMB_PUBLIC_URL` 使用同一域名。

## 更新、备份、回退

在当前 Compose 目录运行。先记录已运行镜像：

```sh
docker inspect --format '{{.Image}}' "$(docker compose ps -q rethos)"
docker compose images
mkdir -p backups
docker compose stop
docker run --rm -v rethos_data:/source:ro -v "$PWD/backups:/backup" alpine:3.22 \
  sh -c 'tar czf /backup/rethos-data-$(date -u +%Y%m%d-%H%M%S).tgz -C /source .'
docker compose pull
docker compose up -d --no-build --force-recreate
docker compose ps
docker compose logs --tail 80 rethos
```

自定义 `OMB_DATA_VOLUME` 时将示例中的 `rethos_data` 替换为实际卷名。备份含配置和凭据，应限制文件访问。

回退时将 `.env` 的 `RETHOS_IMAGE` 改为上一版固定标签或摘要，再执行 `docker compose pull` 和 `docker compose up -d --no-build --force-recreate`。数据格式发生迁移时同时恢复升级前的卷备份。

停用：`docker compose down`，保留数据卷。完全删除数据时，先确认备份，再显式移除对应卷。

## 维护发布

修改源码后提交并推送 main。GitHub Actions 在原生 x86/ARM runner 上构建相同来源，分别验证启动、OSS 品牌、DuckDB、浏览器、CLI、HTTPS 配对、同源检查、事件流、重建后的数据和登录状态，再合并发布镜像清单。

镜像内带 LICENSE、NOTICE 和第三方归属信息。测试只使用专门创建的容器和临时数据卷。首次 GitHub Packages 发布后需确认包可见性和匿名拉取能力；成功发布的摘要显示在工作流 Summary 中。

## 本次迁移与验收待办

以下沿用桌面监控方案的顺序，实施时补充证据和结果。

- [ ] 发布 Rethos 镜像，核对平台、摘要和拉取。
- [ ] 备份 VPS 上 Hermes 的配置、数据、服务定义和相关 Caddy 配置。
- [ ] 卸载 VPS 的 Hermes 与 Tailscale，验证公网 SSH。
- [ ] 部署 Rethos HTTPS，完成浏览器配对与模型配置。
- [ ] 本机反向 SSH 建连、重连和开机启动。
- [ ] 自定义 MCP 接入本机 CUA：列出工具、读取窗口和画面。
- [ ] 绑定专用 Codex 桌面验收会话，查询实际进度。
- [ ] 网页向该会话发送“继续”，核对原会话接收和执行。
- [ ] 运行中追加要求，核对排队或接收状态。
- [ ] 设置定时观察，验证完成、提问、审批、失败和离线提示。
- [ ] 验证发送回执、去重与重启后的监控恢复。
- [ ] 手机网页访问、交互和通知实际验收。

每次发送使用明确选定的验收会话，记录发送前后的状态。临时脚本与证据放 `.Rethos-temp/`。生产配置及密钥留在受限目录。
