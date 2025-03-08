export const trendingAnalysisTemplate = `
Analyze the conversation to determine optimal timeframe for trend analysis.
Respond ONLY with JSON:

{
  "timeframe": "1h" | "24h" | "7d"
}

Recent messages:
{{recentMessages}}`;