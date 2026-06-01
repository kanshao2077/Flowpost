import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "来一发 FlowPost",
    description: "Fill and optionally publish text plus up to nine images to X, LinkedIn, Jike, and Substack Notes.",
    version: "0.1.0",
    permissions: ["storage", "tabs", "tabGroups", "windows", "unlimitedStorage"],
    host_permissions: [
      "https://x.com/*",
      "https://twitter.com/*",
      "https://www.linkedin.com/*",
      "https://web.okjike.com/*",
      "https://*.okjike.com/*",
      "https://substack.com/*",
      "https://*.substack.com/*"
    ],
    icons: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    action: {
      default_title: "来一发",
      default_icon: {
        "16": "icons/icon16.png",
        "32": "icons/icon32.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png"
      }
    }
  }
});
