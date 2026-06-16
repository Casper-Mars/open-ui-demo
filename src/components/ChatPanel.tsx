import { useCallback, useRef } from "react";
import { useA2UI } from "@a2ui/react";
import { useAppContext, type Message } from "../context/AppContext";
import { streamChat } from "../lib/streamChat";
import { messageRouter } from "../lib/messageRouter";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

/**
 * ChatPanelInner - 聊天面板核心逻辑
 *
 * 在 A2UIProvider 内部，可以安全使用 useA2UI hook。
 * 组合 MessageList + ChatInput，管理消息发送和流式接收逻辑。
 * 在流式接收循环中调用 messageRouter 将 chunk 分流：
 * - 文本行 → dispatch APPEND_STREAM（追加到左侧对话气泡）
 * - A2UI 消息 → processMessages（送入右侧渲染）
 */
function ChatPanelInner() {
  const { state, dispatch } = useAppContext();
  const { processMessages } = useA2UI();

  // 跨 chunk 的行缓冲区，用 ref 避免闭包陈旧问题
  const lineBufferRef = useRef<string>("");

  const handleSend = useCallback(
    async (text: string) => {
      // 1. 添加用户消息
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      dispatch({ type: "ADD_MESSAGE", payload: userMessage });

      // 2. 重置行缓冲区
      lineBufferRef.current = "";

      // 3. 流式接收 AI 回复
      try {
        for await (const chunk of streamChat(text, state.conversationId)) {
          const { textLines, a2uiMessages, remainingBuffer } = messageRouter(
            chunk,
            lineBufferRef.current,
          );

          // 更新缓冲区
          lineBufferRef.current = remainingBuffer;

          // 文本行追加到左侧对话气泡
          if (textLines.length > 0) {
            dispatch({
              type: "APPEND_STREAM",
              payload: textLines.join("\n"),
            });
          }

          // A2UI 消息送入右侧渲染
          if (a2uiMessages.length > 0) {
            processMessages(a2uiMessages);
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
        console.error("流式聊天出错:", err);
        dispatch({ type: "APPEND_STREAM", payload: "抱歉，回复出错了，请重试。" });
      } finally {
        dispatch({ type: "FINISH_STREAM" });
      }
    },
    [state.conversationId, dispatch, processMessages],
  );

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 标题栏 */}
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-base font-semibold text-gray-800">对话</h2>
      </div>

      {/* 消息列表 */}
      <MessageList
        messages={state.messages}
        streaming={state.streaming}
        streamingContent={state.streamingContent}
      />

      {/* 输入框 */}
      <ChatInput onSend={handleSend} disabled={state.streaming} />
    </div>
  );
}

export default ChatPanelInner;
