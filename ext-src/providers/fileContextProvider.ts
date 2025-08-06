// ext-src/providers/fileContextProvider.ts
import * as vscode from "vscode";
import { ContextProvider, ContextResult, Message } from "../types";

export class FileContextProvider implements ContextProvider {
  name = "File";
  priority = 100;

  async initialize(): Promise<void> {
    console.log("File context provider initialized");
  }

  async getContext(query: string, messages: Message[]): Promise<ContextResult> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return { content: "", source: "File Context", confidence: 0 };
    }

    const document = activeEditor.document;
    const selection = activeEditor.selection;

    let content = "";
    let confidence = 0.5;

    // 如果有选中的代码
    if (!selection.isEmpty) {
      const selectedText = document.getText(selection);
      content = `当前选中的代码:\n\`\`\`${document.languageId}\n${selectedText}\n\`\`\``;
      confidence = 0.9;
    } else {
      // 获取当前文件的基本信息
      const fileName = document.fileName.split("/").pop() || document.fileName;
      const languageId = document.languageId;
      const lineCount = document.lineCount;

      content = `当前打开的文件: ${fileName}\n语言: ${languageId}\n总行数: ${lineCount}`;
      confidence = 0.3;

      // 如果查询涉及当前文件，提供更多上下文
      if (this.isQueryRelatedToCurrentFile(query)) {
        const currentContent = document.getText();
        // 限制文件内容长度
        const truncatedContent =
          currentContent.length > 2000
            ? currentContent.substring(0, 2000) + "\n... (文件内容过长，已截断)"
            : currentContent;
        content += `\n\n文件内容:\n\`\`\`${languageId}\n${truncatedContent}\n\`\`\``;
        confidence = 0.8;
      }
    }

    return {
      content,
      source: "File Context",
      confidence,
      metadata: {
        fileName: document.fileName,
        languageId: document.languageId,
        hasSelection: !selection.isEmpty,
        lineCount: document.lineCount,
      },
    };
  }

  private isQueryRelatedToCurrentFile(query: string): boolean {
    const keywords = [
      "当前",
      "这个文件",
      "这段代码",
      "代码",
      "文件",
      "函数",
      "类",
      "方法",
    ];
    return keywords.some((keyword) => query.includes(keyword));
  }
}
