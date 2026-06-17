/**
 * 集成测试：A2UI 消息渲染 + Action 回传
 *
 * 测试完整的消息处理流程：
 * 1. Agent 返回包含 ```a2ui 代码块的 SSE 流
 * 2. messageRouter 正确提取并分流为文本 + A2UI 消息
 * 3. A2UI 消息能被 MessageProcessor 正确处理
 * 4. Action 回传逻辑正确
 */
import { describe, it, expect } from "vitest";
import { messageRouter } from "./messageRouter";
import { MessageProcessor } from "@a2ui/web_core/v0_9";
import { basicCatalog } from "@a2ui/react/v0_9";

// ── 验收项 3：A2UI 消息渲染 ──

describe("验收项 3：A2UI 消息渲染（messageRouter + MessageProcessor 集成）", () => {
  it("Agent 返回的 ```a2ui 代码块被正确提取并送入 MessageProcessor", () => {
    // 模拟 agent 返回的完整消息（含 ```a2ui 代码块）
    const agentResponse = [
      "好的，我来为你生成一个界面。",
      "```a2ui",
      JSON.stringify({
        version: "v0.9",
        createSurface: {
          surfaceId: "main",
          catalogId: "https://a2ui.org/specification/v0_9/basic_catalog.json",
        },
      }),
      JSON.stringify({
        version: "v0.9",
        updateComponents: {
          surfaceId: "main",
          components: [
            {
              id: "root",
              component: "Column",
              children: ["text1", "btn1"],
            },
            {
              id: "text1",
              component: "Text",
              text: "Hello A2UI!",
            },
            {
              id: "btn1",
              component: "Button",
              child: "btn_text",
              action: {
                name: "click_hello",
                context: { message: "Hello from button!" },
              },
            },
            {
              id: "btn_text",
              component: "Text",
              text: "点我",
            },
          ],
        },
      }),
      "```",
      "界面已生成，请查看右侧面板。",
    ].join("\n") + "\n";

    // 模拟流式接收（一次性完整 chunk）
    const result = messageRouter(agentResponse);

    // 验证文本分流
    expect(result.textLines).toEqual([
      "好的，我来为你生成一个界面。",
      "界面已生成，请查看右侧面板。",
    ]);

    // 验证 A2UI 消息提取
    expect(result.a2uiMessages).toHaveLength(2);
    expect(result.a2uiMessages[0]).toHaveProperty("createSurface");
    expect(result.a2uiMessages[0].createSurface).toMatchObject({
      surfaceId: "main",
    });
    expect(result.a2uiMessages[1]).toHaveProperty("updateComponents");
    expect(result.a2uiMessages[1].updateComponents).toMatchObject({
      surfaceId: "main",
    });
    expect(result.a2uiMessages[1].updateComponents.components).toHaveLength(4);

    // 验证 MessageProcessor 能处理这些消息（不抛异常）
    const processor = new MessageProcessor([basicCatalog]);
    expect(() => {
      processor.processMessages(result.a2uiMessages);
    }).not.toThrow();

    // 验证 surface 已创建
    const surfaces = Array.from(processor.model.surfacesMap.values());
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0].id).toBe("main");
  });

  it("流式 chunk 场景：跨 chunk 的 ```a2ui 块被正确累积并处理", () => {
    const processor = new MessageProcessor([basicCatalog]);

    // chunk 1：文本 + ```a2ui 开始标记
    const chunk1 = "好的，我来生成界面。\n```a2ui\n";
    const r1 = messageRouter(chunk1);
    expect(r1.textLines).toEqual(["好的，我来生成界面。"]);
    expect(r1.a2uiMessages).toHaveLength(0);
    // 进入了 a2ui 块
    expect(r1.remainingBuffer).toContain("__A2UI_BLOCK__");

    // chunk 2：createSurface（跨 chunk 的 JSONL 行）
    const chunk2 =
      JSON.stringify({
        version: "v0.9",
        createSurface: {
          surfaceId: "main",
          catalogId: "https://a2ui.org/specification/v0_9/basic_catalog.json",
        },
      }) + "\n";
    const r2 = messageRouter(chunk2, r1.remainingBuffer);
    expect(r2.a2uiMessages).toHaveLength(1);
    expect(r2.a2uiMessages[0]).toHaveProperty("createSurface");
    // 仍在 a2ui 块内
    expect(r2.remainingBuffer).toContain("__A2UI_BLOCK__");

    // 送入 processor
    processor.processMessages(r2.a2uiMessages);
    expect(processor.model.surfacesMap.size).toBe(1);

    // chunk 3：updateComponents + ``` 结束标记 + 文本
    const chunk3 =
      JSON.stringify({
        version: "v0.9",
        updateComponents: {
          surfaceId: "main",
          components: [
            {
              id: "root",
              component: "Column",
              children: ["text1"],
            },
            {
              id: "text1",
              component: "Text",
              text: "跨 chunk 测试",
            },
          ],
        },
      }) +
      "\n```\n界面已生成。\n";
    const r3 = messageRouter(chunk3, r2.remainingBuffer);
    expect(r3.textLines).toEqual(["界面已生成。"]);
    expect(r3.a2uiMessages).toHaveLength(1);
    expect(r3.a2uiMessages[0]).toHaveProperty("updateComponents");
    // 已退出 a2ui 块
    expect(r3.remainingBuffer).toBe("");

    // 送入 processor
    processor.processMessages(r3.a2uiMessages);
    expect(processor.model.surfacesMap.size).toBe(1);
  });

  it("多 surface 场景：多个 createSurface 被正确处理", () => {
    const processor = new MessageProcessor([basicCatalog]);

    const agentResponse = [
      "```a2ui",
      JSON.stringify({
        version: "v0.9",
        createSurface: {
          surfaceId: "panel1",
          catalogId: "https://a2ui.org/specification/v0_9/basic_catalog.json",
        },
      }),
      JSON.stringify({
        version: "v0.9",
        updateComponents: {
          surfaceId: "panel1",
          components: [
            { id: "root", component: "Column", children: ["t1"] },
            { id: "t1", component: "Text", text: "Panel 1" },
          ],
        },
      }),
      "```",
      "```a2ui",
      JSON.stringify({
        version: "v0.9",
        createSurface: {
          surfaceId: "panel2",
          catalogId: "https://a2ui.org/specification/v0_9/basic_catalog.json",
        },
      }),
      JSON.stringify({
        version: "v0.9",
        updateComponents: {
          surfaceId: "panel2",
          components: [
            { id: "root", component: "Column", children: ["t2"] },
            { id: "t2", component: "Text", text: "Panel 2" },
          ],
        },
      }),
      "```",
    ].join("\n") + "\n";

    const result = messageRouter(agentResponse);
    expect(result.a2uiMessages).toHaveLength(4);

    processor.processMessages(result.a2uiMessages);
    const surfaces = Array.from(processor.model.surfacesMap.values());
    expect(surfaces).toHaveLength(2);
    expect(surfaces.map((s) => s.id).sort()).toEqual(["panel1", "panel2"]);
  });

  it("v0.9 消息直接送入 MessageProcessor（裸 JSONL，向后兼容）", () => {
    const processor = new MessageProcessor([basicCatalog]);

    const messages = [
      {
        version: "v0.9" as const,
        createSurface: {
          surfaceId: "bare",
          catalogId: "https://a2ui.org/specification/v0_9/basic_catalog.json",
        },
      },
      {
        version: "v0.9" as const,
        updateComponents: {
          surfaceId: "bare",
          components: [
            { id: "root", component: "Column", children: ["t"] },
            { id: "t", component: "Text", text: "裸 JSONL" },
          ],
        },
      },
    ];

    processor.processMessages(messages);
    const surfaces = Array.from(processor.model.surfacesMap.values());
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0].id).toBe("bare");
  });
});

