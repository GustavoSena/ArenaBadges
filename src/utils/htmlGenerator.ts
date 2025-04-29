import * as fs from 'fs';
import * as path from 'path';
import { Leaderboard, LeaderboardEntry } from '../types/leaderboard';

/**
 * Generate HTML for the leaderboard
 */
export function generateLeaderboardHtml(leaderboard: Leaderboard): string {
  const { entries, timestamp } = leaderboard;
  
  // Get all token and NFT types from the entries
  const tokenTypes = new Set<string>();
  const nftTypes = new Set<string>();
  
  entries.forEach(entry => {
    Object.keys(entry.tokenPoints).forEach(token => tokenTypes.add(token));
    Object.keys(entry.nftPoints).forEach(nft => nftTypes.add(nft));
  });
  
  // Convert sets to arrays
  const tokenColumns = Array.from(tokenTypes);
  const nftColumns = Array.from(nftTypes);
  
  // Generate HTML
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mu Community Leaderboard</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    h1 {
      color: #2c3e50;
      text-align: center;
      margin-bottom: 30px;
    }
    .timestamp {
      text-align: center;
      color: #7f8c8d;
      margin-bottom: 30px;
      font-size: 0.9em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      background-color: white;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #3498db;
      color: white;
      font-weight: bold;
      position: sticky;
      top: 0;
    }
    tr:nth-child(even) {
      background-color: #f2f2f2;
    }
    tr:hover {
      background-color: #e9f7fe;
    }
    .rank {
      font-weight: bold;
      text-align: center;
    }
    .top-3 {
      font-size: 1.1em;
    }
    .rank-1 {
      background-color: #fef9e7;
    }
    .rank-2 {
      background-color: #f5f5f5;
    }
    .rank-3 {
      background-color: #fbeee6;
    }
    .twitter-handle {
      color: #3498db;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .profile-image {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #3498db;
    }
    .total-points {
      font-weight: bold;
      text-align: right;
    }
    .points {
      text-align: right;
    }
    .address {
      font-family: monospace;
      font-size: 0.8em;
      color: #7f8c8d;
    }
    .address a {
      color: #7f8c8d;
      text-decoration: none;
    }
    .address a:hover {
      text-decoration: underline;
      color: #3498db;
    }
    .no-data {
      text-align: center;
      color: #7f8c8d;
    }
    .default-profile {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: #7f8c8d;
      border: 2px solid #3498db;
    }
    .profile-link {
      text-decoration: none;
      color: #3498db;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .profile-link:hover {
      text-decoration: underline;
    }
    .arena-link {
      display: inline-block;
      font-size: 0.8em;
      margin-top: 4px;
      color: #7f8c8d;
      text-decoration: none;
      background-color: #f0f0f0;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .arena-link:hover {
      background-color: #e0e0e0;
      color: #333;
    }
    .snowtrace-icon {
      width: 14px;
      height: 14px;
      margin-left: 5px;
      vertical-align: middle;
    }
  </style>
</head>
<body>
  <h1>Mu Community Leaderboard</h1>
  <div class="timestamp">Generated on: ${new Date(timestamp).toLocaleString()}</div>
  
  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Twitter</th>
        <th>Address</th>
        <th>Total Points</th>
        ${tokenColumns.map(token => `<th>${token} Points</th>`).join('')}
        ${nftColumns.map(nft => `<th>${nft} Points</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${entries.map(entry => `
        <tr class="${entry.rank <= 3 ? `rank-${entry.rank} top-3` : ''}">
          <td class="rank">${entry.rank}</td>
          <td class="twitter-handle">
            <a href="https://arena.social/${entry.twitterHandle}" target="_blank" class="profile-link">
              ${entry.profileImageUrl 
                ? `<img src="${entry.profileImageUrl}" alt="@${entry.twitterHandle}" class="profile-image">`
                : `<div class="default-profile">${entry.twitterHandle.charAt(0).toUpperCase()}</div>`
              }
              <div>
                @${entry.twitterHandle}
                <div><a href="https://arena.social/${entry.twitterHandle}" target="_blank" class="arena-link">Arena Profile</a></div>
              </div>
            </a>
          </td>
          <td class="address">
            <a href="https://snowtrace.io/address/${entry.address}" target="_blank" title="View on Snowtrace">
              ${shortenAddress(entry.address)}
            </a>
          </td>
          <td class="total-points">${formatNumber(entry.totalPoints)}</td>
          ${tokenColumns.map(token => `
            <td class="points">${entry.tokenPoints[token] ? formatNumber(entry.tokenPoints[token]) : '-'}</td>
          `).join('')}
          ${nftColumns.map(nft => `
            <td class="points">${entry.nftPoints[nft] ? formatNumber(entry.nftPoints[nft]) : '-'}</td>
          `).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>
  `;
  
  return html;
}

/**
 * Save the leaderboard HTML to a file
 */
export function saveLeaderboardHtml(leaderboard: Leaderboard, outputPath: string): void {
  try {
    // Generate HTML
    const html = generateLeaderboardHtml(leaderboard);
    
    // Ensure the directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save the HTML to a file
    fs.writeFileSync(outputPath, html);
    console.log(`Leaderboard HTML saved to ${outputPath}`);
  } catch (error) {
    console.error('Error saving leaderboard HTML:', error);
    throw error;
  }
}

/**
 * Format a number with commas and no decimal places
 */
function formatNumber(num: number): string {
  return Math.floor(num).toLocaleString();
}

/**
 * Shorten an Ethereum address for display
 */
function shortenAddress(address: string): string {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}
