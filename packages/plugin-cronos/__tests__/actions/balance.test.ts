import { describe, it, expect, vi, beforeEach } from 'vitest';
import { balanceAction } from '../../src/actions/balance';
import { 
    type IAgentRuntime,
    type Memory,
    ModelClass,
    ModelProviderName,
    type State,
    type HandlerCallback,
} from '@elizaos/core';
import * as core from '@elizaos/core';

// Mock generateObject
vi.mock('@elizaos/core', async () => {
    const actual = await vi.importActual('@elizaos/core');
    return {
        ...actual,
        generateObject: vi.fn().mockResolvedValue({
            object: {
                chain: 'cronos',
                address: '0x1234567890123456789012345678901234567890'
            }
        }),
    };
});

// Mock wallet provider
vi.mock('../../src/providers/wallet', () => ({
    initCronosWalletProvider: vi.fn().mockReturnValue({
        switchChain: vi.fn(),
        getWalletClient: vi.fn(),
        getAddressBalance: vi.fn().mockResolvedValue('1.0'),
    }),
}));

describe('balance action', () => {
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
            text: 'Check balance for 0x1234567890123456789012345678901234567890 on Cronos',
        },
    };

    const mockCallback: HandlerCallback = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should validate successfully', async () => {
        const result = await balanceAction.validate(mockRuntime);
        expect(result).toBe(true);
    });

    it('should handle successful balance check', async () => {
        const result = await balanceAction.handler(
            mockRuntime,
            mockMessage,
            undefined,
            undefined,
            mockCallback
        );

        expect(result).toBe(true);
        expect(mockCallback).toHaveBeenCalledWith({
            text: 'Balance for 0x1234567890123456789012345678901234567890 on cronos is 1.0 CRO',
            content: {
                success: true,
                balance: '1.0',
                chain: 'cronos',
                address: '0x1234567890123456789012345678901234567890'
            }
        });
    });

    it('should handle balance check with existing state', async () => {
        const mockState = {};
        const result = await balanceAction.handler(
            mockRuntime,
            mockMessage,
            mockState,
            undefined,
            mockCallback
        );

        expect(result).toBe(true);
        expect(mockRuntime.updateRecentMessageState).toHaveBeenCalledWith(mockState);
    });

    it('should handle balance check failure', async () => {
        const mockError = new Error('Failed to fetch balance');
        const mockProvider = {
            switchChain: vi.fn(),
            getWalletClient: vi.fn(),
            getAddressBalance: vi.fn().mockRejectedValue(mockError),
        };
        
        // Reset the mock first
        const walletModule = await import('../../src/providers/wallet');
        vi.mocked(walletModule.initCronosWalletProvider).mockResolvedValueOnce(mockProvider);

        const result = await balanceAction.handler(
            mockRuntime,
            mockMessage,
            undefined,
            undefined,
            mockCallback
        );

        expect(result).toBe(false);
        expect(mockCallback).toHaveBeenCalledWith({
            text: 'Error checking balance: Failed to fetch balance',
            content: { error: 'Failed to fetch balance' }
        });
    });
});
