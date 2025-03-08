import {
    Action, ActionExample, elizaLogger,
    generateObject, HandlerCallback, IAgentRuntime, Memory, State, ModelClass,
    ITextGenerationService, ServiceType
} from "@elizaos/core";
import { z } from "zod";
import { ElfaService } from "../services/elfaService";
import { validateElfaConfig } from "../environment";
import { insightGenerationTemplate } from "../templates/insightGeneration";

export const GenerateInsightSchema = z.object({
    topic: z.string().min(1, "Topic is required"),
    timeframe: z.enum(['1h', '24h', '7d']).default('24h'),
    depth: z.enum(['brief', 'detailed']).default('detailed')
});

export type GenerateInsightContent = z.infer<typeof GenerateInsightSchema>;

export const generateInsight: Action = {
    name: "GENERATE_INSIGHT",
    similes: [
        "MARKET_INSIGHT", 
        "CRYPTO_ANALYSIS", 
        "TOKEN_INSIGHT", 
        "MARKET_ANALYSIS",
        "SENTIMENT_REPORT"
    ],
    description: "Generate comprehensive market insights for a token, ecosystem, or the entire crypto market",
    validate: async (runtime: IAgentRuntime) => {
        await validateElfaConfig(runtime);
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: {},
        callback?: HandlerCallback
    ): Promise<boolean> => {
        try {
            const config = await validateElfaConfig(runtime);
            const service = new ElfaService(config.ELFA_API_KEY);
            
            // Extract parameters from the message
            const { object } = await generateObject({
                runtime,
                schema: GenerateInsightSchema,
                context: message.content.text,
                modelClass: ModelClass.LARGE
            });
            
            const params = object as GenerateInsightContent;
            elizaLogger.info("Generating insight for:", params);
            
            // Collect data from multiple endpoints
            const [trendingTokens, viralTweets] = await Promise.all([
                service.getTrendingTokens({ timeWindow: params.timeframe }),
                service.getViralTweets({ timeframe: params.timeframe as '1h' | '24h' | '7d' })
            ]);
            
            // Get mentions for the specific topic if it's a token
            let mentions = [];
            if (params.topic && params.topic.length > 0) {
                const mentionsResult = await service.searchMentions({
                    keywords: params.topic,
                    from: Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000),
                    to: Math.floor(Date.now() / 1000),
                    limit: 30
                });
                mentions = mentionsResult.mentions;
            }
            
            // Prepare data for the insight generation with smaller slices
            const insightData = {
                topic: params.topic,
                timeframe: params.timeframe,
                trendingTokens: trendingTokens.slice(0, 5),  // Reduced from 10 to 5
                viralTweets: viralTweets.slice(0, 3).map(tweet => ({
                    // Map to a consistent format using only the new schema structure
                    content: tweet.content,
                    username: tweet.account?.username || 'anonymous',
                    likes: tweet.likeCount || 0,
                    reposts: tweet.repostCount || 0,
                    views: tweet.viewCount || 0,
                    date: tweet.mentionedAt || '',
                    isVerified: tweet.account?.isVerified || false
                })),
                topicMentions: mentions.slice(0, 5).map(mention => ({
                    // Map to a consistent format using only the new schema structure
                    content: mention.content,
                    username: mention.account?.username || 'anonymous',
                    likes: mention.likeCount || 0,
                    reposts: mention.repostCount || 0,
                    date: mention.mentionedAt || '',
                    isVerified: mention.account?.isVerified || false
                })),
                depth: params.depth
            };
            
            // Get the text generation service
            const textService = runtime.getService<ITextGenerationService>(ServiceType.TEXT_GENERATION);
            if (!textService) {
                throw new Error("Text generation service not available");
            }
            
            const prompt = insightGenerationTemplate
                .replace("{{topic}}", params.topic)
                .replace("{{timeframe}}", params.timeframe)
                .replace("{{trendingTokensData}}", JSON.stringify(insightData.trendingTokens))
                .replace("{{viralTweetsData}}", JSON.stringify(insightData.viralTweets))
                .replace("{{topicMentionsData}}", JSON.stringify(insightData.topicMentions))
                .replace("{{depth}}", params.depth);
            
            // Use the text generation service with reduced token count
            const insightText = await textService.queueTextCompletion(
                prompt,
                0.7,  // temperature
                [],   // stop sequences
                0,    // frequency penalty
                0,    // presence penalty
                500   // Reduced max tokens from 1000 to 500
            );
            
            callback?.({
                text: insightText,
                content: {
                    topic: params.topic,
                    timeframe: params.timeframe,
                    insight: insightText,
                    data: insightData
                }
            });
            
            return true;
        } catch (error) {
            elizaLogger.error("Error generating insight:", error);
            callback?.({ 
                text: `Failed to generate insight: ${error.message}`,
                error: {
                    message: error.message,
                    name: error.name
                }
            });
            return false;
        }
    },
    examples: [
        [{
            user: "{{user}}",
            content: { text: "Give me market insights on Bitcoin for the past 24 hours" }
        }, {
            user: "{{agent}}",
            content: {
                text: "I'll generate a comprehensive market insight for Bitcoin.",
                action: "GENERATE_INSIGHT"
            }
        }, {
            user: "{{agent}}",
            content: {
                text: "# Bitcoin Market Insight (24h)\n\n## Market Sentiment\nBitcoin sentiment is currently **bullish** with 65% positive mentions in the last 24 hours. The market is responding to recent price action above $60,000 and anticipation of the upcoming halving event.\n\n## Key Metrics\n- **Price Movement**: +2.3% in 24h\n- **Social Volume**: 12,450 mentions (+18% from previous period)\n- **Smart Money Sentiment**: Accumulation phase detected\n\n## Trending Topics\n1. Bitcoin halving expectations\n2. Institutional adoption news\n3. Technical analysis of $65K resistance level\n\n## Notable Tweets\n> \"Bitcoin breaking $60K again shows the resilience of this asset class. Next stop $100K by EOY. #Bitcoin #BTC\"\n- @crypto_influencer (5.2K likes)\n\n## Market Insight\nThe current accumulation pattern combined with positive sentiment suggests continued upward momentum. Smart money accounts are showing increased interest compared to previous weeks, which historically precedes significant price movements."
            }
        }]
    ] as ActionExample[][]
}; 