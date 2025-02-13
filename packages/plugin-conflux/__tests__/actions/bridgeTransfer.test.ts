import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bridgeTransfer } from '../../src/actions/bridgeTransfer';
import {
    type IAgentRuntime,
    type Memory,
    ModelClass,
    ModelProviderName,
    type State,
    type HandlerCallback,
} from '@elizaos/core';
import * as core from '@elizaos/core';
import { createPublicClient, createWalletClient, encodeFunctionData } from 'cive';
import { hexAddressToBase32 } from 'cive/utils';

// Mock generateObject
vi.mock('@elizaos/core', async () => {
    const actual = await vi.importActual('@elizaos/core');
    return {
        ...actual,
        generateObject: vi.fn().mockResolvedValue({
            object: {
                to: '0x119DA8bbe74B1C5c987D0c64D10eC1dB301d4752',
                amount: 1
            }
        }),
    };
});

// Mock cive functions
vi.mock('cive', () => ({
    createPublicClient: vi.fn(() => ({
        getChainId: vi.fn().mockResolvedValue(1),
    })),
    createWalletClient: vi.fn(() => ({
        sendTransaction: vi.fn().mockResolvedValue('0x123'),
    })),
    http: vi.fn(),
    parseCFX: vi.fn().mockReturnValue(BigInt(1000000000000000000)), // 1 CFX
    encodeFunctionData: vi.fn().mockReturnValue('0x123456'),
}));

vi.mock('cive/accounts', () => ({
    privateKeyToAccount: vi.fn().mockReturnValue({
        address: '0x123',
        signTransaction: vi.fn(),
    }),
}));

vi.mock('cive/utils', () => ({
    hexAddressToBase32: vi.fn().mockReturnValue('cfxtest:test-address'),
}));

describe('bridgeTransfer action', () => {
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
            text: 'Send 1 CFX to eSpace Address 0x119DA8bbe74B1C5c987D0c64D10eC1dB301d4752',
        },
    };

    const mockCallback: HandlerCallback = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should validate successfully', async () => {
        const result = await bridgeTransfer.validate(mockRuntime, mockMessage);
        expect(result).toBe(true);
    });

    it('should handle successful bridge transfer', async () => {
        const result = await bridgeTransfer.handler(
            mockRuntime,
            mockMessage,
            undefined,
            undefined,
            mockCallback
        );

        expect(result).toBe(true);
        expect(mockCallback).toHaveBeenCalledWith({
            text: expect.stringContaining('1 CFX sent to 0x119DA8bbe74B1C5c987D0c64D10eC1dB301d4752'),
            content: {
                to: '0x119DA8bbe74B1C5c987D0c64D10eC1dB301d4752',
                amount: 1
            }
        });
    });

    it('should handle bridge transfer with existing state', async () => {
        const mockState = {};
        const result = await bridgeTransfer.handler(
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
            bridgeTransfer.handler(mockRuntime, mockMessage)
        ).rejects.toThrow('Invalid content');
    });

    it('should handle bridge transfer failure', async () => {
        const mockError = new Error('Bridge transfer failed');
        vi.mocked(createWalletClient).mockImplementationOnce(() => ({
            sendTransaction: vi.fn().mockRejectedValue(mockError),
        }));

        const result = await bridgeTransfer.handler(
            mockRuntime,
            mockMessage,
            undefined,
            undefined,
            mockCallback
        );

        expect(result).toBe(false);
        expect(mockCallback).toHaveBeenCalledWith({
            text: expect.stringContaining('Failed to send 1 CFX to 0x119DA8bbe74B1C5c987D0c64D10eC1dB301d4752'),
        });
    });

    it('should use correct cross-space call contract address', async () => {
        await bridgeTransfer.handler(
            mockRuntime,
            mockMessage,
            undefined,
            undefined,
            mockCallback
        );

        expect(hexAddressToBase32).toHaveBeenCalledWith({
            hexAddress: '0x0888000000000000000000000000000000000006',
            networkId: 1,
        });
    });
});
