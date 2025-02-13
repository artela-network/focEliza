import { describe, it, expect, vi, beforeEach } from 'vitest';
import { elizaLogger, ModelClass, generateObject, composeContext } from '@elizaos/core';
import getMarketsAction, { formatCategory } from '../../src/actions/getMarkets';
import axios from 'axios';
import * as environment from '../../src/environment';
import * as categoriesProvider from '../../src/providers/categoriesProvider';

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
    ModelClass: { LARGE: 'LARGE', SMALL: 'SMALL' }
}));
vi.mock('../../src/environment', () => ({
    validateCoingeckoConfig: vi.fn(),
    getApiConfig: vi.fn()
}));
vi.mock('../../src/providers/categoriesProvider');

describe('getMarkets action', () => {
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

    const mockCategories = [
        { category_id: 'defi', name: 'DeFi' },
        { category_id: 'nft', name: 'NFT' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Mock environment validation
        vi.mocked(environment.validateCoingeckoConfig).mockResolvedValue(mockConfig);
        vi.mocked(environment.getApiConfig).mockReturnValue({
            baseUrl: 'https://api.coingecko.com/api/v3',
            apiKey: 'test-api-key',
            headerKey: 'x-cg-demo-api-key'
        });

        // Mock categories provider
        vi.mocked(categoriesProvider.getCategoriesData).mockResolvedValue(mockCategories);

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

    describe('formatCategory', () => {
        it('should return undefined for undefined input', () => {
            expect(formatCategory(undefined, mockCategories)).toBeUndefined();
        });

        it('should find exact match by category_id', () => {
            expect(formatCategory('defi', mockCategories)).toBe('defi');
        });

        it('should find match by name', () => {
            expect(formatCategory('DeFi', mockCategories)).toBe('defi');
        });

        it('should find partial match', () => {
            expect(formatCategory('nf', mockCategories)).toBe('nft');
        });

        it('should return undefined for no match', () => {
            expect(formatCategory('invalid-category', mockCategories)).toBeUndefined();
        });
    });

    it('should validate coingecko config', async () => {
        await getMarketsAction.validate(mockRuntime, mockMessage);
        expect(environment.validateCoingeckoConfig).toHaveBeenCalledWith(mockRuntime);
    });

    it('should fetch and format market data', async () => {
        const mockResponse = {
            data: [
                {
                    id: 'bitcoin',
                    symbol: 'btc',
                    name: 'Bitcoin',
                    image: 'image_url',
                    current_price: 50000,
                    market_cap: 1000000000000,
                    market_cap_rank: 1,
                    fully_diluted_valuation: 1100000000000,
                    total_volume: 30000000000,
                    high_24h: 51000,
                    low_24h: 49000,
                    price_change_24h: 1000,
                    price_change_percentage_24h: 2,
                    market_cap_change_24h: 20000000000,
                    market_cap_change_percentage_24h: 2,
                    circulating_supply: 19000000,
                    total_supply: 21000000,
                    max_supply: 21000000,
                    ath: 69000,
                    ath_change_percentage: -27.5,
                    ath_date: '2021-11-10T14:24:11.849Z',
                    atl: 67.81,
                    atl_change_percentage: 73623.12,
                    atl_date: '2013-07-06T00:00:00.000Z',
                    last_updated: '2024-01-31T23:00:00.000Z'
                }
            ]
        };

        vi.mocked(axios.get).mockResolvedValueOnce(mockResponse);

        // Mock the content generation
        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                vs_currency: 'usd',
                category: 'defi',
                order: 'market_cap_desc',
                per_page: 20,
                page: 1,
                sparkline: false
            },
            modelClass: ModelClass.SMALL
        });

        await getMarketsAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(axios.get).toHaveBeenCalledWith(
            'https://api.coingecko.com/api/v3/coins/markets',
            expect.objectContaining({
                params: {
                    vs_currency: 'usd',
                    category: 'defi',
                    order: 'market_cap_desc',
                    per_page: 20,
                    page: 1,
                    sparkline: false
                }
            })
        );

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Bitcoin (BTC)'),
            content: expect.objectContaining({
                markets: expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Bitcoin',
                        symbol: 'BTC',
                        marketCapRank: 1,
                        currentPrice: 50000
                    })
                ])
            })
        }));
    });

    it('should handle invalid category', async () => {
        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                vs_currency: 'usd',
                category: 'invalid-category',
                order: 'market_cap_desc',
                per_page: 20,
                page: 1,
                sparkline: false
            },
            modelClass: ModelClass.SMALL
        });

        await getMarketsAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Invalid category'),
            error: expect.objectContaining({
                message: expect.stringContaining('Invalid category')
            })
        }));
    });

    it('should handle API errors gracefully', async () => {
        vi.mocked(axios.get).mockRejectedValueOnce(new Error('API Error'));

        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: 20,
                page: 1,
                sparkline: false
            },
            modelClass: ModelClass.SMALL
        });

        await getMarketsAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Error fetching market data'),
            error: expect.objectContaining({
                message: expect.stringContaining('API Error')
            })
        }));
    });

    it('should handle rate limit errors', async () => {
        const rateLimitError = new Error('Rate limit exceeded');
        Object.assign(rateLimitError, {
            response: { status: 429 }
        });
        vi.mocked(axios.get).mockRejectedValueOnce(rateLimitError);

        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: 20,
                page: 1,
                sparkline: false
            },
            modelClass: ModelClass.SMALL
        });

        await getMarketsAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Rate limit exceeded'),
            error: expect.objectContaining({
                message: expect.stringContaining('Rate limit exceeded'),
                statusCode: 429
            })
        }));
    });

    it('should handle empty response data', async () => {
        vi.mocked(axios.get).mockResolvedValueOnce({ data: [] });

        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: 20,
                page: 1,
                sparkline: false
            },
            modelClass: ModelClass.SMALL
        });

        await getMarketsAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('No market data received'),
            error: expect.objectContaining({
                message: expect.stringContaining('No market data received')
            })
        }));
    });
});
