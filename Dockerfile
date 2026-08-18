FROM node:24-alpine

WORKDIR /app

# 先复制依赖清单，利用 Docker 层缓存
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 复制应用代码
COPY glm4v-mcp.mjs ./

EXPOSE 30002

# 运行时通过 -e ZHIPU_API_KEY=xxx 传入
CMD ["node", "glm4v-mcp.mjs"]
