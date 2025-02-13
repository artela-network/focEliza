import { describe, it, expect, vi, beforeEach } from 'vitest';
import { elizaLogger, ModelClass, generateObject, composeContext } from '@elizaos/core';
import getTopGainersLosersAction from '../../src/actions/getTopGainersLosers';
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

describe('getTopGainersLosers action', () => {
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
        await getTopGainersLosersAction.validate(mockRuntime, mockMessage);
        expect(environment.validateCoingeckoConfig).toHaveBeenCalledWith(mockRuntime);
    });

    it('should fetch and format top gainers and losers data', async () => {
        const mockResponse = {
            data: {
                top_gainers: [
                    {
                        id: 'bitcoin',
                        symbol: 'btc',
                        name: 'Bitcoin',
                        image: 'image_url',
                        market_cap_rank: 1,
                        usd: 50000,
                        usd_24h_vol: 30000000000,
                        usd_24h_change: 5.5
                    }
                ],
                top_losers: [
                    {
                        id: 'ethereum',
                        symbol: 'eth',
                        name: 'Ethereum',
                        image: 'image_url',
                        market_cap_rank: 2,
                        usd: 2500,
                        usd_24h_vol: 20000000000,
                        usd_24h_change: -3.2
                    }
                ]
            }
        };

        vi.mocked(axios.get).mockResolvedValueOnce(mockResponse);

        // Mock the content generation
        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                vs_currency: 'usd',
                duration: '24h',
                top_coins: '1000'
            },
            modelClass: ModelClass.LARGE
        });

        await getTopGainersLosersAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(axios.get).toHaveBeenCalledWith(
            'https://api.coingecko.com/api/v3/coins/top_gainers_losers',
            expect.objectContaining({
                params: {
                    vs_currency: 'usd',
                    duration: '24h',
                    top_coins: '1000'
                }
            })
        );

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Bitcoin (BTC)'),
            content: expect.objectContaining({
                data: expect.objectContaining({
                    top_gainers: expect.arrayContaining([
                        expect.objectContaining({
                            name: 'Bitcoin',
                            symbol: 'btc',
                            usd_24h_change: 5.5
                        })
                    ]),
                    top_losers: expect.arrayContaining([
                        expect.objectContaining({
                            name: 'Ethereum',
                            symbol: 'eth',
                            usd_24h_change: -3.2
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
                vs_currency: 'usd',
                duration: '24h',
                top_coins: '1000'
            },
            modelClass: ModelClass.LARGE
        });

        await getTopGainersLosersAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Error fetching top gainers/losers data'),
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
                vs_currency: 'usd',
                duration: '24h',
                top_coins: '1000'
            },
            modelClass: ModelClass.LARGE
        });

        await getTopGainersLosersAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Rate limit exceeded'),
            content: expect.objectContaining({
                error: expect.stringContaining('Rate limit exceeded'),
                statusCode: 429
            })
        }));
    });

    it('should handle pro plan requirement errors', async () => {
        const proPlanError = new Error('Pro plan required');
        Object.assign(proPlanError, {
            response: { status: 403 }
        });
        vi.mocked(axios.get).mockRejectedValueOnce(proPlanError);

        // Mock the content generation
        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                vs_currency: 'usd',
                duration: '24h',
                top_coins: '1000'
            },
            modelClass: ModelClass.LARGE
        });

        await getTopGainersLosersAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('requires a CoinGecko Pro API key'),
            content: expect.objectContaining({
                error: expect.stringContaining('Pro plan required'),
                statusCode: 403,
                requiresProPlan: true
            })
        }));
    });

    it('should handle empty response data', async () => {
        vi.mocked(axios.get).mockResolvedValueOnce({ data: null });

        // Mock the content generation
        vi.mocked(generateObject).mockResolvedValueOnce({
            object: {
                vs_currency: 'usd',
                duration: '24h',
                top_coins: '1000'
            },
            modelClass: ModelClass.LARGE
        });

        await getTopGainersLosersAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('No data received'),
            content: expect.objectContaining({
                error: expect.stringContaining('No data received')
            })
        }));
    });
});
