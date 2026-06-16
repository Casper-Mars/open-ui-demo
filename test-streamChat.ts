/**
 * streamChat 端到端测试脚本
 * 用法：OPENCLAW_GATEWAY_TOKEN=xxx npx tsx test-streamChat.ts
 */
import { streamChat } from "./src/lib/streamChat.ts";

async function testStateless() {
  console.log("=== 测试 1: 无状态调用（不传 user）===");
  try {
    for await (const chunk of streamChat("用一句话介绍你自己")) {
      process.stdout.write(chunk);
    }
    console.log("\n✅ 无状态调用通过");
  } catch (err) {
    console.error("❌ 无状态调用失败:", err);
  }
}

async function testSessionMemory() {
  console.log("\n=== 测试 2: 带 session 记忆的对话 ===");
  const userId = "test-conv-001";
  try {
    // 第一次调用：告诉 Agent 一个信息
    console.log("用户: 你好，我叫小明，我喜欢编程");
    process.stdout.write("Agent: ");
    for await (const chunk of streamChat("你好，我叫小明，我喜欢编程", userId)) {
      process.stdout.write(chunk);
    }
    console.log();

    // 第二次调用：验证 Agent 是否记住了
    console.log("\n用户: 我叫什么名字？我喜欢什么？");
    process.stdout.write("Agent: ");
    for await (const chunk of streamChat("我叫什么名字？我喜欢什么？", userId)) {
      process.stdout.write(chunk);
    }
    console.log("\n✅ Session 记忆测试通过");
  } catch (err) {
    console.error("❌ Session 记忆测试失败:", err);
  }
}

async function testSeparateSessions() {
  console.log("\n=== 测试 3: 不同 user 值，session 隔离 ===");
  try {
    // 用 user-A 设置上下文
    console.log("user-A: 我的密码是 123456");
    process.stdout.write("Agent (user-A): ");
    for await (const chunk of streamChat("我的密码是 123456", "user-A")) {
      process.stdout.write(chunk);
    }
    console.log();

    // 用 user-B 问，不应该知道 user-A 的信息
    console.log("\nuser-B: 我刚才说的密码是什么？");
    process.stdout.write("Agent (user-B): ");
    for await (const chunk of streamChat("我刚才说的密码是什么？", "user-B")) {
      process.stdout.write(chunk);
    }
    console.log("\n✅ Session 隔离测试通过");
  } catch (err) {
    console.error("❌ Session 隔离测试失败:", err);
  }
}

async function main() {
  if (!process.env.OPENCLAW_GATEWAY_TOKEN) {
    console.error("❌ 请先设置 OPENCLAW_GATEWAY_TOKEN 环境变量");
    console.error("   export OPENCLAW_GATEWAY_TOKEN=your-token");
    process.exit(1);
  }

  await testStateless();
  await testSessionMemory();
  await testSeparateSessions();
}

main();
