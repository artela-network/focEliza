// src/services/DefaiProtocolService.ts
import { Service, ServiceType, elizaLogger } from "@elizaos/core";
var DefaiProtocolService = class extends Service {
  runtime;
  getInstance() {
    return this;
  }
  static get serviceType() {
    return ServiceType.DEFAI_PROTOCOL;
  }
  initialize(runtime) {
    this.runtime = runtime;
    return;
  }
  async post(data) {
    const body = JSON.stringify({
      text: data
    });
    const res = await fetch("https://6514f8b047a322952b157363f1da5d3634ee2277-80.dstack-prod4.phala.network/defai-protocol/message", {
      "headers": {
        "accept": "*/*",
        "accept-language": "en,zh-CN;q=0.9,zh;q=0.8",
        "content-type": "application/json"
      },
      "body": body,
      "method": "POST"
    });
    return await res.json();
  }
  /**
   * Connect to WebSocket and send a message
   */
  async generate(text) {
    try {
      elizaLogger.log("input text", text);
      const response = await this.post(text);
      elizaLogger.log("response text", response);
      return response;
    } catch (e) {
      elizaLogger.error(e);
      return "error";
    }
  }
};

// src/index.ts
var defaiProtocolPlugin = {
  name: "defaiProtocol",
  description: "defaiProtocol Plugin for Eliza - Enables WebSocket communication for AI-driven market insights",
  actions: [],
  evaluators: [],
  providers: [],
  services: [new DefaiProtocolService()]
};
var index_default = defaiProtocolPlugin;
export {
  DefaiProtocolService,
  defaiProtocolPlugin,
  index_default as default
};
//# sourceMappingURL=index.js.map