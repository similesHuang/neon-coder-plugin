import { Message } from "@/types/chat";
import { useCallback, useRef, useState } from "react";
import { streamRequest } from "../../uitils/request/streamRequest";

interface ChatProps {
  api: string;
  initialMessages?: Message[];
  onError?: (error: Error) => void;
  onFinish?: (message: Message) => void;
  onResponse?: (response: Response) => void;
  headers?: Record<string, string>;
}
interface UseChatReturn {
  messages: Message[];
  input: string;
  isLoading: boolean;
  isStreaming: boolean; // 新增：标记是否正在流式传输
  error: Error | null;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  handleSubmit: (e: React.FormEvent) => void;
  setInput: (input: string) => void;
  append: (message: Omit<Message, "id" | "createdAt">) => void;
  reload: () => void;
  stop: () => void;
  setMessages: (messages: Message[]) => void;
}
const useChat: (options: ChatProps) => UseChatReturn = (options) => {
  const {
    api,
    initialMessages = [],
    onError,
    onFinish,
    headers = {},
  } = options;
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 用于取消请求的 AbortController
  const abortControllerRef = useRef<AbortController | null>(null);
  const generateId = () =>
    Date.now().toString() + Math.random().toString(36).slice(2, 9);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const sendMessage = useCallback(
    async (messagesToSend: Message[]) => {
      setIsLoading(true);
      setIsStreaming(false);
      setError(null);
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      try {
        await streamRequest({
          url: api,
          body: {
            messages: messagesToSend.map(({ id, timestamp, ...rest }) => rest),
          },
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          signal,
          onChunk: (chunk: string, fullcontent: string) => {
            if (signal.aborted) {
              // 不改变状态，由 stop() 函数负责
              return;
            }

            // 收到第一个 chunk 时，修改状态
            if (!isStreaming) {
              setIsStreaming(true); // 开始流式传输
              setIsLoading(false); // 结束初始加载
            }

            // 更新助手消息内容
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: msg.content + chunk }
                  : msg
              )
            );
          },
          onComplete: (fullContent: string) => {
            if (signal.aborted) {
              return;
            }

            setIsStreaming(false);
            setIsLoading(false);

            setMessages((prev) => {
              const updatedMessages = prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: fullContent || msg.content }
                  : msg
              );

              const finalMessage = updatedMessages.find(
                (msg) => msg.id === assistantMessage.id
              );
              if (finalMessage) {
                onFinish?.(finalMessage);
              }

              return updatedMessages;
            });
          },
          onError: (error: Error) => {
            if (error.name === "AbortError" || signal.aborted) {
              return;
            }

            setIsStreaming(false);
            setIsLoading(false);
            setError(error);
            onError?.(error);

            setMessages((prev) =>
              prev.filter((msg) => msg.id !== assistantMessage.id)
            );
          },
        });
      } catch (err) {
        const error = err as Error;

        if (error.name === "AbortError" || signal.aborted) {
          return;
        }

        setIsStreaming(false);
        setIsLoading(false);
        setError(error);
        onError?.(error);

        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessage.id)
        );
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
          setIsStreaming(false);
        }
        abortControllerRef.current = null;
      }
    },
    [api, headers, onError, onFinish, isStreaming]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!input.trim() || isLoading) {
        return;
      }

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: input.trim(),
        timestamp: new Date().toISOString(),
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");

      await sendMessage(newMessages);
    },
    [input, isLoading, messages, sendMessage]
  );

  const append = useCallback(
    async (message: Omit<Message, "id" | "timestamp">) => {
      const newMessage: Message = {
        ...message,
        id: generateId(),
        timestamp: new Date().toISOString(),
      };

      const newMessages = [...messages, newMessage];
      setMessages(newMessages);

      if (message.role === "user") {
        await sendMessage(newMessages);
      }
    },
    [messages, sendMessage]
  );

  const reload = useCallback(async () => {
    if (messages.length === 0 || isLoading) return;

    // const lastUserMessageIndex = messages?.findLastIndex(
    //   (msg) => msg.role === "user"
    // );

    // if (lastUserMessageIndex === -1) return;

    // const messagesToReload = messages.slice(0, lastUserMessageIndex + 1);
    // setMessages(messagesToReload);

    // await sendMessage(messagesToReload);
  }, [messages, sendMessage, isLoading, isStreaming]);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    setIsStreaming(false);
    setError(null);
  }, []);

  return {
    messages,
    input,
    isLoading,
    isStreaming,
    error,
    handleInputChange,
    handleSubmit,
    setInput,
    append,
    reload,
    stop,
    setMessages,
  };
};
export default useChat;
