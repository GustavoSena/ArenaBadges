# Moralis API Key Rotation

This document explains how the Moralis API key rotation feature works in the MuBadges project.

## Overview

The Moralis API key rotation feature allows the system to automatically switch between multiple Moralis API keys when one key reaches its quota limit. This ensures continuous operation of the leaderboard generation process without interruption due to API rate limiting.

## How It Works

1. **Multiple API Keys**: The system supports multiple Moralis API keys configured in a JSON array format in the `.env` file.
2. **Automatic Rotation**: When a key exceeds its quota (indicated by a 401 Unauthorized error), the system automatically rotates to the next available key.
3. **Direct API Calls**: The implementation uses direct HTTP calls to the Moralis REST API, bypassing the SDK's limitations with runtime key changes.
4. **Fallback Mechanism**: If all keys are exhausted, the system will fall back to using ethers.js for balance checks where possible.

## Configuration

Configure your Moralis API keys in the `.env` file using the following format:

```
# Multiple keys (recommended)
MORALIS_API_KEYS=["key1", "key2", "key3"]

# Single key (backward compatibility)
MORALIS_API_KEY=your_single_key
```

The system will first try to use the keys from the JSON array. If that's not available, it will fall back to the single key format for backward compatibility.

## Implementation Details

The key rotation is implemented in `src/api/moralis.ts` using the following approach:

1. **Key Management**: Keys are stored in an array and accessed by index.
2. **Rotation Logic**: When a key fails due to quota limits, the index is incremented to use the next key.
3. **Error Handling**: Specific error detection for quota limits (401 errors) with automatic retry using the next key.
4. **Direct API Calls**: Uses axios to make direct HTTP calls to the Moralis API endpoints, allowing for easy key switching between requests.

## Troubleshooting

If you encounter issues with the Moralis API key rotation:

1. **Check Key Validity**: Ensure all your API keys are valid and properly formatted in the `.env` file.
2. **Add More Keys**: If you frequently hit quota limits, consider adding more API keys.
3. **Check Logs**: The system logs detailed information about key rotation, including which key is being used and when rotation occurs.
4. **API Errors**: If you see "All Moralis API keys have exceeded their quota" errors, it means all your configured keys have reached their limits.

## Best Practices

1. **Use Multiple Keys**: Always configure multiple Moralis API keys for better reliability.
2. **Monitor Usage**: Keep track of your API usage to anticipate when you might need more keys.
3. **Stagger Key Creation**: Create API keys at different times so they don't all reach their quota limits simultaneously.
4. **Consider Paid Plans**: If you're consistently hitting quota limits, consider upgrading to a paid Moralis plan.
