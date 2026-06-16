import OpenAI from "openai";
import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions/completions";

/**
 * 流式聊天配置选项
 */
export interface StreamChatOptions {
  /** OpenClaw Gateway Agent ID（如 openclaw/storyboard），默认使用 openclaw/storyboard */
  model?: string;
  /**
   * 用户标识，用于 OpenClaw Gateway 的 session 管理。
   * - 传入相同 user 值时，Agent 会记住之前的对话上下文
   * - 不传 user 时，每次调用创建独立的 stateless session
   */
  user?: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 温度参数 (0-2) */
  temperature?: number;
  /** 最大输出 token 数 */
  maxTokens?: number;
  /** 额外的消息历史（在用户消息之前） */
  previousMessages?: ChatCompletionCreateParamsBase["messages"];
}

/**
 * 创建 OpenAI 兼容的 SSE 流式聊天客户端。
 *
 * 基于 openai npm 包，baseURL 指向 OpenClaw Gateway。
 * 返回一个 async generator，每次 yield 一个文本 chunk。
 *
 * @example
 * ```ts
 * // 带 session 记忆的对话
 * for await (const chunk of streamChat("你好，我叫小明", "user-001")) {
 *   console.log(chunk);
 * }
 * // 后续调用会记住上下文
 * for await (const chunk of streamChat("我叫什么名字？", "user-001")) {
 *   console.log(chunk);
 * }
 *
 * // 无状态的单次调用
 * for await (const chunk of streamChat("你好")) {
 *   console.log(chunk);
 * }
 * ```
 */
export async function* streamChat(
  userMessage: string,
  user?: string,
  options?: StreamChatOptions,
): AsyncGenerator<string, void, undefined> {
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!token) {
    throw new Error(
      "OPENCLAW_GATEWAY_TOKEN 环境变量未设置，请先配置 Gateway 认证 token",
    );
  }

  const client = new OpenAI({
    baseURL: window.location.origin + "/v1",
    apiKey: token,
    dangerouslyAllowBrowser: true,
  });

  const messages: ChatCompletionCreateParamsBase["messages"] = [];

  // 添加系统提示词（如果提供）
  if (options?.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }

  // 添加历史消息（如果提供）
  if (options?.previousMessages) {
    messages.push(...options.previousMessages);
  }

  // 添加当前用户消息
  messages.push({ role: "user", content: userMessage });

  const stream = await client.chat.completions.create(
    {
      model: options?.model ?? "openclaw/storyboard",
      messages,
      stream: true,
      ...(user !== undefined && { user }),
      ...(options?.temperature !== undefined && {
        temperature: options.temperature,
      }),
      ...(options?.maxTokens !== undefined && {
        max_tokens: options.maxTokens,
      }),
    },
  );

  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

export default streamChat;
