# 本机只读文件 MCP

Rethos 的统一电脑接入与 Bot 权限联动见 [原生电脑通道](../desktop/CONNECTED-COMPUTER.md)。此独立入口适用于只需固定目录只读能力的 MCP 客户端。

为远端 Bot 提供 `list_roots`、`list_files` 和 `read_file`。复用桌面文件访问的路径与文件身份检查，通过现有 SSH 隧道连接本机，按配置的具体目录授权。读取支持大文件分段、文件末尾和增量偏移；工具提供文件大小、修改时间和文件身份。

需要 Node.js 24。生成独立运行文件：

```powershell
node deploy/local-files/build.mjs .Rethos-temp/local-files/local-files.mjs
```

配置示例：

```json
{
  "roots": [
    { "name": "Codex sessions", "path": "C:\\Users\\zhouh\\.codex\\sessions" },
    { "name": "Codex archive", "path": "C:\\Users\\zhouh\\.codex\\archived_sessions" },
    { "name": "Claude Code projects", "path": "C:\\Users\\zhouh\\.claude\\projects" }
  ]
}
```

用固定启动命令 `node local-files.mjs read-only-roots.json` 配置标准 MCP stdio。远端使用独立 SSH 密钥和固定命令，复用已有的反向端口；配置文件由本机用户维护。默认不启动模型，不写文件，不恢复会话。

`list_files` 支持 `sort: "modified"` 和分页。先读文件头确认项目，再用 `tail: true` 读取最新记录；后续传入返回的 `next_offset` 和 `file_id`，文件替换或截短会明确报错。文本片段按 UTF-8 边界切分，JSONL 记录可跨多个片段；需要完整记录时继续读取并拼接。单次默认 8 KiB，最多 32 KiB。

使用隔离目录的回归：`pnpm exec vitest run scripts/local-files.test.mjs`。已有共享目录的兼容回归：`node --test electron/shared-computer-access.node-test.mjs`。

## 通过现有桌面隧道部署

连接顺序为 Rethos 容器 → VPS 固定命令 → Windows SSH → Node 文件工具。复用桌面的反向 SSH 端口，文件服务与 CUA 各自使用独立的 MCP 配置。文件进程按连接启动，标准输入关闭后退出。

1. 将构建出的 `local-files.mjs` 和目录配置放到本机固定目录，例如 `C:\Users\zhouh\agent\rethos-local-files`。Node 使用绝对路径。配置只列出需要分享的子目录。
2. 在 VPS 建立固定代理脚本，使用现有桌面 SSH 配置执行本机的 `node.exe local-files.mjs read-only-roots.json`。Windows 参数通过 PowerShell `-NoProfile -NonInteractive -EncodedCommand` 传入，命令按 UTF-16LE 编码。设置 `$OutputEncoding` 与 `[Console]::OutputEncoding` 为无 BOM 的 UTF-8，保留 MCP 的中文输出。
3. 为容器生成专用 Ed25519 密钥，私钥保存在持久卷 `/data/.ssh/rethos-local-files/id_ed25519`，权限 `600`，目录 `700`，归属容器运行用户。将公钥添加到 VPS 用户的 `authorized_keys`，设置 `restrict,command="/绝对路径/files-proxy"`。
4. 容器的专用 SSH 配置复用已有的 VPS 主机指纹，启用 `StrictHostKeyChecking yes`、`BatchMode yes` 和 `IdentitiesOnly yes`。先从容器启动 MCP，验证发现工具、列目录和分段读取，再在 Rethos 添加并启用服务器：

```json
{
  "name": "zhouh-local-files",
  "command": "ssh",
  "args": ["-T", "-F", "/data/.ssh/rethos-local-files/config", "rethos-local-files"]
}
```

更新前备份本机 bundle、目录配置、VPS 代理与 `authorized_keys`。修改分享目录后，重新连接该 MCP，使配置生效。临时停用时关闭 Rethos 中的 `zhouh-local-files`；撤销连接时移除其专用公钥。读取期间保持本机在线、SSH 隧道可用。

可直接发送给 Bot：

> 使用 zhouh-local-files，先列出共享目录，再查找 Rethos 项目最近的 Codex 和 Claude Code 会话。读取文件头确认项目，读取末尾汇总进度、问题和下一步。只读分析。

隔离工作流与部署验收见 [验证记录](../../docs/verification/local-files.md)。
