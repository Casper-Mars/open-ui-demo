import type { Message } from "../context/AppContext";

interface MessageBubbleProps {
  message: Message;
}

/**
 * MessageBubble - 单条消息气泡
 *
 * 用户消息：右对齐，蓝色背景
 * AI 消息：左对齐，灰色背景
 */
export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
          isUser
            ? "bg-blue-500 text-white rounded-br-md"
            : "bg-gray-100 text-gray-800 rounded-bl-md"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
