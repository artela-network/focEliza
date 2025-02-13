import { describe, it, expect, vi, beforeEach } from 'vitest';
import { elizaLogger, ModelClass, generateObject, composeContext } from '@elizaos/core';
import getTrendingAction from '../../src/actions/getTrending';
import axios from 'axios';
import * as environment from '../../src/environment';

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

describe('getTrending action', () => {
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
        await getTrendingAction.validate(mockRuntime, mockMessage);
        expect(environment.validateCoingeckoConfig).toHaveBeenCalledWith(mockRuntime);
    });

    it('should fetch and format trending data', async () => {
        const mockTrendingResponse = {
            data: {
                coins: [
                    {
                        item: {
                            id: 'bitcoin',
                            name: 'Bitcoin',
                            symbol: 'btc',
                            market_cap_rank: 1,
                            thumb: 'thumb_url',
                            large: 'large_url'
                        }
                    }
                ],
                nfts: [
                    {
                        id: 'bored-ape',
                        name: 'Bored Ape Yacht Club',
                        symbol: 'BAYC',
                        thumb: 'thumb_url'
                    }
                ],
                categories: [
                    {
                        id: 'defi',
                        name: 'DeFi'
                    }
                ],
                exchanges: [],
                icos: []
            }
        };

        vi.mocked(axios.get).mockResolvedValueOnce(mockTrendingResponse);

        // Mock the content generation
        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                include_nfts: true,
                include_categories: true
            },
            modelClass: ModelClass.LARGE
        });

        await getTrendingAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(axios.get).toHaveBeenCalledWith(
            'https://api.coingecko.com/api/v3/search/trending',
            expect.any(Object)
        );

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Bitcoin (BTC)'),
            content: expect.objectContaining({
                trending: expect.objectContaining({
                    coins: expect.arrayContaining([
                        expect.objectContaining({
                            name: 'Bitcoin',
                            symbol: 'BTC',
                            marketCapRank: 1
                        })
                    ]),
                    nfts: expect.arrayContaining([
                        expect.objectContaining({
                            name: 'Bored Ape Yacht Club',
                            symbol: 'BAYC'
                        })
                    ]),
                    categories: expect.arrayContaining([
                        expect.objectContaining({
                            name: 'DeFi'
                        })
                    ])
                })
            })
        }));
    });

    it('should handle API errors gracefully', async () => {
        vi.mocked(axios.get).mockRejectedValueOnce(new Error('API Error'));

        // Mock the content generation
        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                include_nfts: true,
                include_categories: true
            },
            modelClass: ModelClass.LARGE
        });

        await getTrendingAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Error fetching trending data'),
            content: expect.objectContaining({
                error: expect.stringContaining('API Error')
            })
        }));
    });

    it('should handle rate limit errors', async () => {
        const rateLimitError = new Error('Rate limit exceeded');
        Object.assign(rateLimitError, {
            response: { status: 429 }
        });
        vi.mocked(axios.get).mockRejectedValueOnce(rateLimitError);

        // Mock the content generation
        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                include_nfts: true,
                include_categories: true
            },
            modelClass: ModelClass.LARGE
        });

        await getTrendingAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Rate limit exceeded'),
            content: expect.objectContaining({
                error: expect.stringContaining('Rate limit exceeded'),
                statusCode: 429
            })
        }));
    });

    it('should handle empty response data', async () => {
        vi.mocked(axios.get).mockResolvedValueOnce({ data: null });

        // Mock the content generation
        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                include_nfts: true,
                include_categories: true
            },
            modelClass: ModelClass.LARGE
        });

        await getTrendingAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Error fetching trending data'),
            content: expect.objectContaining({
                error: expect.stringContaining('No data received')
            })
        }));
    });
});
