# glm4v-mcp

将智谱 [GLM-4V](https://open.bigmodel.cn/) 视觉模型封装为 MCP 服务器（Streamable HTTP 传输），通过 `analyze_image` 工具分析图片（支持本地图片路径或 Data URL）。

- 已发布到 npm：[glm4v-mcp](https://www.npmjs.com/package/glm4v-mcp)
- 使用 [Model Context Protocol](https://modelcontextprotocol.io/) 标准协议，可接入任何支持 MCP 的客户端

## 功能特性

- 🖼️ **图片分析**：`analyze_image` 工具，支持本地图片路径与 Data URL
- 🧠 **GLM-4V 视觉模型**：默认 `glm-4v-flash`（免费），可通过环境变量切换
- 🔌 **Streamable HTTP 传输**：标准 MCP 协议，本地/远程部署均可
- 🌐 **远程访问**：部署到服务器后，可被局域网/公网的 MCP 客户端连接

## 环境要求

- Node.js ≥ 20
- 智谱 API Key（[开放平台申请](https://open.bigmodel.cn/usercenter/apikeys)），模型默认 `glm-4v-flash`

## 配置 API Key

两种方式任选其一：

```bash
# 方式一：环境变量
export ZHIPU_API_KEY=你的key

# 方式二：在启动目录创建 .env
ZHIPU_API_KEY=你的key
```

### 环境变量一览

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `ZHIPU_API_KEY` | — | **必填**，智谱 API Key |
| `MCP_PORT` | `30002` | 服务监听端口 |
| `GLM_MODEL` | `glm-4v-flash` | 智谱模型名，可换 `glm-4v-plus` 等 |

## 部署方式

### 方式一：npx 直接运行（最快）

```bash
npx glm4v-mcp
```

启动后服务监听在 `http://localhost:30002/mcp`。

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

### Claude Code（本机）

先启动服务，再注册：

```bash
# 注册（一次即可，配置写入 ~/.claude.json）
claude mcp add --transport http glm4v http://localhost:30002/mcp

# 查看连接状态
claude mcp list

# 重启会话后即可使用，或在会话中执行 /mcp 查看
```

### Claude Code（远程服务器）

服务部署在服务器（如 `http://192.168.1.100:30002/mcp`）时，本地无需启动服务：

```bash
claude mcp add --transport http glm4v http://192.168.1.100:30002/mcp
```

### 其他 MCP 客户端（Claude Desktop / Cursor 等）

在客户端的 MCP 配置中（如 `claude_desktop_config.json` 或 Cursor 的 MCP 设置）添加：

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

**4. 远程访问提示超时**
确认云服务器安全组/防火墙放行了对应端口，且客户端能 `ping` 通服务器。

## License

MIT
