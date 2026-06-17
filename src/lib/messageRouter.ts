import type { A2uiMessage } from "@a2ui/web_core/v0_9";

/**
 * A2UI 消息类型判断的字段名集合。
 * 一个 JSON 对象只要包含其中至少一个字段，即被识别为 A2UI 消息。
 */
const A2UI_MESSAGE_KEYS = new Set([
  "createSurface",
  "updateComponents",
  "updateDataModel",
  "deleteSurface",
]);

/**
 * Buffer 中用于标记"当前在 a2ui 代码块内"的前缀。
 * 当 remainingBuffer 以此前缀开头时，表示上一轮我们处于 IN_A2UI_BLOCK 状态。
 */
const A2UI_BLOCK_MARKER = "__A2UI_BLOCK__";

/**
 * messageRouter 的返回类型。
 */
export interface MessageRouterResult {
  /** 纯文本行（非 A2UI 消息），追加到左侧对话气泡 */
  textLines: string[];
  /** A2UI 消息数组（v0.9 格式），送入右侧渲染 */
  a2uiMessages: A2uiMessage[];
  /** 跨 chunk 的不完整行缓冲区（可能携带 a2ui 块状态标记） */
  remainingBuffer: string;
}

/**
 * 判断一个已解析的 JSON 对象是否为 A2UI 消息。
 * 只要对象包含 createSurface / updateComponents / updateDataModel / deleteSurface
 * 中至少一个字段，即视为 A2UI 消息。
 */
function isA2UIMessage(obj: Record<string, unknown>): boolean {
  for (const key of A2UI_MESSAGE_KEYS) {
    if (key in obj) return true;
  }
  return false;
}

/**
 * 尝试将一行文本解析为 A2UI 消息（v0.9 格式）。
 * 返回解析后的消息，如果该行不是 A2UI 消息则返回 null。
 */
function tryParseA2UILine(line: string): A2uiMessage | null {
  try {
    const parsed = JSON.parse(line);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      if (isA2UIMessage(parsed as Record<string, unknown>)) {
        return parsed as A2uiMessage;
      }
    }
  } catch {
    // JSON 解析失败，不是 A2UI 消息
  }
  return null;
}

/**
 * 处理 NORMAL 状态下的行。
 * 1. 检测 ```a2ui 开始标记 → 切换到 IN_A2UI_BLOCK
 * 2. 尝试解析为裸 A2UI JSONL 消息（向后兼容）→ 返回 a2uiMessage
 * 3. 否则作为普通文本行
 *
 * @returns 新的状态、文本行（如果有）和 A2UI 消息（如果有）
 */
function processNormalLine(
  line: string,
): {
  newState: "NORMAL" | "IN_A2UI_BLOCK";
  textLine: string | null;
  a2uiMessage: A2uiMessage | null;
} {
  // 检测 ```a2ui 开始标记（支持行首可能有空格）
  if (line.trimStart().startsWith("```a2ui")) {
    // 检查 ```a2ui 后面是否还有内容（如 ```a2ui some text）
    // 只有精确匹配 ```a2ui 或 ```a2ui 后跟空格/无内容时才进入块
    const afterMarker = line.trimStart().slice("```a2ui".length);
    if (afterMarker.length === 0 || afterMarker.startsWith(" ")) {
      return { newState: "IN_A2UI_BLOCK", textLine: null, a2uiMessage: null };
    }
  }

  // 向后兼容：在 NORMAL 状态下也尝试解析裸 A2UI JSONL 行
  const msg = tryParseA2UILine(line);
  if (msg !== null) {
    return { newState: "NORMAL", textLine: null, a2uiMessage: msg };
  }

  return { newState: "NORMAL", textLine: line, a2uiMessage: null };
}

/**
 * 处理 IN_A2UI_BLOCK 状态下的行。
 * 检测 ``` 结束标记，将块内行解析为 A2UI 消息。
 *
 * @returns 新的状态、该行产生的 A2UI 消息（如果有）、以及是否需要丢弃该行
 */
function processA2UIBlockLine(
  line: string,
): {
  newState: "NORMAL" | "IN_A2UI_BLOCK";
  a2uiMessage: A2uiMessage | null;
} {
  // 检测 ``` 结束标记
  if (line.trimStart() === "```") {
    return { newState: "NORMAL", a2uiMessage: null };
  }

  // 在 a2ui 块内，尝试解析为 A2UI 消息
  const msg = tryParseA2UILine(line);
  return { newState: "IN_A2UI_BLOCK", a2uiMessage: msg };
}

/**
 * 逐行解析 chunk 文本，将内容分流为纯文本和 A2UI 消息。
 *
 * 支持两种输入格式：
 * 1. 纯 JSONL（每行一个 JSON 对象）—— 原有行为
 * 2. Markdown ```a2ui 代码块 —— 新增支持
 *
 * 代码块状态机：
 * - NORMAL：正常文本，遇到 ```a2ui 进入 IN_A2UI_BLOCK
 * - IN_A2UI_BLOCK：块内行按 JSONL 解析，遇到 ``` 回到 NORMAL
 *
 * 跨 chunk 的状态通过 remainingBuffer 中的特殊前缀 A2UI_BLOCK_MARKER 传递。
 *
 * @param chunk - 当前收到的文本块
 * @param buffer - 上一轮剩余的不完整行缓冲区（可能携带状态标记）
 * @returns 分流结果，包含文本行、A2UI 消息和新的缓冲区
 */
export function messageRouter(
  chunk: string,
  buffer: string = "",
): MessageRouterResult {
  const textLines: string[] = [];
  const a2uiMessages: A2uiMessage[] = [];

  // 从 buffer 中提取 a2ui 块状态
  let state: "NORMAL" | "IN_A2UI_BLOCK" = "NORMAL";
  let actualBuffer = buffer;

  if (actualBuffer.startsWith(A2UI_BLOCK_MARKER)) {
    state = "IN_A2UI_BLOCK";
    actualBuffer = actualBuffer.slice(A2UI_BLOCK_MARKER.length);
  }

  // 拼接上一轮缓冲区
  const combined = actualBuffer + chunk;
  const lines = combined.split("\n");

  // 最后一行：如果 chunk 不以 \n 结尾，则最后一行是不完整的，保留到缓冲区
  // 如果 chunk 以 \n 结尾，split 会产生一个空字符串作为最后一行，不需要缓冲
  let remainingContent = "";
  if (!chunk.endsWith("\n")) {
    remainingContent = lines.pop() ?? "";
  } else {
    // chunk 以 \n 结尾，split 产生的最后一个元素是空字符串，丢弃
    lines.pop();
  }

  // 逐行处理
  for (const line of lines) {
    // 跳过空行
    if (line.length === 0) continue;

    if (state === "NORMAL") {
      const { newState, textLine, a2uiMessage } = processNormalLine(line);
      state = newState;
      if (textLine !== null) {
        textLines.push(textLine);
      }
      if (a2uiMessage !== null) {
        a2uiMessages.push(a2uiMessage);
      }
    } else {
      // IN_A2UI_BLOCK
      const { newState, a2uiMessage } = processA2UIBlockLine(line);
      state = newState;
      if (a2uiMessage !== null) {
        a2uiMessages.push(a2uiMessage);
      }
    }
  }

  // 构建新的 remainingBuffer：如果状态是 IN_A2UI_BLOCK，加上标记前缀
  let remainingBuffer = remainingContent;
  if (state === "IN_A2UI_BLOCK") {
    remainingBuffer = A2UI_BLOCK_MARKER + remainingContent;
  }

  return { textLines, a2uiMessages, remainingBuffer };
}

export default messageRouter;
