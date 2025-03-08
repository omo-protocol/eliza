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
import { ElfaService, type SmartStats } from "../services/elfaService";

export const GetSmartStatsSchema = z.object({
    username: z.string()
        .min(1, "Username is required")
        .transform(val => val.replace(/^@/, ''))
        .pipe(z.string().regex(/^[a-zA-Z0-9_]{1,15}$/, "Invalid Twitter username"))
});

export type GetSmartStatsContent = z.infer<typeof GetSmartStatsSchema>;

function formatSmartStats(stats: SmartStats): string {
    return `Account Analysis:\n\n` +
           `Follower Engagement Ratio: ${stats.followerEngagementRatio.toFixed(2)}\n` +
           `Average Engagement: ${stats.averageEngagement.toFixed(2)}\n` +
           `Smart Following Count: ${stats.smartFollowingCount}`;
}

export const getSmartStats: Action = {
    name: "GET_SMART_STATS",
    similes: [
        "SMART_STATS",
        "CHECK_INFLUENCE",
        "ANALYZE_ACCOUNT",
        "ACCOUNT_STATS",
        "USER_STATS",
        "PROFILE_ANALYSIS"
    ],
    description: "Analyze an account's influence and smart money metrics",
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

            if (!message?.content?.text) {
                throw new Error("Message text is required");
            }

            const { object } = await generateObject({
                runtime,
                schema: GetSmartStatsSchema,
                context: message.content.text,
                modelClass: ModelClass.LARGE
            });

            if (!object || typeof object !== 'object' || !('username' in object)) {
                throw new Error('Username is required');
            }

            const username = (object as GetSmartStatsContent).username;
            elizaLogger.debug("Fetching stats for username:", username);

            const stats = await elfaService.getSmartStats({ username });

            const formattedResponse = formatSmartStats(stats);

            if (callback) {
                callback({
                    text: formattedResponse,
                    content: {
                        stats,
                        params: object as GetSmartStatsContent
                    }
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in GET_SMART_STATS handler:", error);

            if (callback) {
                callback({
                    text: `Error fetching smart stats: ${error.message}`,
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
                    text: "Check the influence of @vitalik_buterin",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll analyze Vitalik's account metrics.",
                    action: "GET_SMART_STATS",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Account Analysis for @vitalik_buterin 🧠👑\n\nSmart Money Score: 95.5%\nInfluence Score: 98.2%\n\nFollowers:\n• Total: 4,890,123\n• Smart Money: 245,890 (5.2%)\n\nAverage Engagement:\n• Smart Engagement: 856.4\n• Likes: 12453.2\n• Retweets: 2341.8\n\nTop Topics: Ethereum, Layer2, ZKP, DeFi",
                },
            },
        ],
    ],
};