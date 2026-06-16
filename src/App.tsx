import { useCallback, useRef } from "react";
import { A2UIProvider, useA2UI, type OnActionCallback } from "@a2ui/react";
import { AppProvider, useAppContext, type Message } from "./context/AppContext";
import { streamChat } from "./lib/streamChat";
import { messageRouter } from "./lib/messageRouter";
import ChatPanel from "./components/ChatPanel";
import A2UIPanel from "./components/A2UIPanel";

/**
 * AppInner - A2UIProvider 内部的布局组件
 *
 * 负责：
 * 1. 布局（左侧 ChatPanel + 右侧 A2UIPanel）
 * 2. 通过 ref 将 useA2UI 的 processMessages 暴露给外层的 onAction 回调
 */
function AppInner({
  processMessagesRef,
}: {
  processMessagesRef: React.MutableRefObject<
    ((messages: Parameters<ReturnType<typeof useA2UI>["processMessages"]>[0]) => void) | null
  >;
}) {
  const { processMessages } = useA2UI();

  // 将 processMessages 写入 ref，供外层 onAction 使用
  processMessagesRef.current = processMessages;

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-gray-50">
      {/* 左侧聊天面板 */}
      <aside className="w-full md:w-1/2 shrink-0 border-b md:border-b-0 md:border-r border-gray-200">
        <ChatPanel />
      </aside>

      {/* 右侧 A2UI 面板 */}
      <main className="w-full md:w-1/2 overflow-hidden">
        <A2UIPanel />
      </main>
    </div>
  );
}

/**
 * AppWithA2UI - AppProvider 内部组件，可以安全使用 useAppContext
 *
 * 负责：
 * 1. 定义 onAction 回调（需要 useAppContext）
 * 2. 通过 ref 桥接 A2UIProvider 内外的 processMessages
 *
 * onAction 回调逻辑：
 * 1. 将 action 包装为 { userAction: action } 的 JSON 字符串
 * 2. 作为 user message 调用 streamChat，使用同一个 conversationId 保持 session 连续
 * 3. 流式返回内容经过 messageRouter 分流：文本→左侧对话，A2UI→右侧渲染
 */
function AppWithA2UI() {
  const { state, dispatch } = useAppContext();

  // 通过 ref 桥接：外层 onAction 需要访问 A2UIProvider 内部的 processMessages
  const processMessagesRef = useRef<
    ((messages: Parameters<ReturnType<typeof useA2UI>["processMessages"]>[0]) => void) | null
  >(null);

  // 跨 chunk 的行缓冲区（用 ref 避免闭包陈旧问题）
  const lineBufferRef = useRef<string>("");

  // onAction 回调：用户操作 A2UI 组件时触发
  const onAction: OnActionCallback = useCallback(
    async (action) => {
      // 1. 将 action 包装为 { userAction: action } 的 JSON 字符串
      const userMessage = JSON.stringify({ userAction: action });

      // 2. 添加用户操作消息到左侧对话（方便调试追踪）
      const actionMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: `[A2UI Action] ${action.userAction?.actionName ?? "unknown"}`,
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

          // A2UI 消息送入右侧渲染
          if (a2uiMessages.length > 0 && processMessagesRef.current) {
            processMessagesRef.current(a2uiMessages);
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
    },
    [state.conversationId, dispatch],
  );

  return (
    <A2UIProvider onAction={onAction}>
      <AppInner processMessagesRef={processMessagesRef} />
    </A2UIProvider>
  );
}

/**
 * App - 主入口
 *
 * 架构：
 *   AppProvider（全局状态）
 *     └── AppWithA2UI（使用 useAppContext，定义 onAction）
 *           └── A2UIProvider（A2UI 上下文）
 *                 └── AppInner（布局 + 暴露 processMessages 给 onAction）
 */
function App() {
  return (
    <AppProvider>
      <AppWithA2UI />
    </AppProvider>
  );
}

export default App;
