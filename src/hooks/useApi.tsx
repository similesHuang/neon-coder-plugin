import getVSCodeInstance from "./useVscode";

const vs = getVSCodeInstance();

export const callStreamApi = (
  options?: RequestInit,
  onChunk?: (chunk: string, fullContent: string) => void,
  onComplete?: (fullContent: string) => void,
  onError?: (error: Error) => void
) => {
  let aborted = false;
  let fullContent = "";
  if (!vs) throw new Error("VS Code API is not available");

  const requestId = Math.random().toString(36).slice(2);

  // 解析消息数据
  let messages = [];
  try {
    if (options?.body) {
      const body =
        typeof options.body === "string"
          ? JSON.parse(options.body)
          : options.body;
      messages = body.messages || [];
    }
  } catch (error) {
    console.error("Failed to parse request body:", error);
  }

  vs.postMessage({
    command: "streamRequest",
    messages,
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

  return { promise, abort };
};
