# 初中英语教学AI助手

基于 DeepSeek AI 的初中英语教学助手网站，提供三大核心功能：教案设计、作文评价、试卷评讲。

## 功能介绍

### 1. 教案设计 📚
- 基于语篇深度解读理念
- 生成四个配套文件：教案、学生任务单、分层写作指导、PPT框架
- 支持七/八/九年级
- 写作环节分层设计（L1基础/L2标准/L3拓展）

### 2. 作文评价 ✍️
- 基于中考10分制评分标准
- 逐句标注问题
- 给出分层改进建议
- 提供修改示范

### 3. 试卷评讲 📝
- 上传成绩Excel，自动分析错误率
- 上传试卷文件（.docx/.txt）
- 按错误率从高到低生成评讲顺序
- 支持导出为Markdown

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **AI**: DeepSeek API (deepseek-chat)
- **部署**: Vercel

## 本地开发

### 前置条件

- Node.js 18+
- npm / yarn / pnpm
- DeepSeek API Key

### 安装步骤

1. **克隆项目**
```bash
git clone <your-repo-url>
cd edu-english-ai
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.local.example .env.local
```

编辑 `.env.local` 文件，填入你的 DeepSeek API Key：
```
DEEPSEEK_API_KEY=your_api_key_here
```

4. **启动开发服务器**
```bash
npm run dev
```

5. **打开浏览器**
访问 http://localhost:3000

## 获取 DeepSeek API Key

1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/)
2. 注册/登录账号
3. 进入 API Keys 页面
4. 创建新的 API Key
5. 复制并保存（请妥善保管，不要泄露）

## Vercel 部署

### 方式一：通过 GitHub 部署（推荐）

1. **推送代码到 GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/edu-english-ai.git
git push -u origin main
```

2. **创建 Vercel 项目**
- 访问 [vercel.com](https://vercel.com)
- 使用 GitHub 账号登录
- 点击 "New Project"
- 选择你的仓库
- 点击 "Deploy"

3. **配置环境变量**
- 在 Vercel 项目设置中，找到 "Environment Variables"
- 添加 `DEEPSEEK_API_KEY` 和对应的值

4. **访问网站**
- 部署完成后，Vercel 会提供访问地址
- 例如：`https://edu-english-ai.vercel.app`

### 方式二：通过 Vercel CLI 部署

1. **安装 Vercel CLI**
```bash
npm install -g vercel
```

2. **登录 Vercel**
```bash
vercel login
```

3. **部署项目**
```bash
vercel
```

4. **设置生产环境**
```bash
vercel --prod
```

## 自定义域名绑定

### 在 Vercel 中配置

1. 进入 Vercel 项目控制台
2. 点击 "Settings" → "Domains"
3. 输入你的域名，点击 "Add"
4. 按照提示在域名 DNS 中添加记录

### DNS 配置示例

根据你的域名服务商，添加以下记录：

| 类型 | 名称 | 值 |
|------|------|-----|
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

### 验证域名

- DNS 更改后，通常需要几分钟到48小时生效
- 在 Vercel Domains 页面点击 "Check DNS Configuration" 验证

## 项目结构

```
edu-english-ai/
├── app/
│   ├── layout.tsx          # 全局布局
│   ├── page.tsx            # 首页
│   ├── globals.css         # 全局样式
│   ├── lesson-design/      # 教案设计页面
│   ├── essay-eval/         # 作文评价页面
│   ├── exam-review/        # 试卷评讲页面
│   └── api/                # API路由
│       ├── lesson-design/
│       ├── essay-eval/
│       └── exam-review/
├── components/             # React组件
│   ├── ChatInterface.tsx
│   ├── FileUpload.tsx
│   ├── Header.tsx
│   └── MarkdownRenderer.tsx
├── lib/                    # 工具函数
│   ├── deepseek.ts        # DeepSeek API客户端
│   ├── prompts.ts         # System Prompt
│   └── excel-parser.ts    # Excel解析
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

## Excel 格式要求

试卷评讲功能需要上传符合以下格式的成绩 Excel：

### "全卷" Sheet 结构

| 列 | 内容 | 说明 |
|----|------|------|
| 0-3 | 姓名、准考证号、自定义考号、班级 | 学生信息 |
| 4 | 笔试总分 | |
| 5 | 口语 | |
| 6 | 笔试（另一列） | |
| 7-16 | 第31-40题得分 | 语法选择，每题1分 |
| 17 | 语法选择总分 | |
| 18-27 | 第41-50题得分 | 完型填空，每题1分 |
| 28 | 完型填空总分 | |
| 29-43 | 第51-65题得分 | 阅读理解，每题2分 |
| 44 | 阅读理解总分 | |
| 45 | 66-70总分 | 短文填空 |
| 46 | 71-75总分 | 回答问题 |
| 47 | 短文填空总分 | |
| 48 | 回答问题总分 | |
| 49 | 作文 | |

## 常见问题

### Q: API Key 如何保护？
A: 建议将 API Key 存储在环境变量中，不要硬编码在代码里。Vercel 部署时在项目设置中配置。

### Q: 请求超时怎么办？
A: 可以调整 API 的 max_tokens 参数或设置更长的超时时间。

### Q: 支持哪些文件格式？
A: 教案评价支持 .txt/.docx/.pdf；试卷支持 .txt/.docx。

## License

MIT License
