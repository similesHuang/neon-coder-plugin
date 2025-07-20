declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage(message: any): void;
    };
  }
}

export {};
