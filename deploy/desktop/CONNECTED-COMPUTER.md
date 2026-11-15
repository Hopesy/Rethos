# 通过原生电脑通道接入

将 Windows 本机登记为 Rethos 的已连接电脑，统一提供文件、终端和桌面工具。服务端使用现有 `list_shared_computers`、`shared_computer` 工具，以及 Bot／会话的权限模式。连接器复用桌面应用的电脑共享协议、文件执行器、CUA 适配器、在线状态、任务租约与取消流程。

## 权限

连接自己的服务器时，可在“电脑访问”中启用“跟随 Bot 权限”。普通模式直接访问已授权目录，其他目录和写入升级使用现有授权卡片；目录授权作用于当前 Bot 的本次任务及其子目录。完全访问模式可读写当前系统账号可访问的所有目录。终端和桌面能力仍由本机连接设置启用，调用时遵循当前会话的权限模式。

服务器验证操作所属的 Bot、会话、任务代次和电脑所有者，然后生成文件授权范围。本机仅在用户启用了跟随权限时接受这一范围，模型工具参数没有权限字段。停止任务、撤销电脑连接或降低权限后，排队及尚在运行的操作通过原有租约机制取消。

## 独立连接器

只运行电脑连接、不启动本地 Rethos 服务时，可使用同一实现的后台入口。需要 Node.js 24 和本机已运行的 CUA。

```powershell
node deploy/desktop/build-connected-computer.mjs .Rethos-temp/connected-computer/lib/connected-computer.cjs
```

安装目录中保留 `lib/connected-computer.cjs`、`Start-ConnectedComputer.ps1`、`computer.json`、访问令牌文件，以及 `src/locales/en.json`、所需语言的语言包。访问令牌文件仅供当前用户读取。

```json
{
  "origin": "https://rethos.example.com",
  "environmentId": "服务器的 environmentId",
  "name": "Rethos",
  "tokenFile": "C:\\RethosComputer\\access-token.txt",
  "botPermissions": true,
  "terminal": true,
  "folders": [
    { "name": "Codex sessions", "path": "C:\\Users\\me\\.codex\\sessions", "write": false }
  ],
  "cua": {
    "command": "C:\\Tools\\cua-driver.exe",
    "args": ["mcp", "--socket", "\\\\.\\pipe\\cua-driver"]
  }
}
```

`environmentId` 从已登录服务器的环境描述读取，启动时固定核验。令牌需属于自己的服务器的管理员连接。使用同一访问令牌登录的浏览器和连接器具有一致的电脑所有者身份。

启动命令：

```powershell
.\Start-ConnectedComputer.ps1 -ConfigPath C:\RethosComputer\computer.json `
  -NodePath 'C:\Program Files\nodejs\node.exe' `
  -ConnectorPath C:\RethosComputer\lib\connected-computer.cjs
```

后台启动可使用同目录的 `BackgroundLauncher.exe`。启动脚本保证每个服务器一个进程，记录输出并在断线后重连。首次连接将授权和电脑身份保存在 `computer-sharing.json`，重启沿用该身份。停用连接器及其启动项后，服务端显示电脑离线。

## 旧 MCP 迁移

先验证原生电脑上线及其文件、终端、桌面能力，再停用旧 CUA MCP 和独立只读文件 MCP。保留配置备份便于回退。Bot 后续通过电脑 ID 选择同一台电脑；模型的文件路径始终属于选中的电脑。

验证流程见 [原生电脑权限验收](../../docs/verification/connected-computer.md)。
