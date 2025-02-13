import { describe, it, expect, vi, beforeEach } from 'vitest';
import { elizaLogger, ModelClass, generateObjectDeprecated, composeContext } from '@elizaos/core';
import getPriceAction from '../../src/actions/getPrice';
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
    generateObjectDeprecated: vi.fn(),
    composeContext: vi.fn(),
    ModelClass: { SMALL: 'SMALL' }
}));
vi.mock('../../src/environment', () => ({
    validateCoinMarketCapConfig: vi.fn()
}));

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
        COINMARKETCAP_API_KEY: 'test-api-key'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Mock environment validation
        vi.mocked(environment.validateCoinMarketCapConfig).mockResolvedValue(mockConfig);

        // Mock runtime functions
        mockRuntime.composeState.mockResolvedValue(mockState);
        mockRuntime.updateRecentMessageState.mockResolvedValue(mockState);
        mockRuntime.getPluginConfig.mockResolvedValue({
            apiKey: 'test-api-key'
        });

        // Mock axios create
        vi.mocked(axios.create).mockReturnValue(axios);

        // Mock the core functions
        vi.mocked(elizaLogger.log).mockImplementation(() => {});
        vi.mocked(elizaLogger.error).mockImplementation(() => {});
        vi.mocked(elizaLogger.success).mockImplementation(() => {});
        vi.mocked(composeContext).mockReturnValue({});
    });

    it('should validate coinmarketcap config', async () => {
        await getPriceAction.validate(mockRuntime, mockMessage);
        expect(environment.validateCoinMarketCapConfig).toHaveBeenCalledWith(mockRuntime);
    });

    it('should fetch and format price data', async () => {
        const mockResponse = {
            data: {
                data: {
                    BTC: {
                        quote: {
                            USD: {
                                price: 50000,
                                market_cap: 1000000000000,
                                volume_24h: 30000000000,
                                percent_change_24h: 2.5
                            }
                        }
                    }
                }
            }
        };

        vi.mocked(axios.get).mockResolvedValueOnce(mockResponse);

        // Mock the content generation
        vi.mocked(generateObjectDeprecated).mockResolvedValueOnce({
            symbol: 'BTC',
            currency: 'USD'
        });

        await getPriceAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(axios.get).toHaveBeenCalledWith(
            '/cryptocurrency/quotes/latest',
            expect.objectContaining({
                params: {
                    symbol: 'BTC',
                    convert: 'USD'
                }
            })
        );

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('50000 USD'),
            content: expect.objectContaining({
                symbol: 'BTC',
                currency: 'USD',
                price: 50000,
                marketCap: 1000000000000,
                volume24h: 30000000000,
                percentChange24h: 2.5
            })
        }));
    });

    it('should handle invalid symbol', async () => {
        const mockResponse = {
            data: {
                data: {}
            }
        };

        vi.mocked(axios.get).mockResolvedValueOnce(mockResponse);

        // Mock the content generation
        vi.mocked(generateObjectDeprecated).mockResolvedValueOnce({
            symbol: 'INVALID',
            currency: 'USD'
        });

        await getPriceAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('No data found for symbol'),
            content: expect.objectContaining({
                error: expect.stringContaining('No data found for symbol')
            })
        }));
    });

    it('should handle invalid currency', async () => {
        const mockResponse = {
            data: {
                data: {
                    BTC: {
                        quote: {}
                    }
                }
            }
        };

        vi.mocked(axios.get).mockResolvedValueOnce(mockResponse);

        // Mock the content generation
        vi.mocked(generateObjectDeprecated).mockResolvedValueOnce({
            symbol: 'BTC',
            currency: 'INVALID'
        });

        await getPriceAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('No quote data found for currency'),
            content: expect.objectContaining({
                error: expect.stringContaining('No quote data found for currency')
            })
        }));
    });

    it('should handle API errors gracefully', async () => {
        vi.mocked(axios.get).mockRejectedValueOnce(new Error('API Error'));

        // Mock the content generation
        vi.mocked(generateObjectDeprecated).mockResolvedValueOnce({
            symbol: 'BTC',
            currency: 'USD'
        });

        await getPriceAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('API Error'),
            content: expect.objectContaining({
                error: expect.stringContaining('API Error')
            })
        }));
    });

    it('should handle rate limit errors', async () => {
        const errorMessage = 'Rate limit exceeded';
        const rateLimitError = new Error(`API Error: ${errorMessage}`);
        Object.assign(rateLimitError, {
            isAxiosError: true,
            response: {
                data: {
                    status: {
                        error_message: errorMessage
                    }
                }
            }
        });
        vi.mocked(axios.get).mockRejectedValueOnce(rateLimitError);

        // Mock the content generation
        vi.mocked(generateObjectDeprecated).mockResolvedValueOnce({
            symbol: 'BTC',
            currency: 'USD'
        });

        await getPriceAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith({
            text: `Error fetching price: API Error: ${errorMessage}`,
            content: { error: `API Error: ${errorMessage}` }
        });
    });

    it('should handle invalid content generation', async () => {
        // Mock invalid content generation
        vi.mocked(generateObjectDeprecated).mockResolvedValueOnce({
            invalidField: 'invalid'
        });

        await getPriceAction.handler(mockRuntime, mockMessage, mockState, {}, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.stringContaining('Invalid price check content'),
            content: expect.objectContaining({
                error: expect.stringContaining('Invalid price check content')
            })
        }));
    });
});
