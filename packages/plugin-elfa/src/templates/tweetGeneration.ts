export const tweetGenerationTemplate = `
Analyze these viral tweet examples and create a new engaging post:

Viral Examples:
{{#each examples}}
- "{{this}}"
{{/each}}

Respond with JSON containing:
- tweet: Engaging text (280 chars max)
- hashtags: 3 relevant hashtags

Format:
\`\`\`json
{
  "tweet": "Your engaging tweet text...",
  "hashtags": ["#Crypto", "#BTC", "#MarketUpdate"]
}
\`\`\``;