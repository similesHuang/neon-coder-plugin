// ext-src/providers/knowledgeProvider.ts
import {
  ContextProvider,
  ContextResult,
  KnowledgeItem,
  KnowledgeSource,
  Message,
} from "../types";

export class KnowledgeProvider implements ContextProvider {
  name = "Knowledge Base";
  priority = 80;
  private knowledgeSource: KnowledgeSource | null = null;
  private config: any;

  constructor(config?: any) {
    this.config = config || {};
  }

  async initialize(): Promise<void> {
    console.log("Initializing knowledge base with config:", this.config);

    // 创建知识库实例
    this.knowledgeSource = new VectorKnowledgeSource(this.config);
    if (this.knowledgeSource.initialize) {
      await this.knowledgeSource.initialize();
    }
  }

  async getContext(query: string, messages: Message[]): Promise<ContextResult> {
    if (!this.knowledgeSource) {
      return { content: "", source: "Knowledge Base", confidence: 0 };
    }

    try {
      // 提取关键词进行搜索
      const searchQuery = this.extractSearchKeywords(query);
      if (!searchQuery) {
        return { content: "", source: "Knowledge Base", confidence: 0 };
      }

      const results = await this.knowledgeSource.search(searchQuery, 3);

      if (results.length === 0) {
        return { content: "", source: "Knowledge Base", confidence: 0 };
      }

      const content = results
        .map((item) => `**${item.title || "Document"}:**\n${item.content}`)
        .join("\n\n---\n\n");

      const avgScore =
        results.reduce((sum, item) => sum + item.score, 0) / results.length;

      return {
        content,
        source: "Knowledge Base",
        confidence: Math.min(avgScore, 1.0),
        metadata: {
          resultCount: results.length,
          sources: results.map((r) => r.source),
          searchQuery,
        },
      };
    } catch (error) {
      console.error("Knowledge base search error:", error);
      return { content: "", source: "Knowledge Base", confidence: 0 };
    }
  }

  private extractSearchKeywords(query: string): string {
    // 简单的关键词提取逻辑
    const stopWords = [
      "的",
      "是",
      "在",
      "有",
      "和",
      "或",
      "但是",
      "因为",
      "所以",
      "怎么",
      "如何",
      "什么",
      "为什么",
    ];
    const words = query
      .split(/\s+|[，。！？；：]/)
      .filter((word) => word.length > 1 && !stopWords.includes(word));
    return words.slice(0, 5).join(" "); // 取前5个关键词
  }
}

// 示例向量知识库实现
class VectorKnowledgeSource implements KnowledgeSource {
  private documents: KnowledgeItem[] = [];

  constructor(private config: any) {}

  async initialize(): Promise<void> {
    // 初始化时加载一些示例文档
    this.documents = [
      {
        id: "1",
        content:
          "React是一个用于构建用户界面的JavaScript库。它采用组件化的开发方式，使用虚拟DOM来提高性能。",
        title: "React基础知识",
        source: "docs",
        score: 0.9,
        metadata: { type: "documentation", category: "frontend" },
      },
      {
        id: "2",
        content:
          "TypeScript是JavaScript的超集，添加了静态类型定义。它可以在编译时捕获错误，提高代码质量。",
        title: "TypeScript介绍",
        source: "docs",
        score: 0.85,
        metadata: { type: "documentation", category: "language" },
      },
      {
        id: "3",
        content:
          "VS Code扩展开发使用TypeScript和VS Code API。扩展可以提供自定义命令、视图、语言支持等功能。",
        title: "VS Code扩展开发",
        source: "docs",
        score: 0.8,
        metadata: { type: "documentation", category: "extension" },
      },
    ];
  }

  async search(query: string, limit = 5): Promise<KnowledgeItem[]> {
    // 简单的文本匹配搜索
    const keywords = query.toLowerCase().split(" ");

    const results = this.documents
      .map((doc) => {
        const content = doc.content.toLowerCase();
        const title = (doc.title || "").toLowerCase();

        let score = 0;
        keywords.forEach((keyword) => {
          if (content.includes(keyword)) score += 0.5;
          if (title.includes(keyword)) score += 0.3;
        });

        return { ...doc, score: Math.min(score, 1.0) };
      })
      .filter((doc) => doc.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  async index(content: string, metadata: Record<string, any>): Promise<void> {
    const newDoc: KnowledgeItem = {
      id: Date.now().toString(),
      content,
      title: metadata.title || "Untitled",
      source: metadata.source || "user",
      score: 1.0,
      metadata,
    };

    this.documents.push(newDoc);
    console.log("Indexed new document:", newDoc.title);
  }
}
