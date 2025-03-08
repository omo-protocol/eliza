import { elizaLogger } from "@elizaos/core";
import axios, { type AxiosInstance } from "axios";
import { z } from "zod";

const API_BASE_URL = "https://api.elfa.ai/v1";

// Response type schemas
export const TrendingTokenSchema = z.object({
    change_percent: z.number(),
    previous_count: z.number(),
    current_count: z.number(),
    token: z.string()
});

export const TopMentionSchema = z.object({
    metrics: z.object({
        view_count: z.number(),
        repost_count: z.number(),
        reply_count: z.number(),
        like_count: z.number()
    }),
    mentioned_at: z.string(),
    content: z.string(),
    id: z.number(),
});

export const SmartStatsSchema = z.object({
    followerEngagementRatio: z.number(),
    averageEngagement: z.number(),
    smartFollowingCount: z.number()
});

export const SimpleMentionSchema = z.object({
    id: z.number(),
    twitter_id: z.string().optional(),
    twitter_user_id: z.string().optional(),
    parent_tweet_id: z.string().optional(),
    content: z.string(),
    mentioned_at: z.string(),
    type: z.string(),
    twitter_account_info: z.object({
        username: z.string(),
        description: z.string().optional(),
        profileImageUrl: z.string().optional()
    }).optional(),
    metrics: z.object({
        view_count: z.number(),
        repost_count: z.number(),
        reply_count: z.number(),
        like_count: z.number()
    })
});

export const MentionSchema = z.object({
    id: z.union([z.string(), z.number()]),
    type: z.string(),
    content: z.string().nullable(),
    originalUrl: z.string().optional(),
    data: z.any().optional(),
    likeCount: z.number().nullable().optional(),
    quoteCount: z.number().nullable().optional(),
    replyCount: z.number().nullable().optional(),
    repostCount: z.number().nullable().optional(),
    viewCount: z.number().nullable().optional(),
    mentionedAt: z.string().datetime().optional(),
    bookmarkCount: z.number().nullable().optional(),
    twitter_account_info: z.object({
        username: z.string(),
    }).optional(),
    metrics: z.object({
        view_count: z.number().optional(),
        like_count: z.number().optional(),
        repost_count: z.number().optional(),
        reply_count: z.number().optional()
    }).optional(),
    mentioned_at: z.string().optional(),
    account: z.object({
        id: z.number(),
        username: z.string(),
        data: z.object({
            profileBannerUrl: z.string().optional(),
            profileImageUrl: z.string().optional(),
            description: z.string().optional(),
            userSince: z.string().optional(),
            location: z.string().optional(),
            name: z.string().optional()
        }).optional(),
        followerCount: z.number().optional(),
        followingCount: z.number().optional(),
        isVerified: z.boolean().optional()
    }).optional().or(z.any())
});

export const TopMentionsResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        pageSize: z.number(),
        page: z.number(),
        total: z.number(),
        data: z.array(TopMentionSchema)
    })
});

export const TrendingTokensResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        pageSize: z.number(),
        page: z.number(),
        total: z.number(),
        data: z.array(TrendingTokenSchema)
    })
});

export const AccountSmartStatsResponseSchema = z.object({
    success: z.boolean(),
    data: SmartStatsSchema
});

export const GetMentionsByKeywordsResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(SimpleMentionSchema),
    metadata: z.object({
        cursor: z.string().optional(),
        total: z.number().optional()
    }).optional()
});

export const MentionResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(MentionSchema),
    metadata: z.object({
        offset: z.number(),
        limit: z.number(),
        total: z.number()
    })
});

export const ApiKeyStatusResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        remainingRequests: z.object({
            monthly: z.number(),
            daily: z.number()
        }),
        isExpired: z.boolean(),
        limits: z.object({
            monthly: z.number(),
            daily: z.number()
        }),
        usage: z.object({
            monthly: z.number(),
            daily: z.number()
        }),
        createdAt: z.string().or(z.object({})),
        expiresAt: z.string().or(z.object({})),
        monthlyRequestLimit: z.number(),
        dailyRequestLimit: z.number(),
        status: z.enum(['active', 'revoked', 'expired', 'payment_required']),
        name: z.string(),
        id: z.number()
    })
});

