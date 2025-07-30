// 新建 ext-src/files.ts
import * as path from "path";
import * as vscode from "vscode";

export interface FileInfo {
  hasFile: boolean;
  fileName?: string;
  filePath?: string;
  languageId?: string;
  lineCount?: number;
  cursorPosition?: {
    line: number;
    character: number;
  };
  selection?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
    isEmpty: boolean;
    selectedText: string;
  };
  fullText?: string;
  currentLineText?: string;
  isDirty?: boolean;
  isUntitled?: boolean;
  message?: string;
}

export function getCurrentFileInfo(): FileInfo {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    return {
      hasFile: false,
      message: "没有打开的文件",
    };
  }

  const document = editor.document;
  const selection = editor.selection;
  const position = editor.selection.active;

  return {
    hasFile: true,
    // 文件基本信息
    fileName: path.basename(document.fileName),
    filePath: document.uri.fsPath,
    languageId: document.languageId,
    lineCount: document.lineCount,

    // 光标位置信息
    cursorPosition: {
      line: position.line + 1, // VS Code 从0开始，用户习惯从1开始
      character: position.character + 1,
    },

    // 选择区域信息
    selection: {
      start: {
        line: selection.start.line + 1,
        character: selection.start.character + 1,
      },
      end: {
        line: selection.end.line + 1,
        character: selection.end.character + 1,
      },
      isEmpty: selection.isEmpty,
      selectedText: selection.isEmpty ? "" : document.getText(selection),
    },

    // 文件内容
    fullText: document.getText(),
    currentLineText: document.lineAt(position.line).text,

    // 文件状态
    isDirty: document.isDirty,
    isUntitled: document.isUntitled,
  };
}
