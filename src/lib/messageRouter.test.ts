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

  it("A2UI beginRendering 消息被识别并分流到 a2uiMessages", () => {
    const json = JSON.stringify({
      beginRendering: { surfaceId: "main", catalogId: "default" },
    });
    const result = messageRouter(json + "\n");
    expect(result.textLines).toHaveLength(0);
    expect(result.a2uiMessages).toHaveLength(1);
    expect(result.a2uiMessages[0]).toEqual({
      beginRendering: { surfaceId: "main", catalogId: "default" },
    });
  });

  it("A2UI surfaceUpdate 消息被识别并分流到 a2uiMessages", () => {
    const json = JSON.stringify({
      surfaceUpdate: { surfaceId: "main", components: [] },
    });
    const result = messageRouter(json + "\n");
    expect(result.textLines).toHaveLength(0);
    expect(result.a2uiMessages).toHaveLength(1);
  });

  it("A2UI dataModelUpdate 消息被识别并分流到 a2uiMessages", () => {
    const json = JSON.stringify({
      dataModelUpdate: { surfaceId: "main", path: "/msg", value: "hello" },
    });
    const result = messageRouter(json + "\n");
    expect(result.textLines).toHaveLength(0);
    expect(result.a2uiMessages).toHaveLength(1);
  });

  it("A2UI deleteSurface 消息被识别并分流到 a2uiMessages", () => {
    const json = JSON.stringify({
      deleteSurface: { surfaceId: "main" },
    });
    const result = messageRouter(json + "\n");
    expect(result.textLines).toHaveLength(0);
    expect(result.a2uiMessages).toHaveLength(1);
  });

  it("多行纯 A2UI JSONL 全部归入 a2uiMessages", () => {
    const lines = [
      JSON.stringify({ beginRendering: { surfaceId: "s1" } }),
      JSON.stringify({ surfaceUpdate: { surfaceId: "s1", components: [] } }),
      JSON.stringify({ dataModelUpdate: { surfaceId: "s1", path: "/x" } }),
    ].join("\n") + "\n";
    const result = messageRouter(lines);
    expect(result.textLines).toHaveLength(0);
    expect(result.a2uiMessages).toHaveLength(3);
  });

  // ── 验收标准 3：混合流式返回（文本 + A2UI 交替）→ 各自正确展示 ──

  it("文本和 A2UI 交替出现时各自正确分流", () => {
    const input = [
      "这是一段文本",
      JSON.stringify({ beginRendering: { surfaceId: "main" } }),
      "中间还有文本",
      JSON.stringify({ surfaceUpdate: { surfaceId: "main", components: [] } }),
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
    const json = JSON.stringify({ beginRendering: { surfaceId: "main" } });
    const half = Math.floor(json.length / 2);
    const part1 = json.slice(0, half);
    const part2 = json.slice(half) + "\n";

    const result1 = messageRouter(part1);
    expect(result1.remainingBuffer).toBe(part1);

    const result2 = messageRouter(part2, result1.remainingBuffer);
    expect(result2.textLines).toHaveLength(0);
    expect(result2.a2uiMessages).toHaveLength(1);
    expect(result2.a2uiMessages[0]).toEqual({
      beginRendering: { surfaceId: "main" },
    });
    expect(result2.remainingBuffer).toBe("");
  });

  it("多 chunk 连续缓冲拼接正确", () => {
    const json = JSON.stringify({ surfaceUpdate: { surfaceId: "s1" } });
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
});