export type TrendingToken = z.infer<typeof TrendingTokenSchema>;
export type Mention = z.infer<typeof MentionSchema>;
export type SmartStats = z.infer<typeof SmartStatsSchema>;
export type TopMention = z.infer<typeof TopMentionSchema>;
export type ApiKeyStatus = z.infer<typeof ApiKeyStatusResponseSchema>['data'];
export type SimpleMention = z.infer<typeof SimpleMentionSchema>;

export class ElfaService {
    private client: AxiosInstance;

    constructor(apiKey: string) {
        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('Invalid API key: API key must be a non-empty string');
        }

        // Create base axios instance
        this.client = axios.create({
            baseURL: API_BASE_URL,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Add request interceptor that will run BEFORE every request
        this.client.interceptors.request.use((config) => {
            // Start with a fresh headers object
            config.headers = config.headers || new axios.AxiosHeaders();
            
            // Remove any Authorization headers (case-insensitive)
            Object.keys(config.headers).forEach(key => {
                if (key.toLowerCase() === 'authorization') {
                    delete config.headers[key];
                }
            });
            
            // Force set the correct header
            config.headers['x-elfa-api-key'] = apiKey;
            
            elizaLogger.debug('Final request headers:', config.headers);
            
            return config;
        });
    }

    async getTrendingTokens(params: {
        timeWindow?: string;  // e.g., "24h"
        page?: number;
        pageSize?: number;
        minMentions?: number;
    } = {}) {
        try {
            const response = await this.client.get('/trending-tokens', { params });
            
            // Add debug logging to see the raw response
            elizaLogger.debug('Raw trending tokens response:', JSON.stringify(response.data));
            
            const result = TrendingTokensResponseSchema.parse(response.data);
            
            elizaLogger.info(`Retrieved ${result.data.data.length} trending tokens`);
            return result.data.data;
        } catch (error) {
            elizaLogger.error('Error fetching trending tokens:', error);
            throw this.handleError(error);
        }
    }

    async searchMentions(params: {
        keywords: string;
        from: number;
        to: number;
        limit?: number;
        searchType?: 'and' | 'or';
        cursor?: string;
    }) {
        try {
            const response = await this.client.get('/mentions/search', { params });
            
            // Log the raw response to debug
            elizaLogger.debug('Raw search mentions response:', JSON.stringify(response.data).substring(0, 500) + '...');
            
            // Handle different response formats
            let mentions = [];
            let cursor = undefined;
            let total = 0;
            
            if (response.data && response.data.success && Array.isArray(response.data.data)) {
                // Standard format
                mentions = response.data.data;
                cursor = response.data.metadata?.cursor;
                total = response.data.metadata?.total || 0;
            } else if (Array.isArray(response.data)) {
                // Direct array format
                mentions = response.data;
                total = mentions.length;
            } else if (response.data && Array.isArray(response.data.mentions)) {
                // Alternative format
                mentions = response.data.mentions;
                cursor = response.data.cursor;
                total = response.data.total || mentions.length;
            }
            
            elizaLogger.info(`Retrieved ${mentions.length} mentions for keywords: ${params.keywords}`);
            
            return {
                mentions,
                cursor,
                total
            };
        } catch (error) {
            elizaLogger.error('Error searching mentions:', error);
            throw this.handleError(error);
        }
    }
    
    async getViralTweets(params: {
        timeframe?: '1h' | '24h' | '7d';
        min_smart_engagement?: number;
        limit?: number;
    } = {}) {
        try {
            const response = await this.client.get('/mentions', { params });
            const result = MentionResponseSchema.parse(response.data);

            elizaLogger.info(`Retrieved ${result.data.length} viral tweets`);
            return result.data;
        } catch (error) {
            elizaLogger.error('Error fetching viral tweets:', error);
            throw this.handleError(error);
        }
    }
    // Add a new method that directly uses the /mentions endpoint with all available parameters
    async getMentions(params: {
        limit?: number;
        offset?: number;
        ticker?: string;  // Add ticker parameter
    } = {}) {
        try {
            // Debug the parameters
            elizaLogger.debug('Getting mentions with params:', params);
            
            const response = await this.client.get('/mentions', { params });
            
            // Debug the raw response
            elizaLogger.debug('Raw mentions response:', JSON.stringify(response.data).substring(0, 500) + '...');
            
            // Use a more permissive parsing approach
            let mentions = [];
            if (response.data && response.data.data && Array.isArray(response.data.data)) {
                mentions = response.data.data;
            } else if (response.data && Array.isArray(response.data)) {
                mentions = response.data;
            }
            
            elizaLogger.info(`Retrieved ${mentions.length} mentions`);
            return mentions;
        } catch (error) {
            elizaLogger.error('Error fetching mentions:', error);
            throw this.handleError(error);
        }
    }

    async getSmartStats({ username }: { username: string }): Promise<SmartStats> {
        if (!username) {
            throw new Error('Username is required');
        }

        try {
            const cleanUsername = username.replace(/^@/, '');  // Remove @ if present
            const response = await this.client.get(`/account/smart-stats`, {
                params: { username: cleanUsername }
            });
            
            if (!response.data?.data) {
                throw new Error('Invalid response format');
            }

            return {
                followerEngagementRatio: response.data.data.followerEngagementRatio,
                averageEngagement: response.data.data.averageEngagement,
                smartFollowingCount: response.data.data.smartFollowingCount
            };
        } catch (error) {
            elizaLogger.error('Error fetching smart stats:', error);
            throw this.handleError(error);
        }
    }

    async getTopMentions(params: {
        ticker: string;           // Required
        timeWindow?: string;      // Default: "1h"
        page?: number;           // Default: 1
        pageSize?: number;       // Default: 10
        includeAccountDetails?: boolean;  // Default: false
    }) {
        try {
            const response = await this.client.get('/top-mentions', { params });
            
            // Add debug logging to see the raw response
            elizaLogger.debug('Raw top mentions response:', JSON.stringify(response.data).substring(0, 1000) + 
                (JSON.stringify(response.data).length > 1000 ? '...' : ''));
            
            const result = TopMentionsResponseSchema.parse(response.data);

            elizaLogger.info(`Retrieved ${result.data.data.length} top mentions for "${params.ticker}"`);
            return result.data.data;
        } catch (error) {
            elizaLogger.error('Error fetching top mentions:', error);
            throw this.handleError(error);
        }
    }

    async checkKeyStatus(): Promise<ApiKeyStatus> {
        try {
            const response = await this.client.get('/key-status');
            
            // Debug logging
            elizaLogger.debug('API Response:', {
                status: response.status,
                statusText: response.statusText,
                data: response.data,
                headers: response.headers
            });

            // Parse the response with the new schema
            const result = ApiKeyStatusResponseSchema.parse(response.data);
            
            return result.data;
        } catch (error) {
            elizaLogger.error('Error checking API key status:', error);
            // Return a default response with more accurate fields
            return {
                remainingRequests: { monthly: 0, daily: 0 },
                isExpired: true,
                limits: { monthly: 0, daily: 0 },
                usage: { monthly: 0, daily: 0 },
                createdAt: new Date().toISOString(),
                expiresAt: new Date().toISOString(),
                monthlyRequestLimit: 0,
                dailyRequestLimit: 0,
                status: 'expired',
                name: 'Invalid Key',
                id: 0
            };
        }
    }

    async ping() {
        try {
            const response = await this.client.get('/ping');
            return response.status === 200;
        } catch (error) {
            elizaLogger.error('Error pinging API:', error);
            throw this.handleError(error);
        }
    }

    private handleError(error: any): Error {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;

            switch (status) {
                case 401:
                    return new Error('Authentication failed: Invalid or missing API key');
                case 429:
                    return new Error('Rate limit exceeded. Please try again later.');
                case 400:
                    return new Error(`Invalid request: ${message}`);
                default:
                    return new Error(`API Error (${status}): ${message}`);
            }
        }
        return error instanceof Error ? error : new Error(String(error));
    }
}

// Initialize the service
const elfaService = new ElfaService(process.env.ELFA_API_KEY);

// Replace the top-level await code with an immediately invoked async function
(async () => {
  // Check key status
  const status = await elfaService.checkKeyStatus();
  console.log('API Key Status:', {
      isValid: status.status === 'active',
      remainingCredits: status.remainingRequests.daily,
  });

  const isConnected = await elfaService.ping();
  console.log('API Connected:', isConnected);
})().catch(error => console.error('Error:', error));