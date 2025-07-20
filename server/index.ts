import Koa from "koa";
import router from "./routes";

export const startServer = (port: number = 3001) => {
  const app = new Koa();

  app.use(router.routes());

  return app.listen(port, () => {
    console.log("__SERVER_STARTED__");
    console.log(`Koa server running on port ${port}`);
  });
};

if (process.env.NODE_ENV === "development") {
  startServer();
}
