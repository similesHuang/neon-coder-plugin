import Router from "@koa/router";
import { Context } from "koa";

const router = new Router();

// 示例 GET 接口
router.get("/api/hello", (ctx: Context) => {
  ctx.body = { message: "From Koa in VS Code Extension!" };
});

export default router;
