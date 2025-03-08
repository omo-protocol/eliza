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
import { ElfaService, type Mention } from "../services/elfaService";
import { viralTweetTemplate } from "../templates/viralTweetTemplate";
import { tweetGenerationTemplate } from "../templates/tweetGeneration";
import { ITextGenerationService, ServiceType } from "@elizaos/core";

export const GetViralTweetsSchema = z.object({
    timeframe: z.enum(['1h', '24h', '7d']).default('24h'),
    min_smart_engagement: z.number().min(1).default(10),
    limit: z.number().min(1).max(100).default(10)
});

export type GetViralTweetsContent = z.infer<typeof GetViralTweetsSchema>;

async function formatViralTweets(tweets: Mention[]): Promise<string> {
    if (!tweets.length) return "No viral tweets found.";

    return tweets.map((tweet, index) => {
        const username = tweet.account?.username || 'anonymous';
        
        // Check if verified using the account structure
        const verified = tweet.account?.isVerified ? '✓' : '';

        // Use the new field names
        const views = tweet.viewCount || 0;
        const likes = tweet.likeCount || 0;
        const reposts = tweet.repostCount || 0;
        const mentionDate = tweet.mentionedAt || '';

        return `${index + 1}. @${username} ${verified}\n` +
               `   "${tweet.content}"\n` +
               `   • Views: ${views}\n` +
               `   • Likes: ${likes} | RTs: ${reposts}\n` +
               `   • Posted: ${mentionDate ? new Date(mentionDate).toLocaleString() : 'unknown'}\n`;
    }).join('\n');
}

async function generateTweetSuggestion(
    runtime: IAgentRuntime,
    tweets: Mention[]
): Promise<string> {
    const examples = tweets
        .slice(0, 10)
        .map(t => t.content);

    const prompt = tweetGenerationTemplate.replace(
        "{{#each examples}}\n- \"{{this}}\"\n{{/each}}",
        examples.map(ex => `- "${ex}"`).join('\n')
    );

    const textService = runtime.getService<ITextGenerationService>(ServiceType.TEXT_GENERATION);
    if (!textService) {
        throw new Error("Text generation service not available");
    }

    const response = await textService.queueTextCompletion(
        prompt,          // prompt
        0.7,            // temperature (using your original 0.7)
        [],             // stop sequences
        0,              // frequency penalty
        0,              // presence penalty
        150             // max tokens (using your original 150)
    );

    try {
        const result = JSON.parse(response);
        return `\nSuggested Tweet:\n"${result.tweet}"\n\nHashtags: ${result.hashtags.join(' ')}`;
    } catch (error) {
        elizaLogger.warn("Failed to parse tweet suggestion:", error);
        return '';
    }
}

export const getViralTweets: Action = {
    name: "GET_VIRAL_TWEETS",
    similes: [
        "VIRAL_TWEETS",
        "HOT_TWEETS",
        "TRENDING_TWEETS",
        "POPULAR_TWEETS",
        "HIGH_ENGAGEMENT_TWEETS"
    ],
    description: "Get viral tweets with high smart engagement",
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

            const response = await elfaService.getViralTweets({
                timeframe: '24h',
                min_smart_engagement: 10,
                limit: 20
            });
            
            const formattedResponse = await formatViralTweets(response);

            if (callback) {
                callback({
                    text: formattedResponse,
                    content: { 
                        tweets: response,
                        total: response.length 
                    }
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in GET_VIRAL_TWEETS handler:", error);
            if (callback) {
                callback({ text: `Error: ${error.message}` });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Show me viral crypto tweets",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll find the most viral crypto tweets.",
                    action: "GET_VIRAL_TWEETS",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Here are the viral tweets:\n1. @whale_alert 🧠🔥📈\n   \"$500M transferred from unknown wallet to Binance\"\n   • Smart Engagement: 25\n   • Likes: 1245 | RTs: 356\n   • Posted: 2024-01-15 14:30:00\n   • Tokens: BTC, BNB",
                },
            },
        ],
    ],
};