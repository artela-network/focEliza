import { vi } from 'vitest';

// Mock viem functions
vi.mock('viem', () => ({
    isAddress: vi.fn().mockReturnValue(true),
    formatEther: vi.fn().mockReturnValue('1.0'),
    parseEther: vi.fn().mockReturnValue(BigInt(1000000000000000000)), // 1 ETH
}));

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
        getAddressBalance: vi.fn().mockResolvedValue('1.0'),
    }),
}));
