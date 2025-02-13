import { vi } from 'vitest';
import { elizaLogger } from '@elizaos/core';

// Mock elizaLogger
vi.mock('@elizaos/core', () => ({
    elizaLogger: {
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        generateObject: vi.fn(),
    }
}));

// Mock fetch
global.fetch = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
});
