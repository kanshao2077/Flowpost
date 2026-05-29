import { browser } from "wxt/browser";
import { getAdapter } from "../../src/adapters";
import { isFillPlatformMessage, type FillPlatformResponse } from "../../src/shared/messages";

export default defineContentScript({
  matches: [
    "https://x.com/*",
    "https://twitter.com/*",
    "https://www.linkedin.com/*",
    "https://web.okjike.com/*",
    "https://*.okjike.com/*",
    "https://substack.com/*",
    "https://*.substack.com/*"
  ],
  runAt: "document_idle",
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!isFillPlatformMessage(message)) return undefined;

      void getAdapter(message.payload.platform)
        .fill(message.payload)
        .then((result): FillPlatformResponse => ({ ok: true, result }))
        .catch((error): FillPlatformResponse => {
          const detail = error instanceof Error ? error.message : String(error);
          return { ok: false, error: detail };
        })
        .then(sendResponse);

      return true;
    });
  }
});
