import type { Plugin } from "@elizaos/core";
import {
    getMentions,
    getSmartStats,
    getTrendingTokens,
    getViralTweets,
    generateInsight,
    getTopMentions,
} from "./actions";

export const elfaPlugin: Plugin = {
    name: "elfa",
    description: "Elfa Plugin for market sentiment analysis and tweet generation",
    actions: [
        getTrendingTokens,
        getMentions,
        getViralTweets,
        getSmartStats,
        generateInsight,
        getTopMentions,
    ],
    evaluators: [],
    providers: [],
};

export default elfaPlugin;