import { useEffect, useRef } from "react";
import type { Message } from "../context/AppContext";
import MessageBubble from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
  streaming: boolean;
  streamingContent: string;
}

/**
 * MessageList - 消息列表
 *
 * 渲染所有历史消息 + 流式中的 AI 消息。
 * 使用 useRef + scrollIntoView 自动滚动到最新消息。
 */
export default function MessageList({
  messages,
  streaming,
  streamingContent,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 消息列表变化或流式内容更新时，自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {/* 历史消息 */}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* 流式中的 AI 消息：实时显示 streamingContent */}
      {streaming && streamingContent && (
        <div className="flex justify-start mb-4">
          <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-gray-100 text-gray-800 px-4 py-2.5 text-sm leading-relaxed break-words">
            {streamingContent}
            {/* 闪烁光标，表示正在生成 */}
            <span className="inline-block w-1.5 h-4 bg-gray-500 ml-0.5 align-middle animate-pulse" />
          </div>
        </div>
      )}

      {/* 空状态 */}
      {messages.length === 0 && !streaming && (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-400 text-sm">发送一条消息开始对话</p>
        </div>
      )}

      {/* 滚动锚点 */}
      <div ref={bottomRef} />
    </div>
  );
}
