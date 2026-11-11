type NativeDownloads = { postMessage(message: string): void };

export function saveNativeMarkdown(filename: string, content: string): boolean {
  if (typeof window === "undefined") return false;
  const bridge = (window as Window & { RethosDownloads?: NativeDownloads }).RethosDownloads;
  if (!bridge) return false;
  bridge.postMessage(JSON.stringify({ type: "save-text", filename, content, mime: "text/markdown" }));
  return true;
}
