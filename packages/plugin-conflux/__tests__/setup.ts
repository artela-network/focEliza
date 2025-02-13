import { vi } from 'vitest';
// Mock console methods to avoid cluttering test output
global.console = {
    ...console,
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
};
