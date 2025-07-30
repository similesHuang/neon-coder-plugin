import { useEffect, useState } from "react";
import { FileInfo } from "../types/file";
import getVSCodeInstance from "./useVscode";

const vs = getVSCodeInstance();
const useFile = () => {
  const [fileList, setFileList] = useState<FileInfo[]>([]);
  const [currentFile, setCurrentFile] = useState<FileInfo | null>(null);

  const requestCurrentFile = () => {
    console.log("📤 Requesting current file info");
    vs.postMessage({
      command: "getCurrentFileInfo",
      timestamp: Date.now(),
    });
  };
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case "currentFileInfo": {
          const fileInfo: FileInfo = message.fileInfo;
          setCurrentFile(fileInfo);
          break;
        }
      }
    };
    window.addEventListener("message", handleMessage);
    requestCurrentFile();
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return {
    currentFile,
    fileList,
    requestCurrentFile,
  };
};
export default useFile;
