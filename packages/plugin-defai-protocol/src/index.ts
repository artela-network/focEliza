import { Plugin } from "@elizaos/core";
import {DefaiProtocolService, IDefaiProtocolService} from "./services/DefaiProtocolService";

export * from "./services/DefaiProtocolService";


export const defaiProtocolPlugin: Plugin = {
  name: "defaiProtocol",
  description:
    "defaiProtocol Plugin for Eliza - Enables WebSocket communication for AI-driven market insights",
  actions: [],
  evaluators: [],
  providers: [],
  services: [new DefaiProtocolService()],
};

export default defaiProtocolPlugin;
