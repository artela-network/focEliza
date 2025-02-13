import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { createPriceService } from '../../src/actions/getPrice/service';

vi.mock('axios');

describe('PriceService', () => {
    const API_KEY = 'test-api-key';
    let priceService: ReturnType<typeof createPriceService>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(axios.create).mockReturnValue(axios);
        priceService = createPriceService(API_KEY);
    });

    it('should create axios instance with correct config', () => {
        expect(axios.create).toHaveBeenCalledWith({
            baseURL: 'https://pro-api.coinmarketcap.com/v1',
            headers: {
                'X-CMC_PRO_API_KEY': API_KEY,
                'Accept': 'application/json'
            }
        });
    });

    it('should normalize symbol and currency', async () => {
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

        await priceService.getPrice(' btc ', ' usd ');

        expect(axios.get).toHaveBeenCalledWith(
            '/cryptocurrency/quotes/latest',
            expect.objectContaining({
                params: {
                    symbol: 'BTC',
                    convert: 'USD'
                }
            })
        );
    });

    it('should return formatted price data', async () => {
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

        const result = await priceService.getPrice('BTC', 'USD');

        expect(result).toEqual({
            price: 50000,
            marketCap: 1000000000000,
            volume24h: 30000000000,
            percentChange24h: 2.5
        });
    });

    it('should handle missing symbol data', async () => {
        const mockResponse = {
            data: {
                data: {}
            }
        };

        vi.mocked(axios.get).mockResolvedValueOnce(mockResponse);

        await expect(priceService.getPrice('INVALID', 'USD'))
            .rejects
            .toThrow('No data found for symbol: INVALID');
    });

    it('should handle missing quote data', async () => {
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

        await expect(priceService.getPrice('BTC', 'INVALID'))
            .rejects
            .toThrow('No quote data found for currency: INVALID');
    });

    it('should handle API errors', async () => {
        const errorMessage = 'API rate limit exceeded';
        const apiError = new Error(errorMessage);
        Object.assign(apiError, {
            isAxiosError: true,
            response: {
                data: {
                    status: {
                        error_message: errorMessage
                    }
                }
            }
        });

        vi.mocked(axios.get).mockRejectedValueOnce(apiError);

        await expect(priceService.getPrice('BTC', 'USD'))
            .rejects
            .toThrow(`${errorMessage}`);
    });

    it('should handle non-axios errors', async () => {
        const error = new Error('Network error');
        vi.mocked(axios.get).mockRejectedValueOnce(error);

        await expect(priceService.getPrice('BTC', 'USD'))
            .rejects
            .toThrow('Network error');
    });
});
