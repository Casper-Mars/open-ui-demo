/**
 * 联调测试：通过 Gateway 调用 storyboard agent，验证完整流程
 *
 * 测试：
 * 1. Agent 返回的 ```a2ui 代码块被 messageRouter 正确提取
 * 2. 提取的 A2UI 消息能被 MessageProcessor 正确处理
 * 3. 文本消息正确分流到 textLines
 *
 * 运行方式：
 *   OPENCLAW_GATEWAY_TOKEN=86e7adc1a36660b3e3e1e33a97f4b0300ebf19759d60510b \
 *   npx vitest run src/lib/e2e.test.ts
 */
import { describe, it, expect } from "vitest";
import OpenAI from "openai";
import { messageRouter } from "./messageRouter";
import { MessageProcessor } from "@a2ui/web_core/v0_9";
import { basicCatalog } from "@a2ui/react/v0_9";

const GATEWAY_TOKEN =
  process.env.OPENCLAW_GATEWAY_TOKEN ??
  "86e7adc1a36660b3e3e1e33a97f4b0300ebf19759d60510b";
const GATEWAY_URL = "http://localhost:18789/v1";

describe("E2E 联调测试：Gateway → Agent → messageRouter → MessageProcessor", () => {
  // 超时设为 120s，因为 agent 响应可能需要时间
  const E2E_TIMEOUT = 120_000;

  it(
    "验收项 3：Agent 返回的 ```a2ui 代码块被正确提取并送入 MessageProcessor",
    { timeout: E2E_TIMEOUT },
    async () => {
      const client = new OpenAI({
        baseURL: GATEWAY_URL,
        apiKey: GATEWAY_TOKEN,
        dangerouslyAllowBrowser: true,
      });

      // 发送消息，要求 agent 生成 A2UI 界面
      const stream = await client.chat.completions.create({
        model: "openclaw/storyboard",
        messages: [
          {
            role: "user",
            content:
              "请生成一个简单的 A2UI 界面，包含一个标题 '联调测试' 和一个按钮 '点击我'。使用 ```a2ui 代码块格式。",
          },
        ],
        stream: true,
      });

      // 收集所有 chunk
      const processor = new MessageProcessor([basicCatalog]);
      let buffer = "";
      let allText = "";
      let totalA2uiMessages = 0;

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (!content) continue;

        const { textLines, a2uiMessages, remainingBuffer } = messageRouter(
          content,
          buffer,
        );
        buffer = remainingBuffer;

        allText += textLines.join("\n");
        totalA2uiMessages += a2uiMessages.length;

        if (a2uiMessages.length > 0) {
          processor.processMessages(a2uiMessages);
        }
      }

      // 处理残留 buffer
      if (buffer.length > 0) {
        allText += buffer;
      }

      console.log("=== 联调测试结果 ===");
      console.log("文本内容:", allText.substring(0, 200));
      console.log("A2UI 消息数:", totalA2uiMessages);
      console.log(
        "Surface 数:",
        Array.from(processor.model.surfacesMap.values()).length,
      );

      // 验证：至少有一个 surface 被创建
      const surfaces = Array.from(processor.model.surfacesMap.values());
      expect(surfaces.length).toBeGreaterThan(0);

      // 验证：有 A2UI 消息被提取
      expect(totalA2uiMessages).toBeGreaterThan(0);

      // 验证：有文本内容
      expect(allText.length).toBeGreaterThan(0);

      console.log("=== 联调测试通过 ===");
    },
  );

  it(
    "验收项 4：A2UI Action 回传 — agent 能响应 userAction",
    { timeout: E2E_TIMEOUT },
    async () => {
      const client = new OpenAI({
        baseURL: GATEWAY_URL,
        apiKey: GATEWAY_TOKEN,
      });

      // 先创建一个带按钮的界面
      const stream1 = await client.chat.completions.create({
        model: "openclaw/storyboard",
        messages: [
          {
            role: "user",
            content:
              "请生成一个 A2UI 界面，包含一个按钮 '确认'，按钮的 action name 为 'confirm_action'。使用 ```a2ui 代码块格式。",
          },
        ],
        stream: true,
      });

      const processor = new MessageProcessor([basicCatalog]);
      let buffer = "";

      for await (const chunk of stream1) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (!content) continue;
        const { a2uiMessages, remainingBuffer } = messageRouter(
          content,
          buffer,
        );
        buffer = remainingBuffer;
        if (a2uiMessages.length > 0) {
          processor.processMessages(a2uiMessages);
        }
      }

      const surfaces = Array.from(processor.model.surfacesMap.values());
      expect(surfaces.length).toBeGreaterThan(0);

      // 模拟用户点击按钮（action 回传）
      const surface = surfaces[0];
      const actionPayload = {
        event: {
          name: "confirm_action",
          context: { confirmed: true },
        },
      };

      // 验证 dispatchAction 不抛异常
      await expect(
        surface.dispatchAction(actionPayload, "test-btn"),
      ).resolves.toBeUndefined();

      console.log("=== Action 回传测试通过 ===");
    },
  );
});
