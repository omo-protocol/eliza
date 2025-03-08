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
import { ElfaService } from "../services/elfaService";

// Define the schema based on the API parameters
export const GetTopMentionsSchema = z.object({
    ticker: z.string().min(1, "Ticker is required")
        .describe("The ticker symbol to get mentions for. Prefixing with $ will only return cashtag matches."),
    timeWindow: z.enum(['1h', '24h', '7d']).default('1h'),
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(10),
    includeAccountDetails: z.boolean().default(true)
});

export type GetTopMentionsContent = z.infer<typeof GetTopMentionsSchema>;

// Format the mentions for display
async function formatTopMentions(data: any): Promise<string> {
    if (!data?.length) return "No top mentions found for this ticker.";

    return data.map((mention: any, index: number) => {
        const metrics = mention.metrics || {};
        
        // Debug log to see the account structure
        elizaLogger.debug('Account info for mention:', {
            twitter_account_info: mention.twitter_account_info,
            account: mention.account,
            raw_mention: mention
        });

        // Try to get username from different possible locations
        const username = mention.twitter_account_info?.username || 
                        mention.account?.username ||
                        mention.account?.screen_name || // Add screen_name as fallback
                        mention.username || // Direct username property
                        'anonymous';
        
        return `${index + 1}. @${username}\n` +
               `   "${mention.content}"\n` +
               `   • Views: ${metrics.view_count || 0}\n` +
               `   • Likes: ${metrics.like_count || 0} | RTs: ${metrics.repost_count || 0} | Replies: ${metrics.reply_count || 0}\n` +
               `   • Posted: ${mention.mentioned_at ? new Date(mention.mentioned_at).toLocaleString() : 'unknown'}\n`;
    }).join('\n');
}

export const getTopMentions: Action = {
    name: "GET_TOP_MENTIONS",
    similes: [
        "TOP_MENTIONS",
        "TRENDING_MENTIONS",
        "POPULAR_MENTIONS",
        "VIRAL_MENTIONS",
        "BEST_MENTIONS"
    ],
    description: "Get the most significant mentions for a given ticker symbol, ranked by view count. Prefixing the ticker with $ will only return cashtag matches.",
    validate: async (runtime: IAgentRuntime) => {
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
                schema: GetTopMentionsSchema,
                context: message.content.text,
                modelClass: ModelClass.LARGE
            });

            const params = object as GetTopMentionsContent;
            elizaLogger.debug("Fetching top mentions for ticker:", params.ticker);

            // Call the Elfa API to get top mentions
            const response = await elfaService.getTopMentions({
                ticker: params.ticker,
                timeWindow: params.timeWindow,
                page: params.page,
                pageSize: params.pageSize,
                includeAccountDetails: params.includeAccountDetails
            });

            const formattedResponse = await formatTopMentions(response);

            if (callback) {
                callback({
                    text: formattedResponse,
                    content: {
                        data: response,
                        metadata: {
                            page: params.page,
                            pageSize: params.pageSize,
                            total: response.length || 0
                        },
                        params
                    }
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in GET_TOP_MENTIONS handler:", error);
            if (callback) {
                callback({ 
                    text: `Error fetching top mentions: ${error.message}`,
                    error: {
                        message: error.message,
                        name: error.name
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
                    text: "Show me the top mentions for ETH in the last 24 hours",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll find the most viewed mentions of ETH from the past 24 hours.",
                    action: "GET_TOP_MENTIONS",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Here are the top mentions for ETH:\n1. \"Ethereum just hit a new ATH! The merge is proving successful with reduced gas fees and increased TPS.\"\n   • Views: 125,450\n   • Likes: 3,245 | RTs: 1,356 | Replies: 428\n   • Posted: 2024-05-15 14:30:00\n\n2. \"ETH staking rewards are looking incredible post-merge. APY currently at 7.2%\"\n   • Views: 98,150\n   • Likes: 2,876 | RTs: 913 | Replies: 245\n   • Posted: 2024-05-15 12:15:00",
                },
            },
        ],
    ],
}; 