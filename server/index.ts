import cors from "@koa/cors";
import Koa from "koa";
import bodyParser from "koa-bodyparser";
import router from "./routes";

export const startServer = (port: number = 3002) => {
  const app = new Koa();
  if (process.env.NODE_ENV === "development") {
    app.use(
      cors({
        origin: "http://localhost:3000", // 允许 CRA 前端访问
      })
    );
  }
  app.use(bodyParser());
  app.use(router.routes());

  return app.listen(port, () => {
    console.log("__SERVER_STARTED__");
    console.log(`Koa server running on port ${port}`);
  });
};

if (process.env.NODE_ENV === "development") {
  startServer();
}
