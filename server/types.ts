export interface Message {
  role?: "user" | "system" | "assistant";
  createdAt?: Date;
  content?: string;
  id?: string;
  timestamp?: string;
}

export interface ChatBody {
  messages: Message[];
}
