import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "../types/chat";
import { callStreamApi } from "./useApi";
import getVSCodeInstance from "./useVscode";

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
  currentSessionId: string | null;
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
const vs = getVSCodeInstance();
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
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const abortControllerRef = useRef<{ abort: () => void } | null>(null);

  const generateId = () =>
    Date.now().toString() + Math.random().toString(36).slice(2, 9);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  // 保存消息到当前会话
  const saveMessageToSession = useCallback(
    (message: Message) => {
      if (currentSessionId) {
        vs.postMessage({
          command: "saveMessage",
          message: {
            id: message.id,
            role: message.role,
            content: message.content,
            timestamp: Date.now(),
          },
        });
      }
    },
    [currentSessionId]
  );

  const sendMessage = useCallback(
    async (messagesToSend: Message[]) => {
      setIsLoading(true);
      setIsStreaming(true);
      setError(null);

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
            console.log("Received chunk:", chunk);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: msg.content + chunk }
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

            // 保存消息到当前会话
            saveMessageToSession(finalMessage);
            onFinish?.(finalMessage);
          },
          (error: Error) => {
            setIsStreaming(false);
            setIsLoading(false);

            if (error.message === "Aborted") {
              return;
            }

            setError(error);
            onError?.(error);
          }
        );

        abortControllerRef.current = { abort };
        await promise;
      } catch (err) {
        const error = err as Error;
        console.error("Error in sendMessage:", error);
        if (error.message !== "This operation was aborted") {
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
    [
      api,
      headers,
      onError,
      onFinish,
      onResponse,
      saveMessageToSession,
      isStreaming,
    ]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!input.trim() || isLoading || !isInitialized) {
        return;
      }

      if (!currentSessionId) {
        vs.postMessage({
          command: "createNewSession",
          title: input.trim().slice(0, 20) + "...",
        });
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

      saveMessageToSession(userMessage);
      await sendMessage(newMessages);
    },
    [
      input,
      isLoading,
      messages,
      sendMessage,
      isInitialized,
      currentSessionId,
      saveMessageToSession,
    ]
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
      saveMessageToSession(newMessage);
      if (message.role === "user") {
        await sendMessage(newMessages);
      }
    },
    [messages, sendMessage, saveMessageToSession, isInitialized]
  );

  const reload = useCallback(async () => {
    if (messages.length === 0 || isLoading || !isInitialized) return;

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
  }, [messages, sendMessage, isLoading, isInitialized]);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    setIsStreaming(false);
    setError(null);
  }, []);

  // 初始化：获取当前会话或创建新会话
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // 请求当前会话
        vs.postMessage({
          command: "getCurrentSession",
        });
      } catch (error) {
        console.error("Error initializing session:", error);
        onError?.(error as Error);
      }
    };

    if (!isInitialized) {
      initializeSession();
    }
  }, [isInitialized, onError]);

  // 监听来自插件的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case "currentSessionLoaded":
          if (message.session) {
            // 已有会话，加载聊天记录
            setCurrentSessionId(message.session.id);
            setMessages(message.session.messages || []);
            setIsInitialized(true);
          } else {
            // 没有当前会话，创建新会话
            vs.postMessage({
              command: "createNewSession",
              title: "新对话",
            });
          }
          break;

        case "sessionCreated":
          setCurrentSessionId(message.session.id);
          setMessages(message.session.messages || []);
          setIsInitialized(true);
          break;

        case "sessionSwitched":
          if (message.session) {
            setCurrentSessionId(message.session.id);
            setMessages(message.session.messages || []);
            setInput("");
            setError(null);
            setIsLoading(false);
            setIsStreaming(false);
          } else {
            // 如果没有会话信息，清空所有状态
            setCurrentSessionId(null);
            setMessages([]);
            setInput("");
            setError(null);
            setIsLoading(false);
            setIsStreaming(false);
          }
          break;

        case "messageSaved":
          if (message.success && message.currentSession) {
            // 消息保存成功，可以进行其他操作
            console.log("Message saved successfully");
          }
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);
  useEffect(() => {
    console.log("Messages updated:", messages);
  }, [messages]);
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
    currentSessionId,
  };
};

export default useChat;
