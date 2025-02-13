import { describe, it, expect, vi, beforeEach } from 'vitest';
import { elizaLogger, ModelClass, generateObject, composeContext } from '@elizaos/core';
import getPriceAction from '../../src/actions/getPrice';
import axios from 'axios';
import * as environment from '../../src/environment';
import * as coinsProvider from '../../src/providers/coinsProvider';

vi.mock('axios');
vi.mock('@elizaos/core', () => ({
    elizaLogger: {
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
    },
    generateObject: vi.fn(),
    composeContext: vi.fn(),
    ModelClass: { LARGE: 'LARGE' }
}));
vi.mock('../../src/environment', () => ({
    validateCoingeckoConfig: vi.fn(),
    getApiConfig: vi.fn()
}));
vi.mock('../../src/providers/coinsProvider');

describe('getPrice action', () => {
    const mockRuntime = {
        composeState: vi.fn(),
        updateRecentMessageState: vi.fn(),
        getPluginConfig: vi.fn(),
    };

    const mockMessage = {};
    const mockState = {};
    const mockCallback = vi.fn();
    const mockConfig = {
        COINGECKO_API_KEY: 'test-api-key',
        COINGECKO_PRO_API_KEY: null
    };

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Mock environment validation
        vi.mocked(environment.validateCoingeckoConfig).mockResolvedValue(mockConfig);
        vi.mocked(environment.getApiConfig).mockReturnValue({
            baseUrl: 'https://api.coingecko.com/api/v3',
            apiKey: 'test-api-key',
            headerKey: 'x-cg-demo-api-key'
        });

        // Mock runtime functions
        mockRuntime.composeState.mockResolvedValue(mockState);
        mockRuntime.updateRecentMessageState.mockResolvedValue(mockState);
        mockRuntime.getPluginConfig.mockResolvedValue({
            apiKey: 'test-api-key',
            baseUrl: 'https://api.coingecko.com/api/v3'
        });

        // Mock the core functions
        vi.mocked(elizaLogger.log).mockImplementation(() => {});
        vi.mocked(elizaLogger.error).mockImplementation(() => {});
        vi.mocked(elizaLogger.success).mockImplementation(() => {});
        vi.mocked(composeContext).mockReturnValue({});
    });

    it('should validate coingecko config', async () => {
        await getPriceAction.validate(mockRuntime, mockMessage);
        expect(environment.validateCoingeckoConfig).toHaveBeenCalledWith(mockRuntime);
    });

    it('should fetch and format price data for a single coin', async () => {
        const mockPriceResponse = {
            data: {
                bitcoin: {
                    usd: 50000,
                    eur: 42000
                }
            }
        };

        const mockCoinsData = [{
            id: 'bitcoin',
            name: 'Bitcoin',
            symbol: 'btc'
        }];

        vi.mocked(axios.get).mockResolvedValueOnce(mockPriceResponse);
        vi.mocked(coinsProvider.getCoinsData).mockResolvedValueOnce(mockCoinsData);

        // Mock the content generation
        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                coinIds: 'bitcoin',
                currency: ['usd', 'eur'],
                include_market_cap: false,
                include_24hr_vol: false,
                include_24hr_change: false,
                include_last_updated_at: false
            },
            modelClass: ModelClass.LARGE
        });

        await getPriceAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(axios.get).toHaveBeenCalledWith(
            'https://api.coingecko.com/api/v3/simple/price',
            expect.any(Object)
        );

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Bitcoin (BTC)')
        }));
    });

    it('should handle API errors gracefully', async () => {
        vi.mocked(axios.get).mockRejectedValueOnce(new Error('API Error'));

        // Mock the content generation
        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                coinIds: 'invalid-coin',
                currency: ['usd'],
                include_market_cap: false,
                include_24hr_vol: false,
                include_24hr_change: false,
                include_last_updated_at: false
            },
            modelClass: ModelClass.LARGE
        });

        await getPriceAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.objectContaining({
                error: expect.stringContaining('API Error')
            })
        }));
    });

    it('should handle empty response data', async () => {
        vi.mocked(axios.get).mockResolvedValueOnce({ data: {} });

        // Mock the content generation
        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                coinIds: 'non-existent-coin',
                currency: ['usd'],
                include_market_cap: false,
                include_24hr_vol: false,
                include_24hr_change: false,
                include_last_updated_at: false
            },
            modelClass: ModelClass.LARGE
        });

        await getPriceAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.objectContaining({
                error: expect.stringContaining('No price data available')
            })
        }));
    });

    it('should include additional market data when requested', async () => {
        const mockPriceResponse = {
            data: {
                ethereum: {
                    usd: 3000,
                    usd_market_cap: 350000000000,
                    usd_24h_vol: 20000000000,
                    usd_24h_change: 5.5,
                    last_updated_at: 1643673600
                }
            }
        };

        const mockCoinsData = [{
            id: 'ethereum',
            name: 'Ethereum',
            symbol: 'eth'
        }];

        vi.mocked(axios.get).mockResolvedValueOnce(mockPriceResponse);
        vi.mocked(coinsProvider.getCoinsData).mockResolvedValueOnce(mockCoinsData);

        // Mock the content generation
        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                coinIds: 'ethereum',
                currency: ['usd'],
                include_market_cap: true,
                include_24hr_vol: true,
                include_24hr_change: true,
                include_last_updated_at: true
            },
            modelClass: ModelClass.LARGE
        });

        await getPriceAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Market Cap')
        }));
    });
});
