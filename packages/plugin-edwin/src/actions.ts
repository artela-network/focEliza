import {
    type Action,
    generateText,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
    composeContext,
    generateObjectDeprecated,
} from "@elizaos/core";

import { Edwin, EdwinAction } from "edwin-sdk";

type GetEdwinActionsParams = {
    getClient: () => Promise<Edwin>;
};

/**
 * Get all edwin actions
 */
export async function getEdwinActions({
    getClient,
}: GetEdwinActionsParams): Promise<Action[]> {
    const edwin = await getClient();
    const edwinActions = await edwin.getActions();
    const actions = edwinActions.map((action: EdwinAction) => ({
        name: action.name.toUpperCase(),
        description: action.description,
        similes: [],
        validate: async () => true,
        handler: async (
            runtime: IAgentRuntime,
            message: Memory,
            state: State | undefined,
            options?: Record<string, unknown>,
            callback?: HandlerCallback
        ): Promise<boolean> => {
            try {
                const client = await getClient();
                if (!state) {
                    state = (await runtime.composeState(message)) as State;
                } else {
                    state = await runtime.updateRecentMessageState(state);
                }
                const parameterContext = composeContext({
                    state,
                    template: action.template,
                });
                const parameters = await generateObjectDeprecated({
                    runtime,
                    context: parameterContext,
                    modelClass: ModelClass.LARGE,
                });
                const result = await executeAction(action, parameters, client);
                const responseContext = composeResponseContext(
                    action,
                    result,
                    state
                );
                const response = await generateResponse(
                    runtime,
                    responseContext
                );
                callback?.({ text: response, content: result });
                return true;
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                callback?.({
                    text: `Error executing action ${action.name}: ${errorMessage}`,
                    content: { error: errorMessage },
                });
                return false;
            }
        },
        examples: [],
    }));
    return actions;
}

async function executeAction(
    action: EdwinAction,
    parameters: any,
    edwin: Edwin
): Promise<unknown> {
    const result = await action.execute(parameters);
    return result;
}

function composeResponseContext(
    action: EdwinAction,
    result: unknown,
    state: State
): string {
    const responseTemplate = `
# Action Examples
{{actionExamples}}

# Knowledge
{{knowledge}}

# Task: Generate dialog and actions for the character {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{providers}}

{{attachments}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

The action "${action.name}" was executed successfully.
Here is the result:
${JSON.stringify(result)}

{{actions}}

Respond to the message knowing that the action was successful and these were the previous messages:
{{recentMessages}}
`;
    const context = composeContext({ state, template: responseTemplate });
    return context;
}

async function generateResponse(
    runtime: IAgentRuntime,
    context: string
): Promise<string> {
    const response = await generateText({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
    });
    return response;
}
