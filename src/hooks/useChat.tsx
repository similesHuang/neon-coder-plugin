import { useCallback, useRef, useState } from "react";
import type { Message } from "../types/chat";
import { callStreamApi } from "./useApi";

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
  isStreaming: boolean;
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

const useChat = (options: ChatProps): UseChatReturn => {
  const {
    api,
    initialMessages = [],
    onError,
    onFinish,
    onResponse,
    headers = {},
  } = options;

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<{ abort: () => void } | null>(null);
  const streamRef = useRef<{ fullContent: string }>({ fullContent: "" });

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
      streamRef.current.fullContent = "";

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const { promise, abort } = callStreamApi(
          api,
          {
            headers: {
              "Content-Type": "application/json",
              ...headers,
            },
            body: JSON.stringify({
              messages: messagesToSend.map(
                ({ id, timestamp, ...rest }) => rest
              ),
            }),
          },
          (chunk: string, fullContent: string) => {
            streamRef.current.fullContent = fullContent;

            if (!isStreaming) {
              setIsStreaming(true);
              setIsLoading(false);
            }

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: fullContent }
                  : msg
              )
            );
          },
          (fullContent: string) => {
            setIsStreaming(false);
            setIsLoading(false);

            const finalMessage = {
              ...assistantMessage,
              content: fullContent,
            };

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id ? finalMessage : msg
              )
            );

            onFinish?.(finalMessage);
          },
          (error: Error) => {
            if (error.message === "Aborted") {
              return;
            }

            setIsStreaming(false);
            setIsLoading(false);
            setError(error);
            onError?.(error);

            setMessages((prev) =>
              prev.filter((msg) => msg.id !== assistantMessage.id)
            );
          }
        );

        abortControllerRef.current = { abort };
        await promise;

        if (onResponse) {
          // Create a mock Response object if needed
          const response = new Response(
            JSON.stringify({
              content: streamRef.current.fullContent,
            })
          );
          onResponse(response);
        }
      } catch (err) {
        const error = err as Error;

        if (error.message !== "Aborted") {
          setIsStreaming(false);
          setIsLoading(false);
          setError(error);
          onError?.(error);

          setMessages((prev) =>
            prev.filter((msg) => msg.id !== assistantMessage.id)
          );
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [api, headers, onError, onFinish, onResponse, isStreaming]
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

    let lastUserMessageIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMessageIndex = i;
        break;
      }
    }
    if (lastUserMessageIndex === -1) return;

    const messagesToReload = messages.slice(0, lastUserMessageIndex + 1);
    setMessages(messagesToReload);

    await sendMessage(messagesToReload);
  }, [messages, sendMessage, isLoading]);

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
