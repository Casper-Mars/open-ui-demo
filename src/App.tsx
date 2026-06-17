import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { A2uiSurface, basicCatalog, MarkdownContext } from "@a2ui/react/v0_9";
import { MessageProcessor, type SurfaceModel } from "@a2ui/web_core/v0_9";
import { AppProvider, useAppContext, type Message } from "./context/AppContext";
import { streamChat } from "./lib/streamChat";
import { messageRouter } from "./lib/messageRouter";
import ChatPanel from "./components/ChatPanel";
import A2UIPanel from "./components/A2UIPanel";

/**
 * 简单的 Markdown 渲染函数，用于 MarkdownContext.Provider。
 * 将 markdown 字符串渲染为 HTML。
 */
function renderMarkdown(markdown: string): Promise<string> {
  // 简单的 markdown → HTML 转换
  const html = markdown
    .replace(/### (.+)/g, "<h3>$1</h3>")
    .replace(/## (.+)/g, "<h2>$1</h2>")
    .replace(/# (.+)/g, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
  return Promise.resolve(html);
}

/**
 * AppWithA2UI - AppProvider 内部组件，可以安全使用 useAppContext
 *
 * 负责：
 * 1. 创建 MessageProcessor 并管理 surfaces 状态
 * 2. 定义 onAction 回调（需要 useAppContext）
 *
 * onAction 回调逻辑：
 * 1. 将 action 包装为 { userAction: action } 的 JSON 字符串
 * 2. 作为 user message 调用 streamChat，使用同一个 conversationId 保持 session 连续
 * 3. 流式返回内容经过 messageRouter 分流：文本→左侧对话，A2UI→右侧渲染
 */
function AppWithA2UI() {
  const { state, dispatch } = useAppContext();

  // 跨 chunk 的行缓冲区（用 ref 避免闭包陈旧问题）
  const lineBufferRef = useRef<string>("");

  // 创建 MessageProcessor，处理用户 action
  const processor = useMemo(() => {
    return new MessageProcessor([basicCatalog], async (action) => {
      // 1. 将 action 包装为 { userAction: action } 的 JSON 字符串
      const userMessage = JSON.stringify({ userAction: action });

      // 2. 添加用户操作消息到左侧对话（方便调试追踪）
      const actionMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: `[A2UI Action] ${(action as Record<string, unknown>).userAction?.actionName ?? "unknown"}`,
        timestamp: Date.now(),
      };
      dispatch({ type: "ADD_MESSAGE", payload: actionMessage });

      // 3. 重置行缓冲区
      lineBufferRef.current = "";

      // 4. 流式接收 AI 回复，使用同一个 conversationId 保持 session 连续
      try {
        for await (const chunk of streamChat(userMessage, state.conversationId)) {
          const { textLines, a2uiMessages, remainingBuffer } = messageRouter(
            chunk,
            lineBufferRef.current,
          );

          lineBufferRef.current = remainingBuffer;

          // 文本行追加到左侧对话气泡
          if (textLines.length > 0) {
            dispatch({
              type: "APPEND_STREAM",
              payload: textLines.join("\n"),
            });
          }

          // A2UI 消息送入 processor 处理
          if (a2uiMessages.length > 0) {
            processor.processMessages(a2uiMessages);
          }
        }

        // 流结束后，处理缓冲区中可能残留的最后一行
        if (lineBufferRef.current.length > 0) {
          dispatch({
            type: "APPEND_STREAM",
            payload: lineBufferRef.current,
          });
          lineBufferRef.current = "";
        }
      } catch (err) {
        console.error("A2UI action 流式聊天出错:", err);
        dispatch({
          type: "APPEND_STREAM",
          payload: "抱歉，操作处理出错了，请重试。",
        });
      } finally {
        dispatch({ type: "FINISH_STREAM" });
      }
    });
  }, [state.conversationId, dispatch]);

  // 管理 surfaces 状态
  const [surfaces, setSurfaces] = useState<SurfaceModel[]>(() =>
    Array.from(processor.model.surfacesMap.values()),
  );

  useEffect(() => {
    const sub1 = processor.onSurfaceCreated((surface) => {
      setSurfaces((prev) => [...prev, surface]);
    });
    const sub2 = processor.onSurfaceDeleted((id) => {
      setSurfaces((prev) => prev.filter((s) => s.id !== id));
    });
    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
    };
  }, [processor]);

  return (
    <MarkdownContext.Provider value={renderMarkdown}>
      <div className="flex flex-col md:flex-row h-screen w-screen bg-gray-50">
        {/* 左侧聊天面板 */}
        <aside className="w-full md:w-1/2 shrink-0 border-b md:border-b-0 md:border-r border-gray-200">
          <ChatPanel processor={processor} />
        </aside>

        {/* 右侧 A2UI 面板 */}
        <main className="w-full md:w-1/2 overflow-hidden">
          <A2UIPanel surfaces={surfaces} />
        </main>
      </div>
    </MarkdownContext.Provider>
  );
}

/**
 * App - 主入口
 *
 * 架构：
 *   AppProvider（全局状态）
 *     └── AppWithA2UI（使用 useAppContext，创建 MessageProcessor + 管理 surfaces）
 *           ├── ChatPanel（接收 processor prop）
 *           └── A2UIPanel（接收 surfaces 数组）
 */
function App() {
  return (
    <AppProvider>
      <AppWithA2UI />
    </AppProvider>
  );
}

export default App;
