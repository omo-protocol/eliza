import {
    type Action,
    type ActionExample,
    composeContext,
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
import { ElfaService, type TrendingToken } from "../services/elfaService";
import { trendingAnalysisTemplate } from "../templates/trendingAnalysis";
import { ITextGenerationService, ServiceType } from "@elizaos/core";

export const GetTrendingTokensSchema = z.object({
    timeWindow: z.string().default('24h'),
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(50).default(50),
    minMentions: z.number().min(0).default(5)
});

export type GetTrendingTokensContent = z.infer<typeof GetTrendingTokensSchema>;

function formatTrendingTokens(tokens: TrendingToken[]): string {
    if (!tokens.length) return "No trending tokens found.";

    return tokens.map((token, index) => {
        const changeIndicator = token.change_percent > 0 ? '📈' : '📉';

        return `${index + 1}. ${token.token} ${changeIndicator}\n` +
               `   • Current Mentions: ${token.current_count}\n` +
               `   • Change: ${token.change_percent.toFixed(2)}%\n` +
               `   • Previous: ${token.previous_count}`;
    }).join('\n');
}

async function determineTimeframe(runtime: IAgentRuntime, message: Memory): Promise<'1h' | '24h' | '7d'> {
    const prompt = trendingAnalysisTemplate.replace(
        "{{recentMessages}}",
        message.content.text
    );

    const textService = runtime.getService<ITextGenerationService>(ServiceType.TEXT_GENERATION);
    if (!textService) {
        throw new Error("Text generation service not available");
    }

    const response = await textService.queueTextCompletion(
        prompt,          // prompt
        0,              // temperature
        [],             // stop sequences
        0,              // frequency penalty
        0,              // presence penalty
        50              // max tokens
    );

    try {
        const result = JSON.parse(response);
        return result.timeframe;
    } catch (error) {
        elizaLogger.warn("Failed to parse timeframe analysis:", error);
        return '24h';
    }
}

export const getTrendingTokens: Action = {
    name: "GET_TRENDING_TOKENS",
    similes: [
        "TRENDING_TOKENS",
        "HOT_TOKENS",
        "POPULAR_TOKENS",
        "TOKEN_TRENDS",
        "MOST_DISCUSSED_TOKENS"
    ],
    description: "Get currently trending tokens based on social mentions and engagement",
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

            // Determine timeframe from user message if not explicitly provided
            let timeWindow = '24h';
            let userSpecifiedTimeframe = false;

            // Check if user explicitly mentioned a timeframe
            if (message.content.text.match(/\b(1h|24h|7d)\b/)) {
                userSpecifiedTimeframe = true;
                try {
                    timeWindow = await determineTimeframe(runtime, message);
                } catch (error) {
                    elizaLogger.warn("Failed to determine timeframe, using default:", error);
                }
            }

            const content = await generateObject({
                runtime,
                schema: GetTrendingTokensSchema,
                context: message.content.text,
                modelClass: ModelClass.LARGE
            }) as GetTrendingTokensContent;

            // Only override if user explicitly specified a timeframe
            if (userSpecifiedTimeframe && timeWindow !== '24h') {
                content.timeWindow = timeWindow;
            }

            const tokens = await elfaService.getTrendingTokens({
                timeWindow: content.timeWindow,
                page: content.page,
                pageSize: content.pageSize,
                minMentions: content.minMentions
            });

            // Add detailed logging
            elizaLogger.debug('Trending tokens request params:', {
                timeWindow: content.timeWindow,
                page: content.page,
                pageSize: content.pageSize,
                minMentions: content.minMentions
            });
            elizaLogger.debug('Trending tokens response:', JSON.stringify(tokens));

            const formattedResponse = formatTrendingTokens(tokens);

            if (callback) {
                callback({
                    text: formattedResponse,
                    content: {
                        tokens,
                        params: content
                    }
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in GET_TRENDING_TOKENS handler:", error);

            if (callback) {
                callback({
                    text: `Error fetching trending tokens: ${error.message}`,
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
                    text: "What tokens are trending right now?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll check the trending tokens for you.",
                    action: "GET_TRENDING_TOKENS",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Here are the trending tokens:\n1. BTC 📈🧠\n   • Mentions: 1250\n   • Smart Money Mentions: 45\n   • Sentiment: 75.5%\n   • 24h Change: 2.3%",
                },
            },
        ],
    ],
};