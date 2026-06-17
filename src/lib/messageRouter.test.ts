import { describe, it, expect } from "vitest";
import { messageRouter } from "./messageRouter";

describe("messageRouter", () => {
  // ── 验收标准 1：纯文本流式返回 → 全部展示在左侧对话区 ──

  it("纯文本 chunk 全部归入 textLines", () => {
    const result = messageRouter("你好，这是一条纯文本消息\n");
    expect(result.textLines).toEqual(["你好，这是一条纯文本消息"]);
    expect(result.a2uiMessages).toHaveLength(0);
    expect(result.remainingBuffer).toBe("");
  });

  it("多行纯文本全部归入 textLines", () => {
    const result = messageRouter("第一行\n第二行\n第三行\n");
    expect(result.textLines).toEqual(["第一行", "第二行", "第三行"]);
    expect(result.a2uiMessages).toHaveLength(0);
    expect(result.remainingBuffer).toBe("");
  });

  // ── 验收标准 2：纯 A2UI JSONL 流式返回 → 全部在右侧渲染，左侧不显示 JSON 原文 ──

  it("A2UI createSurface 消息被识别并分流到 a2uiMessages", () => {
    const json = JSON.stringify({
      version: "v0.9",
      createSurface: { surfaceId: "main", catalogId: "default" },
    });
    const result = messageRouter(json + "\n");
    expect(result.textLines).toHaveLength(0);
    expect(result.a2uiMessages).toHaveLength(1);
    expect(result.a2uiMessages[0]).toEqual({
      version: "v0.9",
      createSurface: { surfaceId: "main", catalogId: "default" },
    });
  });

  it("A2UI updateComponents 消息被识别并分流到 a2uiMessages", () => {
    const json = JSON.stringify({
      version: "v0.9",
      updateComponents: { surfaceId: "main", components: [] },
    });
    const result = messageRouter(json + "\n");
    expect(result.textLines).toHaveLength(0);
    expect(result.a2uiMessages).toHaveLength(1);
  });

  it("A2UI updateDataModel 消息被识别并分流到 a2uiMessages", () => {
    const json = JSON.stringify({
      version: "v0.9",
      updateDataModel: { surfaceId: "main", path: "/msg", value: "hello" },
    });
    const result = messageRouter(json + "\n");
    expect(result.textLines).toHaveLength(0);
    expect(result.a2uiMessages).toHaveLength(1);
  });

  it("A2UI deleteSurface 消息被识别并分流到 a2uiMessages", () => {
    const json = JSON.stringify({
      version: "v0.9",
      deleteSurface: { surfaceId: "main" },
    });
    const result = messageRouter(json + "\n");
    expect(result.textLines).toHaveLength(0);
    expect(result.a2uiMessages).toHaveLength(1);
  });

  it("多行纯 A2UI JSONL 全部归入 a2uiMessages", () => {
    const lines = [
      JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "s1", catalogId: "default" } }),
      JSON.stringify({ version: "v0.9", updateComponents: { surfaceId: "s1", components: [] } }),
      JSON.stringify({ version: "v0.9", updateDataModel: { surfaceId: "s1", path: "/x" } }),
    ].join("\n") + "\n";
    const result = messageRouter(lines);
    expect(result.textLines).toHaveLength(0);
    expect(result.a2uiMessages).toHaveLength(3);
  });

  // ── 验收标准 3：混合流式返回（文本 + A2UI 交替）→ 各自正确展示 ──

  it("文本和 A2UI 交替出现时各自正确分流", () => {
    const input = [
      "这是一段文本",
      JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "main", catalogId: "default" } }),
      "中间还有文本",
      JSON.stringify({ version: "v0.9", updateComponents: { surfaceId: "main", components: [] } }),
      "最后一行文本",
    ].join("\n") + "\n";
    const result = messageRouter(input);
    expect(result.textLines).toEqual([
      "这是一段文本",
      "中间还有文本",
      "最后一行文本",
    ]);
    expect(result.a2uiMessages).toHaveLength(2);
  });

  // ── 验收标准 4：跨 chunk 的不完整 JSON 行能被正确缓冲和拼接 ──

  it("跨 chunk 的不完整行被缓冲到 remainingBuffer", () => {
    // 第一行完整，第二行不完整（不以 \n 结尾）
    const result1 = messageRouter("完整行\n不完整");
    expect(result1.textLines).toEqual(["完整行"]);
    expect(result1.a2uiMessages).toHaveLength(0);
    expect(result1.remainingBuffer).toBe("不完整");
  });

  it("缓冲区内容与下一个 chunk 拼接后正确解析", () => {
    // 模拟一个 JSON 被跨 chunk 分割
    const json = JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "main", catalogId: "default" } });
    const half = Math.floor(json.length / 2);
    const part1 = json.slice(0, half);
    const part2 = json.slice(half) + "\n";

    const result1 = messageRouter(part1);
    expect(result1.remainingBuffer).toBe(part1);

    const result2 = messageRouter(part2, result1.remainingBuffer);
    expect(result2.textLines).toHaveLength(0);
    expect(result2.a2uiMessages).toHaveLength(1);
    expect(result2.a2uiMessages[0]).toEqual({
      version: "v0.9",
      createSurface: { surfaceId: "main", catalogId: "default" },
    });
    expect(result2.remainingBuffer).toBe("");
  });

  it("多 chunk 连续缓冲拼接正确", () => {
    const json = JSON.stringify({ version: "v0.9", updateComponents: { surfaceId: "s1", components: [] } });
    // 分成 3 段
    const len = json.length;
    const p1 = json.slice(0, Math.floor(len / 3));
    const p2 = json.slice(Math.floor(len / 3), Math.floor((2 * len) / 3));
    const p3 = json.slice(Math.floor((2 * len) / 3)) + "\n";

    const r1 = messageRouter(p1);
    expect(r1.remainingBuffer).toBe(p1);

    const r2 = messageRouter(p2, r1.remainingBuffer);
    expect(r2.remainingBuffer).toBe(p1 + p2);

    const r3 = messageRouter(p3, r2.remainingBuffer);
    expect(r3.a2uiMessages).toHaveLength(1);
    expect(r3.remainingBuffer).toBe("");
  });

  // ── 边界情况 ──

  it("空 chunk 不产生任何输出", () => {
    const result = messageRouter("");
    expect(result.textLines).toHaveLength(0);
    expect(result.a2uiMessages).toHaveLength(0);
    expect(result.remainingBuffer).toBe("");
  });

  it("空行被跳过", () => {
    const result = messageRouter("\n\n文本行\n\n");
    expect(result.textLines).toEqual(["文本行"]);
    expect(result.a2uiMessages).toHaveLength(0);
  });

  it("JSON 解析成功但不是 A2UI 消息 → 原样当文本", () => {
    const result = messageRouter(
      JSON.stringify({ foo: "bar", baz: 123 }) + "\n",
    );
    expect(result.textLines).toEqual([JSON.stringify({ foo: "bar", baz: 123 })]);
    expect(result.a2uiMessages).toHaveLength(0);
  });

  it("JSON 数组不被识别为 A2UI 消息 → 原样当文本", () => {
    const result = messageRouter(JSON.stringify([1, 2, 3]) + "\n");
    expect(result.textLines).toEqual(["[1,2,3]"]); // JSON.stringify 无空格
    expect(result.a2uiMessages).toHaveLength(0);
  });

  it("JSON 原始值不被识别为 A2UI 消息 → 原样当文本", () => {
    const result = messageRouter('"hello"\n');
    expect(result.textLines).toEqual(['"hello"']);
    expect(result.a2uiMessages).toHaveLength(0);
  });

  it("JSON null 不被识别为 A2UI 消息 → 原样当文本", () => {
    const result = messageRouter("null\n");
    expect(result.textLines).toEqual(["null"]);
    expect(result.a2uiMessages).toHaveLength(0);
  });

  it("buffer 参数默认值为空字符串", () => {
    const result = messageRouter("test\n");
    expect(result.textLines).toEqual(["test"]);
  });

  it("流结束后残留 buffer 的处理（由调用方处理）", () => {
    // 模拟流结束时的残留 buffer
    const result = messageRouter("残留文本");
    expect(result.textLines).toHaveLength(0);
    expect(result.a2uiMessages).toHaveLength(0);
    expect(result.remainingBuffer).toBe("残留文本");
    // 调用方应在流结束后将 remainingBuffer 作为文本追加
  });

  // ── a2ui 代码块支持 ──

  describe("```a2ui 代码块", () => {
    it("代码块内的 A2UI JSONL 被正确解析，标记行不出现在 textLines", () => {
      const input = [
        "这是一些文本回复",
        "```a2ui",
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "main", catalogId: "default" } }),
        JSON.stringify({ version: "v0.9", updateComponents: { surfaceId: "main", components: [] } }),
        "```",
        "更多文本",
      ].join("\n") + "\n";

      const result = messageRouter(input);
      expect(result.textLines).toEqual(["这是一些文本回复", "更多文本"]);
      expect(result.a2uiMessages).toHaveLength(2);
      expect(result.a2uiMessages[0]).toHaveProperty("createSurface");
      expect(result.a2uiMessages[1]).toHaveProperty("updateComponents");
    });

    it("代码块标记不出现在 textLines 中", () => {
      const input = "```a2ui\n" +
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "s1", catalogId: "default" } }) + "\n" +
        "```\n";

      const result = messageRouter(input);
      expect(result.textLines).toHaveLength(0);
      expect(result.a2uiMessages).toHaveLength(1);
    });

    it("代码块外的文本正常分流到 textLines", () => {
      const input = [
        "前置文本",
        "```a2ui",
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "s1", catalogId: "default" } }),
        "```",
        "后置文本",
      ].join("\n") + "\n";

      const result = messageRouter(input);
      expect(result.textLines).toEqual(["前置文本", "后置文本"]);
      expect(result.a2uiMessages).toHaveLength(1);
    });

    it("多个 a2ui 块都能被正确提取", () => {
      const input = [
        "文本1",
        "```a2ui",
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "s1", catalogId: "default" } }),
        "```",
        "文本2",
        "```a2ui",
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "s2", catalogId: "default" } }),
        "```",
        "文本3",
      ].join("\n") + "\n";

      const result = messageRouter(input);
      expect(result.textLines).toEqual(["文本1", "文本2", "文本3"]);
      expect(result.a2uiMessages).toHaveLength(2);
    });

    it("跨 chunk 的代码块开始标记在一个 chunk，内容在另一个 chunk", () => {
      // chunk1: 文本 + ```a2ui 开始标记
      const chunk1 = "前置文本\n```a2ui\n";
      const r1 = messageRouter(chunk1);
      expect(r1.textLines).toEqual(["前置文本"]);
      expect(r1.a2uiMessages).toHaveLength(0);
      // remainingBuffer 应包含 A2UI_BLOCK 标记
      expect(r1.remainingBuffer).toContain("__A2UI_BLOCK__");

      // chunk2: 块内 JSONL + 结束标记
      const chunk2 = [
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "main", catalogId: "default" } }),
        "```",
        "后置文本",
      ].join("\n") + "\n";

      const r2 = messageRouter(chunk2, r1.remainingBuffer);
      expect(r2.textLines).toEqual(["后置文本"]);
      expect(r2.a2uiMessages).toHaveLength(1);
      expect(r2.a2uiMessages[0]).toHaveProperty("createSurface");
    });

    it("跨 chunk 的代码块内容在一个 chunk，结束标记在另一个 chunk", () => {
      // chunk1: ```a2ui + JSONL 行（不完整，无结束标记）
      const chunk1 = "```a2ui\n" +
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "main", catalogId: "default" } }) + "\n";

      const r1 = messageRouter(chunk1);
      expect(r1.a2uiMessages).toHaveLength(1);
      // 仍在 a2ui 块内
      expect(r1.remainingBuffer).toContain("__A2UI_BLOCK__");

      // chunk2: 结束标记 + 后续文本
      const chunk2 = "```\n后续文本\n";
      const r2 = messageRouter(chunk2, r1.remainingBuffer);
      expect(r2.textLines).toEqual(["后续文本"]);
      expect(r2.a2uiMessages).toHaveLength(0);
      // 状态已回到 NORMAL
      expect(r2.remainingBuffer).toBe("");
    });

    it("跨 chunk 的代码块开始标记在一个 chunk 末尾（不完整行），结束标记在另一个 chunk", () => {
      // chunk1: 文本 + ```a2ui（不以 \n 结尾，留在 buffer 中）
      const chunk1 = "前置文本\n```a2ui";
      const r1 = messageRouter(chunk1);
      expect(r1.textLines).toEqual(["前置文本"]);
      expect(r1.a2uiMessages).toHaveLength(0);
      // remainingBuffer 包含不完整的 ```a2ui 行
      expect(r1.remainingBuffer).toBe("```a2ui");

      // chunk2: \n + JSONL + ``` + 文本
      const chunk2 = "\n" +
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "main", catalogId: "default" } }) + "\n" +
        "```\n" +
        "后置文本\n";

      const r2 = messageRouter(chunk2, r1.remainingBuffer);
      expect(r2.textLines).toEqual(["后置文本"]);
      expect(r2.a2uiMessages).toHaveLength(1);
    });

    it("代码块内非 JSON 行被静默跳过（不产生文本也不产生 A2UI）", () => {
      const input = [
        "```a2ui",
        "这不是合法的 JSON",
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "s1", catalogId: "default" } }),
        "```",
      ].join("\n") + "\n";

      const result = messageRouter(input);
      expect(result.textLines).toHaveLength(0);
      expect(result.a2uiMessages).toHaveLength(1);
    });

    it("代码块内 JSON 对象但不是 A2UI 消息 → 静默跳过", () => {
      const input = [
        "```a2ui",
        JSON.stringify({ foo: "bar" }),
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "s1", catalogId: "default" } }),
        "```",
      ].join("\n") + "\n";

      const result = messageRouter(input);
      expect(result.textLines).toHaveLength(0);
      expect(result.a2uiMessages).toHaveLength(1);
    });

    it("代码块内 v0.9 消息保持 v0.9 格式输出", () => {
      const input = [
        "```a2ui",
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "main", catalogId: "default" } }),
        JSON.stringify({ version: "v0.9", updateComponents: { surfaceId: "main", components: [{ id: "btn", component: "Button" }] } }),
        JSON.stringify({ version: "v0.9", updateDataModel: { surfaceId: "main", path: "/msg", value: "hello" } }),
        "```",
      ].join("\n") + "\n";

      const result = messageRouter(input);
      expect(result.a2uiMessages).toHaveLength(3);
      expect(result.a2uiMessages[0]).toEqual({
        version: "v0.9",
        createSurface: { surfaceId: "main", catalogId: "default" },
      });
      expect(result.a2uiMessages[1]).toEqual({
        version: "v0.9",
        updateComponents: { surfaceId: "main", components: [{ id: "btn", component: "Button" }] },
      });
      expect(result.a2uiMessages[2]).toEqual({
        version: "v0.9",
        updateDataModel: { surfaceId: "main", path: "/msg", value: "hello" },
      });
    });

    it("混合场景：裸 JSONL + a2ui 代码块 + 纯文本", () => {
      const input = [
        "文本开头",
        // 裸 JSONL（向后兼容）
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "s1", catalogId: "default" } }),
        "中间文本",
        // a2ui 代码块
        "```a2ui",
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "s2", catalogId: "default" } }),
        "```",
        "文本结尾",
      ].join("\n") + "\n";

      const result = messageRouter(input);
      expect(result.textLines).toEqual(["文本开头", "中间文本", "文本结尾"]);
      expect(result.a2uiMessages).toHaveLength(2);
    });

    it("未闭合的 a2ui 代码块（流结束时仍在块内）", () => {
      // 模拟流在 a2ui 块内结束
      const chunk = "```a2ui\n" +
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "main", catalogId: "default" } }) + "\n";

      const result = messageRouter(chunk);
      expect(result.a2uiMessages).toHaveLength(1);
      // 仍在块内，remainingBuffer 包含标记
      expect(result.remainingBuffer).toContain("__A2UI_BLOCK__");
    });

    it("a2ui 块内空行被跳过", () => {
      const input = [
        "```a2ui",
        "",
        JSON.stringify({ version: "v0.9", createSurface: { surfaceId: "s1", catalogId: "default" } }),
        "",
        "```",
      ].join("\n") + "\n";

      const result = messageRouter(input);
      expect(result.a2uiMessages).toHaveLength(1);
      expect(result.textLines).toHaveLength(0);
    });
  });
});
