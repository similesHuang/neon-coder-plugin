import Router from "@koa/router";
import { Context } from "koa";
import OpenAI from "openai";
import { ChatBody } from "./types";
import { successResponse } from "./utils/response";

export const openai = new OpenAI({
  apiKey: "sk-0e9f5d876e84440391946b238a5b22d4",
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const router = new Router();

// 示例 GET 接口
router.get("/api/hello", (ctx: Context) => {
  successResponse(ctx, {
    data: "Hello, World!",
    message: "Greeting from the server",
    code: 200,
  });
});

// 调用大模型接口
router.post("/api/llm/chat", (ctx: Context) => {
  const { messages } = ctx?.request.body as ChatBody;
  console.log("Received messages:", messages);
  ctx.set("Content-Type", "text/plain; charset=utf-8");
  ctx.set("Cache-Control", "no-cache");
  ctx.set("X-Accel-Buffering", "no");

  const encoder = new TextEncoder();

  ctx.status = 200;
  ctx.body = require("stream").Readable.from(
    (async function* () {
      try {
        const completion = await openai.chat.completions.create({
          model: "qwen-max",
          messages: messages?.map((msg) => ({
            role: msg.role || "user",
            content: msg.content || "",
          })),
          stream: true,
        });

        for await (const chunk of completion) {
          const content = chunk.choices?.[0]?.delta?.content || "";
          if (content) {
            yield encoder.encode(content);
          }
        }
      } catch (err) {
        yield encoder.encode(`[ERROR] ${String(err)}`);
      }
    })()
  );
});
export default router;
