// src/types/file.ts
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
