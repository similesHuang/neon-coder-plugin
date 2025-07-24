const vs = window?.acquireVsCodeApi?.();
const baseUrl = "http://localhost:3002";
export const callApi = (
  api: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  options?: RequestInit
): Promise<{
  code: number;
  message: string;
  data?: any;
}> => {
  return new Promise((resolve, reject) => {
    if (!vs) {
      reject(new Error("VS Code API is not available"));
      return;
    }

    api = `${baseUrl}${api}`;

    // 合并请求配置
    const requestOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    };

    vs.postMessage({
      command: "request",
      api,
      method,
      options: requestOptions,
    });

    const messageListener = (event: MessageEvent) => {
      if (event.data.command === "response" && event.data.api === api) {
        window.removeEventListener("message", messageListener);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.response);
        }
      }
    };
    window.addEventListener("message", messageListener);
  });
};

export const callStreamApi = (
  api: string,
  options?: RequestInit,
  onChunk?: (chunk: string, fullContent: string) => void,
  onComplete?: (fullContent: string) => void,
  onError?: (error: Error) => void
) => {
  let aborted = false;
  let fullContent = "";
  console.log("Calling stream API:", api, options);
  if (!vs) throw new Error("VS Code API is not available");

  const requestId = Math.random().toString(36).slice(2);

  vs.postMessage({
    command: "streamRequest",
    api: `${baseUrl}${api}`,
    options: {
      ...options,
      signal: undefined,
    },
    requestId,
  });

  const abort = () => {
    aborted = true;
    vs.postMessage({ command: "abortStream", requestId });
  };

  const promise = new Promise<string>((resolve, reject) => {
    function messageListener(event: MessageEvent) {
      const msg = event.data;
      if (!msg || msg.requestId !== requestId) return;
      if (msg.command === "streamChunk") {
        fullContent += msg.chunk;
        onChunk?.(msg.chunk, fullContent);
      }
      if (msg.command === "streamComplete") {
        window.removeEventListener("message", messageListener);
        onComplete?.(fullContent);
        resolve(fullContent);
      }
      if (msg.command === "streamError") {
        window.removeEventListener("message", messageListener);
        onError?.(new Error(msg.error));
        reject(new Error(msg.error));
      }
      if (msg.command === "streamAbort") {
        window.removeEventListener("message", messageListener);
        reject(new Error("Aborted"));
      }
    }
    window.addEventListener("message", messageListener);
  });

  // 返回 promise 和 abort 方法
  return { promise, abort };
};
