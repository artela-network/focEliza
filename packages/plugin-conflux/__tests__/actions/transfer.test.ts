import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transfer } from '../../src/actions/transfer';
import { 
    ModelClass, 
    ModelProviderName, 
    type IAgentRuntime, 
    type Memory, 
    type State, 
    type HandlerCallback 
} from '@elizaos/core';
import * as core from '@elizaos/core';
import { createPublicClient, createWalletClient } from 'cive';

// Mock generateObject
vi.mock('@elizaos/core', async () => {
    const actual = await vi.importActual('@elizaos/core');
    return {
        ...actual,
        generateObject: vi.fn().mockResolvedValue({
            object: {
                to: 'cfxtest:test-address',
                amount: 1
            }
        }),
    };
});

// Mock cive functions
vi.mock('cive', () => ({
    createPublicClient: vi.fn(() => ({
        getChainId: vi.fn().mockResolvedValue(1),
        waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
    })),
    createWalletClient: vi.fn(() => ({
        sendTransaction: vi.fn().mockResolvedValue('0x123'),
    })),
    privateKeyToAccount: vi.fn().mockReturnValue({
        address: '0x123',
    }),
    http: vi.fn(),
    parseCFX: vi.fn().mockReturnValue(BigInt(1)),
    testnet: {},
}));

vi.mock('cive/accounts', () => ({
    privateKeyToAccount: vi.fn().mockReturnValue({
        address: '0x123',
        signTransaction: vi.fn(),
    }),
}));

describe('transfer action', () => {
    const mockRuntime: IAgentRuntime = {
        getSetting: vi.fn((key: string) => {
            switch (key) {
                case 'CONFLUX_CORE_PRIVATE_KEY':
                    return '0x1234567890abcdef';
                case 'CONFLUX_CORE_SPACE_RPC_URL':
                    return 'https://test.confluxrpc.com';
                default:
                    return undefined;
            }
        }),
        composeState: vi.fn().mockResolvedValue({}),
        updateRecentMessageState: vi.fn().mockResolvedValue({}),
        generateText: vi.fn(),
        model: {
            [ModelClass.SMALL]: {
                name: 'gpt-4',
                maxInputTokens: 128000,
                maxOutputTokens: 8192,
                frequency_penalty: 0.0,
                presence_penalty: 0.0,
                temperature: 0.6,
                stop: [],
            },
            [ModelClass.MEDIUM]: {
                name: 'gpt-4',
                maxInputTokens: 128000,
                maxOutputTokens: 8192,
                frequency_penalty: 0.0,
                presence_penalty: 0.0,
                temperature: 0.6,
                stop: [],
            },
            [ModelClass.LARGE]: {
                name: 'gpt-4',
                maxInputTokens: 128000,
                maxOutputTokens: 8192,
                frequency_penalty: 0.0,
                presence_penalty: 0.0,
                temperature: 0.6,
                stop: [],
            }
        },
        modelProvider: ModelProviderName.OPENAI,
    };

    const mockMessage: Memory = {
        content: {
            text: 'Send 1 CFX to cfxtest:test-address',
        },
    };

    const mockCallback: HandlerCallback = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should validate successfully', async () => {
        const result = await transfer.validate(mockRuntime, mockMessage);
        expect(result).toBe(true);
    });

    it('should handle successful transfer', async () => {
        const result = await transfer.handler(
            mockRuntime,
            mockMessage,
            undefined,
            undefined,
            mockCallback
        );

        expect(result).toBe(true);
        expect(mockCallback).toHaveBeenCalledWith({
            text: '1 CFX sent to cfxtest:test-address: 0x123',
            content: {
                to: 'cfxtest:test-address',
                amount: 1
            }
        });
    });

    it('should handle transfer with existing state', async () => {
        const mockState = {};
        const result = await transfer.handler(
            mockRuntime,
            mockMessage,
            mockState,
            undefined,
            mockCallback
        );

        expect(result).toBe(true);
        expect(mockRuntime.updateRecentMessageState).toHaveBeenCalledWith(mockState);
    });

    it('should handle invalid content generation', async () => {
        vi.mocked(core.generateObject).mockRejectedValueOnce(new Error('Invalid content'));
        await expect(
            transfer.handler(mockRuntime, mockMessage)
        ).rejects.toThrow('Invalid content');
    });

    it('should handle transfer failure', async () => {
        const mockError = new Error('Transfer failed');
        vi.mocked(createWalletClient).mockImplementationOnce(() => ({
            sendTransaction: vi.fn().mockRejectedValue(mockError),
        }));

        const result = await transfer.handler(
            mockRuntime,
            mockMessage,
            undefined,
            undefined,
            mockCallback
        );

        expect(result).toBe(false);
        expect(mockCallback).toHaveBeenCalledWith({
            text: expect.stringContaining('Failed to send 1 CFX to cfxtest:test-address'),
        });
    });
});
