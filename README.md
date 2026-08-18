# glm4v-mcp

将智谱 [GLM-4V](https://open.bigmodel.cn/) 视觉模型封装为 MCP 服务器，通过 `analyze_image` 工具分析图片（支持本地图片路径或 Data URL）。

- 已发布到 npm：[glm4v-mcp](https://www.npmjs.com/package/glm4v-mcp)
- 使用 [Model Context Protocol](https://modelcontextprotocol.io/) 标准协议，可接入任何支持 MCP 的客户端

## 功能特性

- 🖼️ **图片分析**：`analyze_image` 工具，支持本地图片路径与 Data URL
- 🧠 **GLM-4V 视觉模型**：默认 `glm-4v-flash`（免费），可通过环境变量切换
- 🔌 **双传输模式**：`stdio`（进程直接拉起，推荐）与 `http`（Streamable HTTP，支持远程部署）
- 🌐 **远程访问**：HTTP 模式部署到服务器后，可被局域网/公网的 MCP 客户端连接

## 环境要求

- Node.js ≥ 20
- 智谱 API Key（[开放平台申请](https://open.bigmodel.cn/usercenter/apikeys)），模型默认 `glm-4v-flash`

## 配置 API Key

三种方式任选其一（优先级：**请求头 > 环境变量 > .env**）：

```bash
# 方式一：请求头（每次请求传入，支持不同客户端用不同 key）
# 在 MCP 客户端配置中加 headers（见下方「使用 MCP」章节）

# 方式二：环境变量
export ZHIPU_API_KEY=你的key

# 方式三：在启动目录创建 .env
ZHIPU_API_KEY=你的key
```

### 环境变量一览

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `ZHIPU_API_KEY` | — | **必填**（服务端配置时），智谱 API Key |
| `MCP_PORT` | `30002` | 服务监听端口 |
| `GLM_MODEL` | `glm-4v-flash` | 智谱模型名，可换 `glm-4v-plus` 等 |

## 部署方式

### 方式一：npx 直接运行（最快）

```bash
# stdio 模式（推荐）：由 MCP 客户端直接拉起进程，无需手动启动
npx glm4v-mcp --stdio

# http 模式：手动启动，服务监听在 http://localhost:30002/mcp
npx glm4v-mcp
```

`MCP_TRANSPORT=stdio` 环境变量等效于 `--stdio` 参数。

### 方式二：源码运行

```bash
git clone https://github.com/1340896123/glm4v-mcp.git
cd glm4v-mcp
npm install
npm start  # 或 node glm4v-mcp.mjs
```

### 方式三：Docker 部署

本地构建运行：

```bash
docker build -t glm4v-mcp .
docker run -d -p 30002:30002 -e ZHIPU_API_KEY=你的key --name glm4v-mcp glm4v-mcp
```

### 方式四：远程服务器部署（公网访问）

适用于把服务部署到云服务器，供局域网或公网设备上的 MCP 客户端连接。

```bash
# 1. 服务器上安装 Node.js ≥ 20 或 Docker，然后任选方式一/二/三启动
# 2. 确保防火墙放行端口：
ufw allow 30002/tcp   # Ubuntu 防火墙示例

# 3. 验证本机可访问：
curl -X POST http://localhost:30002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

#### 建议用进程管理器保持服务常驻

```bash
# pm2 方式
npm i -g pm2
pm2 start glm4v-mcp.mjs --name glm4v-mcp
pm2 save && pm2 startup

# 或 systemd（Linux）方式：/etc/systemd/system/glm4v-mcp.service
# [Service]
# ExecStart=/usr/bin/node /opt/glm4v-mcp/glm4v-mcp.mjs
# Restart=always
# Environment=ZHIPU_API_KEY=你的key
# [Install]
# WantedBy=multi-user.target
```

## 使用 MCP（客户端连接）

### Claude Code（stdio 模式，推荐）

无需手动启动服务，Claude Code 会自动拉起进程。

#### 方式一：项目级 `.mcp.json` 配置（推荐：key 随配置走，不依赖启动目录的 `.env`）

在项目根目录创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "glm4v": {
      "command": "npx",
      "args": ["-y", "glm4v-mcp", "--stdio"],
      "env": {
        "GLM_MODEL": "glm-4.6v-flash",
        "ZHIPU_API_KEY": "你的key"
      }
    }
  }
}
```

> `env` 块中的变量以环境变量形式传给进程，**优先级高于 `.env` 文件**（dotenv 不覆盖已存在的环境变量）。`.mcp.json` 含 API Key，建议加入 `.gitignore`，避免 key 提交到仓库。

#### 方式二：命令行注册

```bash
claude mcp add glm4v -- npx -y glm4v-mcp --stdio

# 查看连接状态
claude mcp list

# 重启会话后即可使用，或在会话中执行 /mcp 查看
```

### Claude Code（http 模式，本机）

先启动服务，再注册：

```bash
npx glm4v-mcp  # 启动服务（保持运行）

# 注册（一次即可，配置写入 ~/.claude.json）
claude mcp add --transport http glm4v http://localhost:30002/mcp
```

### Claude Code（http 模式，远程服务器）

服务部署在服务器（如 `http://192.168.1.100:30002/mcp`）时，本地无需启动服务：

```bash
claude mcp add --transport http glm4v http://192.168.1.100:30002/mcp
```

### 其他 MCP 客户端（Claude Desktop / Cursor 等）

**stdio 方式**（Claude Desktop 的 `claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "glm4v": {
      "command": "npx",
      "args": ["-y", "glm4v-mcp", "--stdio"],
      "env": {
        "GLM_MODEL": "glm-4.6v-flash",
        "ZHIPU_API_KEY": "你的key"
      }
    }
  }
}
```

**http 方式**（Claude Desktop / Cursor 等支持 HTTP 的客户端）：

```json
{
  "mcpServers": {
    "glm4v": {
      "type": "http",
      "url": "http://localhost:30002/mcp"
    }
  }
}
```

远程服务器则把 `url` 换成服务器地址。

### 通过请求头传入 API Key（可选）

服务端未配置 `ZHIPU_API_KEY` 时，可在客户端配置中通过 `headers` 传入（服务端会优先使用请求头中的 key）：

```json
{
  "mcpServers": {
    "glm4v": {
      "type": "http",
      "url": "http://localhost:30002/mcp",
      "headers": {
        "ZHIPU_API_KEY": "你的key"
      }
    }
  }
}
```

命令行方式（Claude Code）：

```bash
claude mcp add --transport http glm4v http://localhost:30002/mcp \
  --header "ZHIPU_API_KEY=你的key"
```

> 注：`ZHIPU_API_KEY` 为 HTTP 请求头名，Node 服务端以小写 `zhipu_api_key` 读取，客户端原样发送即可。

## 工具：analyze_image

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `image` | string | 是 | 本地图片路径，或 `data:image/...;base64,....` 形式的 Data URL |
| `question` | string | 否 | 对图片的提问，默认「请描述这张图片」 |

支持的本地图片格式：png / jpg / jpeg / webp / gif。

## 常见问题

**1. 连接不上 / 报错 `ECONNREFUSED`**
服务没启动或端口不对。确认先运行 `npx glm4v-mcp`（或 Docker 容器），且 `MCP_PORT` 与注册的 URL 端口一致。

**2. 调用报 `401`**
`ZHIPU_API_KEY` 缺失或无效。检查服务启动时是否加载了 `.env`（服务需在含 `.env` 的目录启动），或直接在环境变量中设置。

**3. 服务必须保持运行**
HTTP 传输模式下客户端通过端口实时连接，服务进程停止后工具立即不可用。生产环境请用 pm2 / systemd / Docker 保持常驻。

**4. stdio 模式 key 加载不到**
stdio 模式的进程由客户端拉起（如 `npx`），`.env` 需位于客户端启动目录。最稳妥的做法：在客户端配置（`.mcp.json` / `claude_desktop_config.json`）的 `env` 块中直接写 `ZHIPU_API_KEY`（见上方示例），key 随配置走，与启动目录无关。

**5. 远程访问提示超时**
确认云服务器安全组/防火墙放行了对应端口，且客户端能 `ping` 通服务器。

## License

MIT
