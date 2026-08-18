require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 30001;

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// multer 配置：内存存储，限制单文件 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ---------- 提取智谱 Key 的中间件 ----------
function extractZhipuKey(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header. Expected: Bearer <zhipu-api-key>' });
  }
  const apiKey = authHeader.slice(7);
  if (!apiKey || apiKey.length < 10) { // 简单校验
    return res.status(401).json({ error: 'Invalid API key format' });
  }
  req.zhipuApiKey = apiKey; // 挂载到 req 上供后续使用
  next();
}

// ---------- SSE 路由 ----------
app.post('/chat', extractZhipuKey, upload.single('image'), async (req, res) => {
  // 检查文件与问题
  if (!req.file) {
    return res.status(400).json({ error: 'Missing image file' });
  }
  const question = req.body.question || '请描述这张图片';
  const imageBuffer = req.file.buffer;
  const mimeType = req.file.mimetype || 'image/jpeg';

  // 设置 SSE 响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // 禁用 nginx 缓冲
  });

  // 辅助函数：发送 SSE 事件
  const sendSSE = (data) => {
    if (data) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };
  const sendError = (message) => {
    res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  };

  try {
    // 将图像转为 Base64 Data URL
    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    // 构造智谱 API 请求体
    const payload = {
      model: 'glm-4.6v-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: question },
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      stream: true,
    };

    // 调用智谱 API（流式），使用客户端提供的 Key
    const response = await axios({
      method: 'POST',
      url: ZHIPU_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.zhipuApiKey}`, // 使用客户端 Key
      },
      data: payload,
      responseType: 'stream',
      timeout: 60000,
    });

    // 处理流式响应
    const stream = response.data;
    let buffer = '';

    stream.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            res.write('event: done\ndata: {}\n\n');
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            sendSSE(parsed);
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    });

    stream.on('end', () => {
      if (!res.writableEnded) {
        res.write('event: done\ndata: {}\n\n');
        res.end();
      }
    });

    stream.on('error', (err) => {
      console.error('智谱流错误:', err);
      if (!res.writableEnded) {
        sendError('模型响应流异常');
        res.end();
      }
    });

    req.on('close', () => {
      stream.destroy();
    });

  } catch (error) {
    console.error('请求智谱失败:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to call GLM-4V-Flash' });
    } else {
      sendError('内部错误');
      res.end();
    }
  }
});

// ---------- 启动服务 ----------
app.listen(port, () => {
  console.log(`SSE 服务运行在 http://localhost:${port}`);
  console.log('客户端需在 Authorization 头中携带 Bearer <zhipu-api-key>');
});