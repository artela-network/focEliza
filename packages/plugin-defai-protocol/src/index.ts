import { Plugin } from "@elizaos/core";
import {DefaiProtocolService, IDefaiProtocolService} from "./services/DefaiProtocolService";

export * from "./services/DefaiProtocolService";


export const defaiProtocolPlugin: Plugin = {
  name: "defaiProtocol",
  description:
    "defaiProtocol Plugin for Eliza - An open-source framework by Ailoc that enables seamless integration between AI agents and DeFi protocols, providing a robust infrastructure for blockchain-agnostic agent solutions that can interact with any DeFi protocol.",
  actions: [],
  evaluators: [],
  providers: [],
  services: [new DefaiProtocolService()],
};

export default defaiProtocolPlugin;
