# Open UI Demo

基于 **A2UI（Agent-to-User Interface）** 的 AI 聊天 + 交互界面渲染 Demo。左侧聊天面板通过 SSE 流式对话与 AI 交互，右侧面板实时渲染 AI 返回的 A2UI 交互界面（表单、卡片、按钮等），并支持用户操作回传（A2UI Action）。

## 技术栈

| 技术 | 版本 |
|------|------|
| React | 19.2 |
| TypeScript | 6.0 |
| Vite | 8.0 |
| Tailwind CSS | 4.3 |
| @a2ui/react | v0.10 |
| @a2ui/web_core | v0.10 |
| openai | v6.42（SSE 流式） |
| Vitest | 4.1 |
| Testing Library | — |

## 项目结构

```
src/
├── App.tsx              # 主布局（左右分栏）+ MessageProcessor + surfaces 管理
├── App.css              # 布局样式
├── main.tsx             # 应用入口
├── index.css            # 全局样式 + Tailwind
├── components/          # UI 组件
│   ├── ChatPanel.tsx    # 聊天面板（消息列表 + 输入框 + SSE 流式接收）
│   ├── ChatInput.tsx    # 消息输入框
│   ├── MessageList.tsx  # 消息列表容器
│   ├── MessageBubble.tsx# 单条消息气泡（文本 / A2UI 渲染）
│   └── A2UIPanel.tsx    # A2UI 渲染面板（右侧）
├── context/             # 状态管理
│   └── AppContext.tsx   # 全局状态（useReducer）：消息、surfaces、加载态
└── lib/                 # 核心逻辑
    ├── streamChat.ts    # OpenAI 兼容 SSE 流式客户端
    ├── messageRouter.ts # 消息分流器（文本 / A2UI 分离）
    ├── messageRouter.test.ts
    ├── integration.test.ts
    └── e2e.test.ts
```

### 模块职责

- **components/** — 纯 UI 组件，负责渲染聊天界面和 A2UI 交互界面
- **context/** — 全局状态管理，基于 `useReducer` 管理消息列表、A2UI surfaces、加载状态
- **lib/** — 核心业务逻辑：SSE 流式通信（`streamChat.ts`）、消息分流与解析（`messageRouter.ts`）

## 环境变量

在项目根目录创建 `.env` 文件：

```env
# OpenClaw Gateway 认证 token（必填）
OPENCLAW_GATEWAY_TOKEN=your_token_here
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 预览生产构建
pnpm preview
```

## 运行测试

```bash
# 运行所有测试
npx vitest

# 监听模式
npx vitest --watch

# 单次运行（CI）
npx vitest run
```

## 核心功能

### 左侧：聊天面板

- 输入消息后通过 SSE（Server-Sent Events）流式发送到 AI 服务
- 实时流式展示 AI 回复文本
- 消息分流器自动识别 A2UI 指令，将其路由到右侧面板

### 右侧：A2UI 渲染面板

- 解析 AI 返回的 A2UI JSON，动态渲染交互界面（表单、卡片、按钮等）
- 用户在 A2UI 界面上的操作（点击按钮、提交表单等）通过 **A2UI Action** 机制回传给 AI
- 支持多 surface 管理，可同时展示多个 A2UI 界面

### 数据流

```
用户输入 → SSE 流式请求 → AI 响应
                              ├── 文本 → 左侧消息气泡
                              └── A2UI JSON → 右侧渲染面板
                                              └── 用户操作 → Action 回传 → AI
```

## License

MIT
