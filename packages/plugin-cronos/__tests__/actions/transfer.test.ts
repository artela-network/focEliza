import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transferAction } from '../../src/actions/transfer';
import { 
    type IAgentRuntime,
    type Memory,
    ModelClass,
    ModelProviderName,
    type State,
    type HandlerCallback,
} from '@elizaos/core';
import * as core from '@elizaos/core';
import { parseEther } from 'viem';

// Mock generateObject
vi.mock('@elizaos/core', async () => {
    const actual = await vi.importActual('@elizaos/core');
    return {
        ...actual,
        generateObject: vi.fn().mockResolvedValue({
            object: {
                chain: 'cronos',
                toAddress: '0x1234567890123456789012345678901234567890',
                amount: '1.0'
            }
        }),
    };
});

// Mock wallet provider
vi.mock('../../src/providers/wallet', () => ({
    initCronosWalletProvider: vi.fn().mockReturnValue({
        switchChain: vi.fn(),
        getWalletClient: vi.fn().mockReturnValue({
            account: {
                address: '0x1234567890123456789012345678901234567890',
            },
            sendTransaction: vi.fn().mockResolvedValue('0x123'),
        }),
    }),
}));

describe('transfer action', () => {
    const mockRuntime: IAgentRuntime = {
        getSetting: vi.fn().mockReturnValue('0x1234567890123456789012345678901234567890123456789012345678901234'),
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
            text: 'Send 1.0 CRO to 0x1234567890123456789012345678901234567890 on Cronos',
        },
    };

    const mockCallback: HandlerCallback = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should validate successfully', async () => {
        const result = await transferAction.validate(mockRuntime);
        expect(result).toBe(true);
    });

    it('should handle successful transfer', async () => {
        const result = await transferAction.handler(
            mockRuntime,
            mockMessage,
            undefined,
            undefined,
            mockCallback
        );

        expect(result).toBe(true);
        expect(mockCallback).toHaveBeenCalledWith({
            text: 'Successfully transferred 1.0 CRO to 0x1234567890123456789012345678901234567890\nTransaction Hash: 0x123',
            content: {
                success: true,
                hash: '0x123',
                amount: '1',  
                recipient: '0x1234567890123456789012345678901234567890',
                chain: undefined  
            }
        });
    });

    it('should handle transfer with existing state', async () => {
        const mockState = {};
        const result = await transferAction.handler(
            mockRuntime,
            mockMessage,
            mockState,
            undefined,
            mockCallback
        );

        expect(result).toBe(true);
        expect(mockRuntime.updateRecentMessageState).toHaveBeenCalledWith(mockState);
    });


    it('should handle transfer failure', async () => {
        const mockError = new Error('Transfer failed');
        const mockProvider = {
            switchChain: vi.fn(),
            getWalletClient: vi.fn().mockReturnValue({
                account: {
                    address: '0x1234567890123456789012345678901234567890',
                },
                sendTransaction: vi.fn().mockRejectedValue(mockError),
            }),
        };
        
        // Reset the mock first
        const walletModule = await import('../../src/providers/wallet');
        vi.mocked(walletModule.initCronosWalletProvider).mockResolvedValueOnce(mockProvider);

        const result = await transferAction.handler(
            mockRuntime,
            mockMessage,
            undefined,
            undefined,
            mockCallback
        );

        expect(result).toBe(false);
        expect(mockCallback).toHaveBeenCalledWith({
            text: 'Error transferring tokens: Transfer failed: Transfer failed',
            content: { error: 'Transfer failed: Transfer failed' }
        });
    });
});
