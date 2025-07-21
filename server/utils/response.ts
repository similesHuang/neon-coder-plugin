import { Context } from "koa";

type SuccessParams<T> = {
  data?: T;
  message?: string;
  code?: number;
};

// 成功响应
export const successResponse = <T>(
  ctx: Context,
  params: SuccessParams<T> = {}
) => {
  ctx.status = 200;
  ctx.body = {
    message: params.message || "success",
    data: params.data,
    code: params.code || 200,
  };
};

// 错误响应
export const errorResponse = (
  ctx: Context,
  message: string,
  code: number = 400
) => {
  ctx.status = 400;
  ctx.body = {
    message,
    code,
  };
};
