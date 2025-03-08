import {
    type Action,
    elizaLogger,
    generateObject,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    ModelClass,
    ITextGenerationService,
    ServiceType
} from "@elizaos/core";
import { z } from "zod";
import { validateElfaConfig } from "../environment";
import { ElfaService } from "../services/elfaService";
import { tweetGenerationTemplate } from "../templates/tweetGeneration";

// Schema for the action parameters
export const GenerateTweetFromDataSchema = z.object({
    topic: z.string().min(1, "Topic is required"),
    timeframe: z.enum(['1h', '24h', '7d']).default('24h'),
    tweetCount: z.number().min(1).max(5).default(1),
    includeData: z.boolean().default(true)
});

export type GenerateTweetFromDataContent = z.infer<typeof GenerateTweetFromDataSchema>;

async function generateTweetFromMentions(
    runtime: IAgentRuntime,
    mentions: any[],
    topic: string
): Promise<string> {
    // Get relevant content from mentions
    const examples = mentions
        .filter(m => m.content)
        .map(m => m.content)
        .slice(0, 5); // Take top 5 mentions as examples

    const prompt = tweetGenerationTemplate.replace(
        "{{#each examples}}\n- \"{{this}}\"\n{{/each}}",
        examples.map(ex => `- "${ex}"`).join('\n')
    );

    const textService = runtime.getService<ITextGenerationService>(ServiceType.TEXT_GENERATION);
    if (!textService) {
        throw new Error("Text generation service not available");
    }

    const response = await textService.queueTextCompletion(
        prompt,
        0.7,
        [],
        0,
        0,
        150
    );

    try {
        const result = JSON.parse(response);
        return `${result.tweet}\n\n${result.hashtags.join(' ')}`;
    } catch (error) {
        elizaLogger.warn("Failed to parse tweet suggestion:", error);
        return '';
    }
}

export const generateTweetFromData: Action = {
    name: "GENERATE_TWEET_FROM_DATA",
    similes: [
        "CREATE_TWEET",
        "MAKE_TWEET",
        "WRITE_TWEET",
        "COMPOSE_TWEET",
        "DRAFT_TWEET"
    ],
    description: "Generate engaging tweets based on trending market data and viral content",
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
                schema: GenerateTweetFromDataSchema,
                context: message.content.text,
                modelClass: ModelClass.LARGE
            });

            const params = object as GenerateTweetFromDataContent;

            // Collect data from multiple sources
            const [trendingTokens, viralTweets, topicMentions] = await Promise.all([
                elfaService.getTrendingTokens({ timeWindow: params.timeframe }),
                elfaService.getViralTweets({ 
                    timeframe: params.timeframe,
                    min_smart_engagement: 10,
                    limit: 10
                }),
                elfaService.searchMentions({
                    keywords: params.topic,
                    from: Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000), // last 24 hours
                    to: Math.floor(Date.now() / 1000),
                    limit: 10
                })
            ]);

            // Generate tweets based on the collected data
            const tweets = [];
            for (let i = 0; i < params.tweetCount; i++) {
                const tweet = await generateTweetFromMentions(
                    runtime,
                    [...viralTweets, ...(topicMentions.mentions || [])],
                    params.topic
                );
                tweets.push(tweet);
            }

            const response = {
                tweets,
                data: params.includeData ? {
                    trendingTokens,
                    viralTweets,
                    topicMentions: topicMentions.mentions
                } : undefined
            };

            if (callback) {
                callback({
                    text: `Generated ${tweets.length} tweet${tweets.length > 1 ? 's' : ''}:\n\n${tweets.join('\n\n---\n\n')}`,
                    content: response
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error generating tweet from data:", error);
            if (callback) {
                callback({
                    text: `Error generating tweet: ${error.message}`,
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
                    text: "Generate a tweet about Bitcoin based on trending data",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll create an engaging tweet about Bitcoin using current market data.",
                    action: "GENERATE_TWEET_FROM_DATA",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Here's your generated tweet:\n\n🚀 Bitcoin smashing through $65K as institutional demand soars! Smart money flowing in with 3x typical volume. This breakout feels different. \n\n#Bitcoin #BTC #CryptoMarkets",
                },
            },
        ],
    ],
}; 