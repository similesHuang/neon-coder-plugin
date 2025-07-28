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

export interface SelectedCodeInfo {
  text: string;
  selection: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  fileName: string;
  languageId: string;
  hasSelection: boolean;
}

// 获取当前文件完整信息
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

// 获取选中的代码
export function getSelectedCode(): SelectedCodeInfo | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return null;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  return {
    text: selectedText,
    selection: {
      start: {
        line: selection.start.line + 1,
        character: selection.start.character + 1,
      },
      end: {
        line: selection.end.line + 1,
        character: selection.end.character + 1,
      },
    },
    fileName: path.basename(editor.document.fileName),
    languageId: editor.document.languageId,
    hasSelection: !selection.isEmpty,
  };
}

// 获取当前行内容
export function getCurrentLine(): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return "";
  }

  const position = editor.selection.active;
  return editor.document.lineAt(position.line).text;
}

// 获取指定范围的代码
export function getCodeInRange(startLine: number, endLine: number): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return "";
  }

  const start = new vscode.Position(startLine - 1, 0); // 转换为0基索引
  const end = new vscode.Position(
    endLine - 1,
    editor.document.lineAt(endLine - 1).text.length
  );
  const range = new vscode.Range(start, end);

  return editor.document.getText(range);
}

// 在指定位置插入代码
export async function insertCodeAtPosition(
  code: string,
  line?: number,
  character?: number
): Promise<boolean> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return false;
  }

  const position =
    line !== undefined && character !== undefined
      ? new vscode.Position(line - 1, character - 1) // 转换为0基索引
      : editor.selection.active;

  try {
    await editor.edit((editBuilder) => {
      editBuilder.insert(position, code);
    });
    return true;
  } catch (error) {
    console.error("Error inserting code:", error);
    return false;
  }
}

// 替换选中的代码
export async function replaceSelectedCode(newCode: string): Promise<boolean> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return false;
  }

  try {
    await editor.edit((editBuilder) => {
      if (!editor.selection.isEmpty) {
        editBuilder.replace(editor.selection, newCode);
      } else {
        editBuilder.insert(editor.selection.active, newCode);
      }
    });
    return true;
  } catch (error) {
    console.error("Error replacing code:", error);
    return false;
  }
}
