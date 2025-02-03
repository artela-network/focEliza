import { IAgentRuntime, ModelClass, Service, ServiceType, elizaLogger, generateObjectDeprecated, generateText } from "@elizaos/core";

export interface IDefaiProtocolService extends Service {
    generate(text: string): Promise<any>;
}

export class DefaiProtocolService extends Service implements IDefaiProtocolService {
    private runtime: IAgentRuntime;
    getInstance(): DefaiProtocolService {
        return this;
    }
    static get serviceType() {
        return ServiceType.DEFAI_PROTOCOL;
    }

    initialize(runtime: IAgentRuntime): Promise<void> {
        this.runtime = runtime;
        return;
    }

    async post (data: string) {
        const body = JSON.stringify({
            text: data,
        })
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
    async generate(text: string): Promise<any> {
        try {
            elizaLogger.log("input text", text);
            const response = await this.post(text)
            elizaLogger.log("response text", response);
            return response
        } catch (e) {
            elizaLogger.error(e);
            return "error";
        }
    }
}

export default DefaiProtocolService;
