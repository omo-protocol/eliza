export const viralTweetTemplate = `
Top Viral Tweets Analysis
--------------------------

{{#if timeframe}}
Time Frame: {{timeframe}}
{{/if}}

{{#each tweets}}
"{{this.content}}"
- {{this.author}} ({{this.engagements}} engagements)
{{/each}}
`;