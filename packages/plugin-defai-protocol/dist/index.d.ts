import { Service, ServiceType, IAgentRuntime, Plugin } from '@elizaos/core';

interface IDefaiProtocolService extends Service {
    generate(text: string): Promise<any>;
}
declare class DefaiProtocolService extends Service implements IDefaiProtocolService {
    private runtime;
    getInstance(): DefaiProtocolService;
    static get serviceType(): ServiceType;
    initialize(runtime: IAgentRuntime): Promise<void>;
    post(data: string): Promise<any>;
    /**
     * Connect to WebSocket and send a message
     */
    generate(text: string): Promise<any>;
}

declare const defaiProtocolPlugin: Plugin;

export { DefaiProtocolService, type IDefaiProtocolService, defaiProtocolPlugin, defaiProtocolPlugin as default };
