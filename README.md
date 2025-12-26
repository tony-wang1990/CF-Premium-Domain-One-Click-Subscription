# ☁️ CloudFlare 优选域名 (CF-Optimizer)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-green.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

**CloudFlare 优选域名** 是一个现代化、高性能的 Cloudflare IP/域名 优选与测速工具。它不仅能自动收集全网优质的 Cloudflare 入口点,还提供**浏览器端真测速**功能,帮助您在本地网络环境下找到速度最快、延迟最低的连接节点。

最核心的功能是 **"一键生成优选订阅"**,它可以将您现有的普通节点瞬间裂变为几十个负载均衡的优选节点。

---

## ✨ 核心亮点

### 1. ⚡ 一键生成优选订阅 (Killer Feature)

这是本项目最强大的功能。您是否遇到过手里的节点速度不稳定,或者想用 CF 优选 IP 却不知道怎么配置到客户端？

* **节点裂变**: 只需输入您的原始节点链接(支持 VMess, VLESS, Trojan),系统会自动将其与几十个优选域名组合。
* **智能负载**: 生成的订阅包含多个不同的入口,让客户端自动选择最快线路。
* **高级过滤**: 支持设置**最大延迟限制**(如: 只选 <150ms 的节点)、**地区筛选**(如: 只选 🇭🇰 香港节点)。
* **客户端直连**: 生成的订阅链接可直接导入 v2rayN、Clash 等客户端,无需额外转换。

![订阅生成功能](./client/public/docs/preview_feature.png)

### 2. 🚀 浏览器端真连接测速

* **拒绝模拟**: 不同于传统的后端 Ping,本项目使用浏览器直接发起 HTTP 请求。
* **真实延迟**: 显示的延迟(ms)就是您当前网络到该域名的真实连接耗时。
* **智能排序**: 测速完成后,点击排序按钮,速度最快的域名会自动排到第一位。

### 3. 🌐 全面的域名库

* **官方优选**: 收录 Visa, Shopify 等官方大厂 CDN 域名,稳如老狗。
* **运营商直连**: 专门收录移动 (CM)、联通 (CU)、电信 (CT) 的优化线路。
* **多地区显示**: 贴心标注域名所属/优化地区(🇺🇸 美国、🇭🇰 香港、🇸🇬 新加坡等),方便按需选择。

### 4. 🎨 现代化 UI 设计

* **精美界面**: Glassmorphism 毛玻璃风格,支持 **浅色/深色 (Light/Dark)** 模式一键切换。
* **响应式布局**: 完美适配 PC、平板、手机,随时随地管理节点。
* **实时图表**: 内置延迟走势图,丢包率一目了然。

![项目主页](./client/public/docs/home_clean.png)

---

## 🚀 快速部署

### 方式一: Docker 部署 (⭐ 推荐)

**一键启动**:

```bash
git clone https://github.com/tony-wang1990/CF-Premium-Domain-One-Click-Subscription.git
cd CF-Premium-Domain-One-Click-Subscription
docker-compose up -d
```

访问 `http://localhost:3000` 即可使用。

**手动构建**:

```bash
# 构建镜像
docker build -t cf-optimizer .

# 运行容器
docker run -d \
  --name cf-optimizer \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  cf-optimizer
```

**更新镜像**:

```bash
docker-compose pull
docker-compose up -d
```

---

### 方式二: VPS 部署

**环境要求**:
* Node.js >= 18.x
* npm / yarn
* (可选) Nginx 做反向代理

**步骤**:

1. **克隆项目**

   ```bash
   git clone https://github.com/tony-wang1990/CF-Premium-Domain-One-Click-Subscription.git
   cd CF-Premium-Domain-One-Click-Subscription
   ```

2. **安装依赖**

   ```bash
   # 后端
   cd server
   npm install
   npm run build

   # 前端
   cd ../client
   npm install
   npm run build
   ```

3. **启动服务**

   ```bash
   cd ../server
   NODE_ENV=production PORT=3000 node dist/index.js
   ```

4. **使用 PM2 保持运行** (推荐)

   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name cf-optimizer
   pm2 save
   pm2 startup
   ```

5. **配置 Nginx** (可选,用于域名访问)

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

---

### 方式三: 一键部署到云平台

#### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/cloudflare-optimizer)

#### Zeabur

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/cloudflare-optimizer)

#### Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

> **注意**: 一键部署后需要等待约 3-5 分钟进行初始化构建。

---

## 📖 使用指南

### 如何寻找最快节点?

1. 打开首页,点击右上方的 **"🚀 全局测速"** 按钮。
2. 等待几秒钟,直到所有卡片上的"测速"变为具体的毫秒数(如 `120ms`)。
3. 点击上方的 **"📶 按延迟(低→高)"** 按钮。
4. 排在第一个的域名就是您当前网络环境下最快的 Cloudflare 入口!

### 如何制作优选订阅?

1. 点击页面中央巨大的绿色按钮 **"⚡ 一键生成优选订阅"**。
2. 在弹窗中粘贴您的原始节点链接(例如 `vmess://...`)。
3. (可选)在高级选项中填入限制,例如最大延迟 `200`。
4. 点击"立即生成",复制结果链接。
5. 打开 v2rayN -> 订阅组 -> 添加订阅 -> 粘贴链接 -> 更新订阅。
6. 享受起飞的速度!

---

## 🛠️ 本地开发

### 环境要求

- Node.js >= 16.x
* npm / yarn

### 步骤

1. **克隆项目**

   ```bash
   git clone https://github.com/tony-wang1990/CF-Premium-Domain-One-Click-Subscription.git
   cd CF-Premium-Domain-One-Click-Subscription
   ```

2. **安装依赖**

   ```bash
   # 后端
   cd server
   npm install

   # 前端
   cd ../client
   npm install
   ```

3. **启动服务** (需要两个终端)

   **终端1 - 后端**:

   ```bash
   cd server
   npm run dev
   # 运行在 http://localhost:3000
   ```

   **终端2 - 前端**:

   ```bash
   cd client
   npm run dev
   # 运行在 http://localhost:5173
   ```

4. **访问项目**
   打开浏览器访问 `http://localhost:5173`

---

## 📁 项目结构

```
CF-Premium-Domain-One-Click-Subscription/
├── client/                # 前端 Vue 3 项目
│   ├── src/
│   │   ├── App.vue       # 主组件
│   │   ├── main.ts       # 入口文件
│   │   └── components/   # 组件目录
│   └── package.json
├── server/                # 后端 Express 项目
│   ├── src/
│   │   ├── index.ts      # 服务入口
│   │   ├── services/     # 业务逻辑
│   │   │   ├── collector.ts     # 域名收集
│   │   │   └── subscription.ts  # 订阅生成
│   │   └── db.ts         # 数据库
│   └── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## ⚠️ 免责声明

本项目仅供学习与技术研究使用。请勿用于任何非法用途。项目中涉及的域名均为互联网公开信息收集。

---

## 📄 License

[MIT License](LICENSE)

---

Created with ❤️ by CloudFlare 优选团队
