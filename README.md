# glm4v-mcp

将智谱 [GLM-4V](https://open.bigmodel.cn/) 视觉模型封装为 MCP 服务器（Streamable HTTP 传输），通过 `analyze_image` 工具分析图片（支持本地图片路径或 Data URL）。

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

可选环境变量：`MCP_PORT`（默认 30002）、`GLM_MODEL`（默认 `glm-4v-flash`）。

## 启动服务

```bash
npx glm4v-mcp
```

启动后服务监听在 `http://localhost:30002/mcp`。

## 注册到 Claude Code

```bash
claude mcp add --transport http glm4v http://localhost:30002/mcp
```

## 工具：analyze_image

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `image` | string | 是 | 本地图片路径，或 `data:image/...;base64,....` 形式的 Data URL |
| `question` | string | 否 | 对图片的提问，默认「请描述这张图片」 |

支持的本地图片格式：png / jpg / jpeg / webp / gif。

## 注意

- 服务进程需保持运行，Claude Code 才能连接
- 调用会消耗智谱 API 额度，费用以智谱平台计费为准

## License

MIT
