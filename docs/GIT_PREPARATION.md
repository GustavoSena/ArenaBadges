# Git Preparation Guide

This document outlines the steps to prepare the MuBadges project for Git, including what files to add, commit messages, and best practices.

## Files to Add

The following files should be added to your Git repository:

### New Files

- `src/types/leaderboardClasses.ts`: Contains the base leaderboard class and MU leaderboard implementation
- `src/services/leaderboardClassService.ts`: Service functions for the class-based leaderboard approach
- `src/generateMuLeaderboard.ts`: Entry point for generating the MU leaderboard
- `docs/LEADERBOARD_CLASSES.md`: Documentation for the class-based leaderboard system
- `docs/MORALIS_API_KEY_ROTATION.md`: Documentation for the Moralis API key rotation feature

### Modified Files

- `src/api/moralis.ts`: Refactored to use direct API calls with key rotation
- `src/types/interfaces.ts`: Fixed interface definitions for token and NFT holders
- `package.json`: Added new script for MU leaderboard generation
- `README.md`: Updated with information about the new features

## Git Commands

Here are the commands to add these files to Git:

```bash
# First, replace the README.md with the new version
mv README_NEW.md README.md

# Add all new and modified files
git add src/types/leaderboardClasses.ts
git add src/services/leaderboardClassService.ts
git add src/generateMuLeaderboard.ts
git add docs/LEADERBOARD_CLASSES.md
git add docs/MORALIS_API_KEY_ROTATION.md
git add src/api/moralis.ts
git add src/types/interfaces.ts
git add package.json
git add README.md

# Commit the changes with a descriptive message
git commit -m "Implement class-based leaderboard system and Moralis API key rotation

- Added BaseLeaderboard abstract class and MuLeaderboard implementation
- Implemented custom point calculation for MU tokens and NFTs
- Added dynamic pricing from contract calls
- Refactored Moralis integration to support multiple API keys with rotation
- Fixed TypeScript interfaces for token and NFT holders
- Updated documentation with new features and usage instructions"

# Push to your repository (replace 'main' with your branch name if different)
git push origin main
```

## Best Practices

1. **Test Before Committing**: Make sure all features work correctly by running:
   ```bash
   npm run mu-leaderboard
   ```

2. **Update .env.example**: Ensure your `.env.example` file includes the new environment variables:
   ```
   MORALIS_API_KEYS=["key1", "key2"]
   ```

3. **Check for Sensitive Data**: Make sure no API keys or sensitive information is committed to the repository.

4. **Review Changes**: Before committing, review all changes to ensure they match your expectations:
   ```bash
   git diff
   ```

5. **Semantic Versioning**: If you're using versioning, update the version number according to semantic versioning principles:
   - Major version: Breaking changes
   - Minor version: New features without breaking changes
   - Patch version: Bug fixes without breaking changes

## Post-Commit Tasks

After committing your changes, consider:

1. **Creating a Release**: If this is a significant update, create a new release with appropriate tags.

2. **Updating Documentation**: Ensure all documentation is up-to-date with the latest changes.

3. **Notifying Users**: If others are using your project, notify them of the new features and how to use them.

4. **Planning Next Steps**: Consider what features or improvements you want to implement next.
