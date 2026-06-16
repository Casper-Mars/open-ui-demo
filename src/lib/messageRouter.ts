import type { ServerToClientMessage } from "@a2ui/react";

/**
 * A2UI 消息类型判断的字段名集合。
 * 一个 JSON 对象只要包含其中至少一个字段，即被识别为 A2UI 消息。
 */
const A2UI_MESSAGE_KEYS = new Set([
  "beginRendering",
  "surfaceUpdate",
  "dataModelUpdate",
  "deleteSurface",
]);

/**
 * messageRouter 的返回类型。
 */
export interface MessageRouterResult {
  /** 纯文本行（非 A2UI 消息），追加到左侧对话气泡 */
  textLines: string[];
  /** A2UI 消息数组，送入右侧渲染 */
  a2uiMessages: ServerToClientMessage[];
  /** 跨 chunk 的不完整行缓冲区（最后一行不以 \n 结尾） */
  remainingBuffer: string;
}

/**
 * 判断一个已解析的 JSON 对象是否为 A2UI 消息。
 * 只要对象包含 beginRendering / surfaceUpdate / dataModelUpdate / deleteSurface
 * 中至少一个字段，即视为 A2UI 消息。
 */
function isA2UIMessage(obj: Record<string, unknown>): boolean {
  for (const key of A2UI_MESSAGE_KEYS) {
    if (key in obj) return true;
  }
  return false;
}

/**
 * 逐行解析 chunk 文本，将内容分流为纯文本和 A2UI 消息。
 *
 * 逻辑：
 * 1. 将 chunk 与上一轮剩余的 buffer 拼接
 * 2. 按 \n 分割
 * 3. 最后一行不以 \n 结尾 → 保留到 remainingBuffer（跨 chunk 缓冲）
 * 4. 其余行逐行尝试 JSON.parse：
 *    - 解析成功且是 A2UI 消息 → 加入 a2uiMessages
 *    - 解析成功但不是 A2UI → 原样当文本
 *    - 解析失败 → 原样当文本
 *
 * @param chunk - 当前收到的文本块
 * @param buffer - 上一轮剩余的不完整行缓冲区
 * @returns 分流结果，包含文本行、A2UI 消息和新的缓冲区
 */
export function messageRouter(
  chunk: string,
  buffer: string = "",
): MessageRouterResult {
  const textLines: string[] = [];
  const a2uiMessages: ServerToClientMessage[] = [];

  // 拼接上一轮缓冲区
  const combined = buffer + chunk;
  const lines = combined.split("\n");

  // 最后一行：如果 chunk 不以 \n 结尾，则最后一行是不完整的，保留到缓冲区
  // 如果 chunk 以 \n 结尾，split 会产生一个空字符串作为最后一行，不需要缓冲
  let remainingBuffer = "";
  if (!chunk.endsWith("\n")) {
    remainingBuffer = lines.pop() ?? "";
  } else {
    // chunk 以 \n 结尾，split 产生的最后一个元素是空字符串，丢弃
    lines.pop();
  }

  // 逐行处理
  for (const line of lines) {
    // 跳过空行
    if (line.length === 0) continue;

    try {
      const parsed = JSON.parse(line);

      // 确保解析结果是对象（非 null、非原始值）
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        if (isA2UIMessage(parsed as Record<string, unknown>)) {
          a2uiMessages.push(parsed as ServerToClientMessage);
          continue;
        }
      }
    } catch {
      // JSON 解析失败，原样当文本
    }

    // 不是 A2UI 消息，作为文本行
    textLines.push(line);
  }

  return { textLines, a2uiMessages, remainingBuffer };
}

export default messageRouter;
