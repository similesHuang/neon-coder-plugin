import httpRequest from ".";

interface StreamRequestOptions {
  url: string;
  body?: any;
  headers?: Record<string, string>;
  onChunk?: (chunk: string, fullContent: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

export const streamRequest = async ({
  url,
  body,
  headers = {},
  onChunk,
  onComplete,
  onError,
  signal,
}: StreamRequestOptions) => {
  try {
    const response = await httpRequest.post(url, {
      headers: headers,
      signal,
      body,
    });
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }
    const decoder = new TextDecoder();
    let fullContent = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullContent += chunk;
      onChunk?.(chunk, fullContent);
    }
    onComplete?.(fullContent);
    return fullContent;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    throw err;
  }
};