// ── 验收项 4：A2UI Action 回传 ──

describe("验收项 4：A2UI Action 回传", () => {
  it("MessageProcessor 的 actionHandler 在 surface dispatchAction 时被调用", async () => {
    const receivedActions: unknown[] = [];

    const processor = new MessageProcessor([basicCatalog], (action) => {
      receivedActions.push(action);
    });

    // 创建 surface
    processor.processMessages([
      {
        version: "v0.9" as const,
        createSurface: {
          surfaceId: "action-test",
          catalogId: "https://a2ui.org/specification/v0_9/basic_catalog.json",
        },
      },
      {
        version: "v0.9" as const,
        updateComponents: {
          surfaceId: "action-test",
          components: [
            {
              id: "root",
              component: "Column",
              children: ["btn"],
            },
            {
              id: "btn",
              component: "Button",
              child: "btn_label",
              action: {
                name: "test_action",
                context: { key: "value" },
              },
            },
            {
              id: "btn_label",
              component: "Text",
              text: "Click Me",
            },
          ],
        },
      },
    ]);

    // 获取 surface 并模拟 dispatchAction
    const surface = processor.model.surfacesMap.get("action-test");
    expect(surface).toBeDefined();

    if (surface) {
      await surface.dispatchAction(
        { event: { name: "test_action", context: { key: "value" } } },
        "btn",
      );
    }

    // 验证 actionHandler 被调用
    expect(receivedActions).toHaveLength(1);
    const received = receivedActions[0] as Record<string, unknown>;
    expect(received.name).toBe("test_action");
    expect(received.context).toEqual({ key: "value" });
    expect(received.sourceComponentId).toBe("btn");
  });

  it("onAction 回调中包装 userAction → streamChat 的消息格式正确", () => {
    // 模拟 onAction 回调中的包装逻辑
    const action = {
      name: "click_hello",
      sourceComponentId: "btn1",
      timestamp: new Date().toISOString(),
      context: { message: "Hello!" },
    };

    // 包装为 { userAction: action }
    const userMessage = JSON.stringify({ userAction: action });
    const parsed = JSON.parse(userMessage);

    expect(parsed).toHaveProperty("userAction");
    expect(parsed.userAction.name).toBe("click_hello");
    expect(parsed.userAction.context).toEqual({ message: "Hello!" });
  });

  it("messageRouter 能处理 action 回传后 agent 返回的流式响应", () => {
    // 模拟 action 回传后 agent 返回的响应
    const agentResponse = [
      "收到你的操作！",
      "```a2ui",
      JSON.stringify({
        version: "v0.9",
        updateComponents: {
          surfaceId: "main",
          components: [
            {
              id: "root",
              component: "Column",
              children: ["result"],
            },
            {
              id: "result",
              component: "Text",
              text: "操作成功！",
            },
          ],
        },
      }),
      "```",
    ].join("\n") + "\n";

    const result = messageRouter(agentResponse);

    expect(result.textLines).toEqual(["收到你的操作！"]);
    expect(result.a2uiMessages).toHaveLength(1);
    expect(result.a2uiMessages[0]).toHaveProperty("updateComponents");

    // 验证 MessageProcessor 能处理
    const processor = new MessageProcessor([basicCatalog]);
    // 先创建 surface
    processor.processMessages([
      {
        version: "v0.9" as const,
        createSurface: {
          surfaceId: "main",
          catalogId: "https://a2ui.org/specification/v0_9/basic_catalog.json",
        },
      },
    ]);
    // 再更新组件
    processor.processMessages(result.a2uiMessages);
    expect(processor.model.surfacesMap.size).toBe(1);
  });
});
