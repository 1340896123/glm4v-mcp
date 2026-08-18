#!/usr/bin/env node
// glm4v-mcp.mjs
// 将智谱 GLM-4V 视觉模型封装为 MCP 服务器（Streamable HTTP 传输）
// 注册到 Claude Code：
//   claude mcp add --transport http glm4v http://localhost:30002/mcp
// 需要 .env 中配置：ZHIPU_API_KEY=xxxxx
import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import axios from 'axios';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const PORT = process.env.MCP_PORT || 30002;
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
const MODEL = process.env.GLM_MODEL || 'glm-4v-flash';

if (!ZHIPU_API_KEY) {
  console.warn('警告: 未设置 ZHIPU_API_KEY（.env），调用 analyze_image 工具时会失败');
}

// ---------- 创建 MCP Server（每个连接独立实例） ----------
function createServer() {
  const server = new Server(
    { name: 'glm4v-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // 工具清单
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'analyze_image',
        description:
          '使用智谱 GLM-4V 视觉模型分析图片（支持本地图片路径或 data URL），返回图片内容的文字描述。',
        inputSchema: {
          type: 'object',
          properties: {
            image: {
              type: 'string',
              description: '本地图片路径，或 data:image/...;base64,.... 形式的 Data URL',
            },
            question: {
              type: 'string',
              description: '对图片的提问，默认：请描述这张图片',
            },
          },
          required: ['image'],
        },
      },
    ],
  }));

  // 工具调用
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== 'analyze_image') {
      throw new Error(`未知工具: ${request.params.name}`);
    }
    try {
      const { image, question = '请描述这张图片' } = request.params.arguments ?? {};
      if (!image) throw new Error('缺少必填参数 image');

      // 支持两种传入方式：data URL 或本地文件路径
      let dataUrl = image;
      if (!image.startsWith('data:')) {
        const buf = await fs.readFile(image);
        const ext = path.extname(image).toLowerCase();
        const mime =
          {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
          }[ext] || 'image/jpeg';
        dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
      }

      const text = await callGlm4v(dataUrl, question);
      return { content: [{ type: 'text', text }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `调用 GLM-4V 失败: ${error.message}` }],
        isError: true,
      };
    }
  });

  return server;
}

// ---------- 调用智谱 API ----------
async function callGlm4v(dataUrl, question) {
  const payload = {
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: question },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  };

  const resp = await axios.post(ZHIPU_API_URL, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ZHIPU_API_KEY}`,
    },
    timeout: 60000,
  });

  let text = resp.data?.choices?.[0]?.message?.content;
  if (Array.isArray(text)) {
    text = text.map((p) => p.text || '').join('');
  }
  if (!text) throw new Error('智谱 API 未返回内容');
  return text;
}

// ---------- HTTP 传输（Streamable HTTP, 端点 /mcp, 每会话独立 Server） ----------
const app = express();
app.use(express.json({ limit: '20mb' }));

const sessions = new Map(); // sessionId -> { transport, server }

// 统一入口：已有会话直接复用；新连接创建 transport + server，
// 处理完请求后再注册（SDK 在首个 initialize 时生成 sessionId）
async function handleMcpRequest(req, res) {
  const sessionId = req.headers['mcp-session-id'];

  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      res.status(400).json({ error: '未知的 mcp-session-id' });
      return;
    }
    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  // 显式传入 sessionIdGenerator 以启用状态模式（SDK 默认是无状态）
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });
  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);

  const id = transport.sessionId;
  if (id) {
    sessions.set(id, { transport, server });
    transport.onclose = () => sessions.delete(id); // 会话关闭时清理
  }
}

app.post('/mcp', async (req, res) => {
  try {
    await handleMcpRequest(req, res);
  } catch (error) {
    console.error('MCP 请求处理失败:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal MCP server error' });
    }
  }
});

app.get('/mcp', async (req, res) => {
  try {
    await handleMcpRequest(req, res);
  } catch (error) {
    console.error('MCP SSE 连接失败:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal MCP server error' });
    }
  }
});

app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const session = sessions.get(sessionId);
  if (session) {
    await session.transport.close();
    sessions.delete(sessionId);
  }
  res.status(200).json({});
});

// ---------- 启动服务 ----------
app.listen(PORT, () => {
  console.log(`GLM-4V MCP 服务运行在 http://localhost:${PORT}/mcp`);
});
