import { chatService, Message } from "../../ext-src/service";

interface StreamRequestOptions {
  url: string;
  body?: string;
  headers?: Record<string, string>;
  onChunk?: (chunk: string, fullContent: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

export const streamRequest = async ({
  url,
  body,
  headers,
  onChunk,
  onComplete,
  onError,
  signal,
}: StreamRequestOptions) => {
  try {
    // 解析请求体中的消息
    let messages: Message[] = [];
    if (body) {
      try {
        const parsedBody = JSON.parse(body);
        messages = parsedBody.messages || [];
      } catch (error) {
        throw new Error("Invalid request body format");
      }
    }

    // 确保chatService已初始化
    if (!chatService.getConfig().apiKey) {
      throw new Error("API Key not configured. Please set your API key first.");
    }

    let fullContent = "";
    let aborted = false;

    // 监听取消信号
    const abortListener = () => {
      aborted = true;
    };
    signal?.addEventListener("abort", abortListener);

    try {
      // 使用chatService的流式聊天
      for await (const response of chatService.streamChat(messages)) {
        // 检查是否被取消
        if (aborted || signal?.aborted) {
          throw new Error("Request aborted");
        }

        if (response.error) {
          throw new Error(response.error);
        }

        if (response.isComplete) {
          onComplete?.(fullContent);
          break;
        }

        if (response.content) {
          fullContent += response.content;
          onChunk?.(response.content, fullContent);
        }
      }
    } finally {
      signal?.removeEventListener("abort", abortListener);
    }

    return fullContent;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    throw err;
  }
};
