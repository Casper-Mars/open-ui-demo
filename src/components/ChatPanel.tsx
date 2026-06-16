import { useCallback } from "react";
import { useAppContext, type Message } from "../context/AppContext";
import { streamChat } from "../lib/streamChat";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

/**
 * ChatPanel - 左侧聊天面板主容器
 *
 * 组合 MessageList + ChatInput，管理消息发送和流式接收逻辑。
 */
export default function ChatPanel() {
  const { state, dispatch } = useAppContext();

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

      // 2. 流式接收 AI 回复
      try {
        for await (const chunk of streamChat(text, state.conversationId)) {
          dispatch({ type: "APPEND_STREAM", payload: chunk });
        }
      } catch (err) {
        console.error("流式聊天出错:", err);
        dispatch({ type: "APPEND_STREAM", payload: "抱歉，回复出错了，请重试。" });
      } finally {
        dispatch({ type: "FINISH_STREAM" });
      }
    },
    [state.conversationId, dispatch],
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
