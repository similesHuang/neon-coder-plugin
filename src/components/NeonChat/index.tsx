import useChat from "@/hooks/useChat";
import "highlight.js/styles/github.css";
import React, { useEffect, useRef } from "react";
import "./index.css";

const NeonChat: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    input,
    isLoading,
    isStreaming,
    error,
    handleInputChange,
    handleSubmit,
    setInput,
    stop,
    append,
  } = useChat({
    api: "/api/llm",
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);
  return <></>;
};
export default NeonChat;
