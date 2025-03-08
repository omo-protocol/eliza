# Plugin Elfa

A powerful plugin for analyzing market sentiment and generating engaging tweets based on trending financial discussions using the Elfa API.

## Overview

The Plugin Elfa provides comprehensive market sentiment analysis and social engagement optimization through Elfa's advanced API. It helps identify trending tokens, analyze viral tweets, and generate engaging content based on successful patterns.

## Installation

```bash
pnpm add @elizaos/plugin-elfa
```

## Configuration

Set up your environment with the required Elfa API key:

| Variable Name | Description      |
| ------------ | ---------------- |
| `ELFA_API_KEY` | Your Elfa API key |

## Features

### Market Sentiment Analysis
- Smart mention tracking for any keyword
- Trending token identification
- Real-time market sentiment monitoring

### Tweet Optimization
- Viral tweet analysis
- High-engagement pattern recognition
- AI-powered tweet generation

### Smart Money Tracking
- Account influence assessment
- Smart follower analytics
- Bot filtering

## Usage

```typescript
import { elfaPlugin } from "@elizaos/plugin-elfa";

// Initialize the plugin
const plugin = elfaPlugin;
```

## Actions

### GET_MENTIONS
Fetches smart mentions for specified keywords.

Examples:
- "Find mentions of Bitcoin in the last 24 hours"
- "Show me what people are saying about ETH"
- "Get mentions for $SOL with high engagement"

### GET_TRENDING_TOKENS
Identifies tokens with the highest discussion volume.

Examples:
- "What tokens are trending right now?"
- "Show me the most discussed cryptocurrencies"
- "Which tokens have the most mentions today?"

### GET_VIRAL_TWEETS
Retrieves tweets with significant smart engagement.

Examples:
- "Show me viral crypto tweets"
- "Find tweets about Bitcoin with high engagement"
- "Get popular tweets from smart money accounts"

### GET_SMART_STATS
Analyzes account influence and smart follower metrics.

Examples:
- "Check the influence of @username"
- "Get smart stats for this account"
- "Analyze this user's engagement metrics"

## Response Format

All actions return structured data including:
- Formatted text for easy reading
- Raw data for programmatic use
- Engagement metrics
- Smart money indicators

## Error Handling

The plugin handles various error scenarios:
- API key validation
- Rate limiting
- Network issues
- Invalid parameters

## Rate Limits

Please refer to the [Elfa API Documentation](https://api-docs.elfa.ai/) for current rate limits and usage guidelines.