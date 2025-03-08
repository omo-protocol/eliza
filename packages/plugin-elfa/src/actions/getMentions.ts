import {
    type Action,
    elizaLogger,
    generateObject,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    ModelClass
} from "@elizaos/core";
import { z } from "zod";
import { validateElfaConfig } from "../environment";
import { ElfaService, type Mention, GetMentionsByKeywordsResponseSchema } from "../services/elfaService";

export const GetMentionsSchema = z.object({
    keywords: z.string().min(1, "Keywords are required")
        .describe("Up to 5 keywords to search for, separated by commas. Phrases accepted"),
    from: z.number().optional()
        .default(() => Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60))
        .describe("Start date (unix timestamp), defaults to 7 days ago"),
    to: z.number().optional()
        .default(() => Math.floor(Date.now() / 1000))
        .describe("End date (unix timestamp), defaults to current time"),
    limit: z.number().min(1).max(30).default(20)
        .describe("Number of results to return, defaults to 20, max 30"),
    searchType: z.enum(['and', 'or']).optional().default('or')
        .describe("Type of search (and, or)"),
    cursor: z.string().optional()
        .describe("Cursor for pagination, expires after 10 seconds")
});

export type GetMentionsContent = z.infer<typeof GetMentionsSchema>;

async function formatMentions(tweets: Mention[]): Promise<string> {
    if (!tweets.length) return "No mentions found for these keywords.";

    return tweets.map((tweet, index) => {
        // Get username from twitter_account_info or fallback to 'anonymous'
        const username = tweet.account?.username || 'anonymous';
        
        // Use metrics for engagement data with fallbacks
        const metrics = tweet.metrics || { view_count: 0, like_count: 0, repost_count: 0, reply_count: 0 };
        const views = metrics.view_count || 0;
        const likes = metrics.like_count || 0;
        const reposts = metrics.repost_count || 0;
        const replies = metrics.reply_count || 0;
        const mentionDate = tweet.mentioned_at || '';

        return `${index + 1}. @${username}\n` +
               `   "${tweet.content || ""}"\n` +
               `   • Views: ${views}\n` +
               `   • Likes: ${likes} | RTs: ${reposts} | Replies: ${replies}\n` +
               `   • Posted: ${mentionDate ? new Date(mentionDate).toLocaleString() : 'unknown'}\n`;
    }).join('\n');
}

export const getMentions: Action = {
    name: "GET_MENTIONS",
    similes: [
        "SEARCH_MENTIONS",
        "KEYWORD_MENTIONS",
        "FIND_MENTIONS",
        "SEARCH_TWEETS",
        "FIND_TWEETS"
    ],
    description: "Search for mentions of specific keywords or phrases from social media within a time window",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        await validateElfaConfig(runtime);
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        try {
            const config = await validateElfaConfig(runtime);
            const elfaService = new ElfaService(config.ELFA_API_KEY);

            // Extract parameters from the message
            const { object } = await generateObject({
                runtime,
                schema: GetMentionsSchema,
                context: message.content.text,
                modelClass: ModelClass.LARGE
            });

            if (!object || typeof object !== 'object' || !('keywords' in object)) {
                throw new Error('Keywords are required');
            }

            const params = object as GetMentionsContent;
            elizaLogger.debug("Fetching mentions for keywords:", params.keywords);

            // Call the Elfa API to search mentions
            const response = await elfaService.searchMentions({
                keywords: params.keywords,
                from: params.from,
                to: params.to,
                limit: params.limit,
                searchType: params.searchType as 'and' | 'or',
                cursor: params.cursor
            });

            // No need for schema validation here since we're handling it in the service
            const formattedResponse = await formatMentions(response.mentions.map(mention => ({
                ...mention,
                id: typeof mention.id === 'string' ? parseInt(mention.id, 10) : mention.id
            })) || []);

            if (callback) {
                callback({
                    text: formattedResponse,
                    content: { 
                        mentions: response.mentions,
                        metadata: {
                            cursor: response.cursor,
                            total: response.total || 0,
                            limit: params.limit
                        },
                        params
                    }
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in GET_MENTIONS handler:", error);
            
            // Format error message for better readability
            let errorMessage = "Error fetching mentions";
            if (error.message) {
                errorMessage += `: ${error.message}`;
                
                // If it's a Zod validation error, provide a more helpful message
                if (error.message.includes("invalid_type") || error.message.includes("Required")) {
                    errorMessage = "The API response format doesn't match our expectations. This might be due to API changes. Please check the logs for details.";
                }
            }
            
            if (callback) {
                callback({ 
                    text: errorMessage,
                    error: {
                        message: error.message,
                        name: error.name,
                        details: error.errors || error.issues || undefined
                    }
                });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Show me recent mentions of hyperliquid and BUDDY",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll find recent mentions of hyperliquid and BUDDY for you.",
                    action: "GET_MENTIONS",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Here are recent mentions of hyperliquid and BUDDY:\n1. @crypto_analyst ✓\n   \"Hyperliquid's volume is growing steadily, becoming a serious competitor in the perps space\"\n   • Views: 45,230\n   • Likes: 1,245 | RTs: 356 | Replies: 89\n   • Posted: 2024-05-15 14:30:00\n\n2. @defi_watcher\n   \"BUDDY token just launched on hyperliquid, already seeing good liquidity\"\n   • Views: 32,150\n   • Likes: 876 | RTs: 213 | Replies: 45\n   • Posted: 2024-05-15 12:15:00",
                },
            },
        ],
    ],
};