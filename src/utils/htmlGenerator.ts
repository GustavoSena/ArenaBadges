import * as fs from 'fs';
import * as path from 'path';
import { Leaderboard, LeaderboardEntry } from '../types/leaderboard';

/**
 * Generate HTML for the leaderboard with pagination
 */
export function generateLeaderboardHtml(leaderboard: Leaderboard, config?: any): string {
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
  
  // Calculate pagination info
  const entriesPerPage = 100;
  const totalPages = Math.ceil(entries.length / entriesPerPage);
  
  // Get styling from config
  const title = config?.title || 'Community Leaderboard';
  const logoPath = config?.logoPath || '';
  const titleLink = config?.titleLink || '';
  const primaryColor = config?.primaryColor || '#3498db';
  const secondaryColor = config?.secondaryColor || '#e0e0e0';
  const accentColor = config?.accentColor || '#ff00ff';
  const backgroundColor = config?.backgroundColor || '#f5f5f5';
  const gradientStart = config?.gradientStart || primaryColor;
  const gradientEnd = config?.gradientEnd || accentColor;
  
  // Create CSS variables for colors
  const cssVariables = `
    :root {
      --primary-color: ${primaryColor};
      --secondary-color: ${secondaryColor};
      --accent-color: ${accentColor};
      --background-color: ${backgroundColor};
      --gradient-start: ${gradientStart || primaryColor};
      --gradient-end: ${gradientEnd || accentColor};
      --twitter-color: #553377; /* Medium tone between gradient colors */
      --address-color: #555555;
    }
  `;
  
  // Generate table rows for each page
  const pagesHtml = Array.from({ length: totalPages }).map((_, pageIndex) => {
    const pageEntries = entries.slice(pageIndex * entriesPerPage, (pageIndex + 1) * entriesPerPage);
    
    const tableRows = pageEntries.map(entry => {
      // Format points with commas for thousands
      const formattedPoints = entry.totalPoints.toLocaleString(undefined, { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
      
      // Format token points
      const muPoints = entry.tokenPoints.MU ? entry.tokenPoints.MU.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0';
      const mugPoints = entry.tokenPoints.MUG ? entry.tokenPoints.MUG.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0';
      const muoPoints = entry.tokenPoints.MUO ? entry.tokenPoints.MUO.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0';
      const muvPoints = entry.tokenPoints.MUV ? entry.tokenPoints.MUV.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0';
      
      // Format NFT points
      const muPupsPoints = entry.nftPoints['Mu Pups'] ? entry.nftPoints['Mu Pups'].toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0';
      
      // Twitter handle with link
      const twitterHandle = entry.twitterHandle ? 
        `<a href="https://x.com/${entry.twitterHandle}" target="_blank">@${entry.twitterHandle}</a>` : 
        'Unknown';
      
      // Arena profile link
      const arenaProfile = entry.address ? 
        `<a href="https://www.arenabook.xyz/profile/${entry.address}" target="_blank" class="arena-button">Arena Profile</a>` : 
        '';
      
      // Profile image
      const profileImage = entry.profileImageUrl ? 
        `<img src="${entry.profileImageUrl}" alt="${entry.twitterHandle || 'User'}" class="profile-image">` : 
        '';
      
      return `
        <tr>
          <td class="rank">${entry.rank}</td>
          <td class="twitter-handle">
            ${profileImage}
            <div class="user-info">
              ${twitterHandle}
              <div class="arena-profile-container">${arenaProfile}</div>
            </div>
          </td>
          <td class="address">
            <a href="https://snowtrace.io/address/${entry.address}" target="_blank" title="View on Snowtrace">
              ${shortenAddress(entry.address)}
            </a>
          </td>
          <td class="points">${formattedPoints}</td>
          <td class="points">${muPoints}</td>
          <td class="points">${mugPoints}</td>
          <td class="points">${muoPoints}</td>
          <td class="points">${muvPoints}</td>
          <td class="points">${muPupsPoints}</td>
        </tr>
      `;
    }).join('');
    
    return `
      <div id="page-${pageIndex + 1}" class="leaderboard-page ${pageIndex === 0 ? 'active' : ''}">
        <table class="leaderboard">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Twitter</th>
              <th>Address</th>
              <th>Total Points</th>
              <th>MU Points</th>
              <th>MUG Points</th>
              <th>MUO Points</th>
              <th>MUV Points</th>
              <th>Mu Pups Points</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
  }).join('');
  
  // Create the HTML content
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${new Date(timestamp).toLocaleDateString()}</title>
  <style>
    ${cssVariables}
    
    body {
      font-family: 'Arial', sans-serif;
      margin: 0;
      padding: 20px;
      background-color: var(--background-color);
      color: #333;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .header {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ddd;
    }
    
    .logo {
      height: 50px;
      margin-right: 15px;
    }
    
    .title-container {
      display: flex;
      flex-direction: column;
    }
    
    h1 {
      margin: 0;
      color: #000;
      font-size: 24px;
    }
    
    h1 a {
      text-decoration: none;
      color: #000;
      transition: background-image 0.3s, color 0.3s;
    }
    
    h1 a:hover {
      background-image: linear-gradient(to right, var(--gradient-start), var(--gradient-end));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    
    .timestamp {
      text-align: center;
      margin-bottom: 20px;
      color: #7f8c8d;
      font-size: 0.9em;
    }
    
    .leaderboard {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      background-color: white;
    }
    
    .leaderboard thead tr {
      background-image: linear-gradient(to right, var(--gradient-start), var(--gradient-end));
    }
    
    .leaderboard th {
      color: white;
      padding: 12px;
      text-align: center;
      font-weight: bold;
      background: transparent;
    }
    
    .leaderboard td {
      padding: 10px;
      border-bottom: 1px solid #ddd;
    }
    
    .leaderboard tr:nth-child(even) {
      background-color: var(--secondary-color);
    }
    
    .leaderboard tr:hover {
      background-color: #f1f1f1;
    }
    
    .rank {
      text-align: center;
      font-weight: bold;
    }
    
    .twitter-handle {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .user-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .arena-profile-container {
      margin-top: 2px;
    }
    
    .twitter-handle a {
      color: var(--twitter-color);
      text-decoration: none;
      font-weight: 500;
    }
    
    .twitter-handle a:hover {
      text-decoration: underline;
    }
    
    .profile-image {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      vertical-align: middle;
      margin-right: 10px;
      border: 2px solid var(--primary-color);
    }
    
    .arena-button {
      display: inline-block;
      padding: 4px 10px;
      background-color: rgba(0, 0, 0, 0.05);
      color: var(--accent-color);
      text-decoration: none;
      border-radius: 20px;
      font-size: 0.85em;
      transition: background-color 0.3s;
      margin-left: 10px;
    }
    
    .arena-button:hover {
      background-color: rgba(0, 0, 0, 0.1);
    }
    
    .address {
      font-family: monospace;
      font-size: 0.8em;
      color: var(--address-color);
    }
    
    .address a {
      color: var(--address-color);
      text-decoration: none;
    }
    
    .address a:hover {
      text-decoration: underline;
    }
    
    .points {
      font-weight: bold;
      text-align: center;
    }
    
    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 20px 0;
      gap: 10px;
    }
    
    .pagination button {
      padding: 8px 15px;
      background-image: linear-gradient(to right, var(--gradient-start), var(--gradient-end));
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: opacity 0.3s;
    }
    
    .pagination button:hover {
      opacity: 0.9;
    }
    
    .pagination button:disabled {
      background-image: none;
      background-color: #ccc;
      cursor: not-allowed;
    }
    
    .page-info {
      text-align: center;
      margin: 10px 0;
      color: #7f8c8d;
    }
    
    .page-button {
      padding: 5px 10px;
      margin: 0 2px;
      background-image: linear-gradient(to right, var(--gradient-start), var(--gradient-end));
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: opacity 0.3s;
    }
    
    .page-button:hover {
      opacity: 0.9;
    }
    
    .page-button.active {
      font-weight: bold;
      box-shadow: 0 0 5px rgba(0,0,0,0.3);
    }
    
    .entries-count {
      text-align: center;
      margin-bottom: 20px;
      color: #7f8c8d;
    }
    
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #7f8c8d;
      font-size: 0.9em;
    }
    
    .footer a {
      background-image: linear-gradient(to right, var(--gradient-start), var(--gradient-end));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      text-decoration: none;
      transition: opacity 0.3s;
    }
    
    .footer a:hover {
      opacity: 0.8;
      text-decoration: underline;
    }
    
    .leaderboard-page {
      display: none;
    }
    
    .leaderboard-page.active {
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logoPath ? `<img src="../../public/${logoPath}" alt="${title} Logo" class="logo">` : ''}
      <div class="title-container">
        <h1>${titleLink ? `<a href="${titleLink}" target="_blank">${title}</a>` : title}</h1>
      </div>
    </div>
    
    <div class="timestamp">Last updated at: ${new Date(timestamp).toLocaleString()}</div>
    <div class="entries-count">Total Entries: ${entries.length}</div>
    
    <div class="pagination" id="pagination-top">
      <button id="prev-btn" onclick="previousPage()" disabled>&laquo; Previous</button>
      <div id="page-buttons-top"></div>
      <button id="next-btn" onclick="nextPage()">Next &raquo;</button>
    </div>
    
    <div class="page-info">
      Page <span id="current-page">1</span> of ${totalPages}
    </div>
    
    ${pagesHtml}
    
    <div class="pagination" id="pagination-bottom">
      <button id="prev-btn-bottom" onclick="previousPage()" disabled>&laquo; Previous</button>
      <div id="page-buttons-bottom"></div>
      <button id="next-btn-bottom" onclick="nextPage()">Next &raquo;</button>
    </div>
    
    <div class="footer">
      Made by <a href="https://x.com/FatherSenaX" target="_blank">Father Sena</a>
    </div>
  </div>
  
  <script>
    // Pagination logic
    const itemsPerPage = ${entriesPerPage};
    const totalItems = ${entries.length};
    const totalPages = ${totalPages};
    let currentPage = 1;
    
    // Show the first page on load
    showPage(1);
    
    // Generate page buttons
    generatePageButtons();
    
    function showPage(page) {
      // Hide all pages
      for (let i = 1; i <= totalPages; i++) {
        document.getElementById('page-' + i).style.display = 'none';
      }
      
      // Show the selected page
      document.getElementById('page-' + page).style.display = 'block';
      
      // Update current page
      currentPage = page;
      document.getElementById('current-page').textContent = page;
      
      // Update button states
      updateButtonStates();
      
      // Update active page button
      updateActivePageButton();
      
      // Scroll to top
      window.scrollTo(0, 0);
    }
    
    function previousPage() {
      if (currentPage > 1) {
        showPage(currentPage - 1);
      }
    }
    
    function nextPage() {
      if (currentPage < totalPages) {
        showPage(currentPage + 1);
      }
    }
    
    function updateButtonStates() {
      // Update previous button
      const prevBtn = document.getElementById('prev-btn');
      const prevBtnBottom = document.getElementById('prev-btn-bottom');
      prevBtn.disabled = currentPage === 1;
      prevBtnBottom.disabled = currentPage === 1;
      
      // Update next button
      const nextBtn = document.getElementById('next-btn');
      const nextBtnBottom = document.getElementById('next-btn-bottom');
      nextBtn.disabled = currentPage === totalPages;
      nextBtnBottom.disabled = currentPage === totalPages;
    }
    
    function generatePageButtons() {
      const topContainer = document.getElementById('page-buttons-top');
      const bottomContainer = document.getElementById('page-buttons-bottom');
      
      // Clear existing buttons
      topContainer.innerHTML = '';
      bottomContainer.innerHTML = '';
      
      // Maximum number of buttons to show
      const maxButtons = 5;
      
      // Calculate range of buttons to show
      let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
      let endPage = Math.min(totalPages, startPage + maxButtons - 1);
      
      // Adjust start page if we're at the end
      if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
      }
      
      // Add first page button if needed
      if (startPage > 1) {
        addPageButton(1, topContainer);
        addPageButton(1, bottomContainer);
        
        // Add ellipsis if there's a gap
        if (startPage > 2) {
          addEllipsis(topContainer);
          addEllipsis(bottomContainer);
        }
      }
      
      // Add page buttons
      for (let i = startPage; i <= endPage; i++) {
        addPageButton(i, topContainer);
        addPageButton(i, bottomContainer);
      }
      
      // Add last page button if needed
      if (endPage < totalPages) {
        // Add ellipsis if there's a gap
        if (endPage < totalPages - 1) {
          addEllipsis(topContainer);
          addEllipsis(bottomContainer);
        }
        
        addPageButton(totalPages, topContainer);
        addPageButton(totalPages, bottomContainer);
      }
    }
    
    function addPageButton(page, container) {
      const button = document.createElement('button');
      button.textContent = page;
      button.className = 'page-button';
      button.onclick = function() {
        showPage(page);
      };
      
      if (page === currentPage) {
        button.classList.add('active');
      }
      
      container.appendChild(button);
    }
    
    function addEllipsis(container) {
      const span = document.createElement('span');
      span.textContent = '...';
      span.style.margin = '0 5px';
      container.appendChild(span);
    }
    
    function updateActivePageButton() {
      // Update page buttons
      const buttons = document.querySelectorAll('.page-button');
      buttons.forEach(button => {
        if (parseInt(button.textContent) === currentPage) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
      
      // Regenerate page buttons to handle changing ranges
      generatePageButtons();
    }
  </script>
</body>
</html>`;

  return html;
}

/**
 * Save the leaderboard HTML to a file
 */
export function saveLeaderboardHtml(leaderboard: Leaderboard, outputPath: string, config?: any): void {
  try {
    // Generate HTML
    const html = generateLeaderboardHtml(leaderboard, config);
    
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
