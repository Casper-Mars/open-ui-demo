import { useState, type FormEvent, type KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

/**
 * ChatInput - 输入框 + 发送按钮
 *
 * 支持 Enter 发送（Shift+Enter 换行）。
 * streaming 时 disabled 禁用输入。
 */
export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 发送，Shift+Enter 换行
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-gray-200 p-4 flex items-end gap-3"
    >
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={disabled ? "AI 正在回复..." : "输入消息，Enter 发送"}
        rows={1}
        className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
                   disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
                   placeholder-gray-400"
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="shrink-0 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-medium text-white
                   hover:bg-blue-600 active:bg-blue-700
                   disabled:bg-gray-300 disabled:cursor-not-allowed
                   transition-colors"
      >
        发送
      </button>
    </form>
  );
}
