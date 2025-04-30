import axios from 'axios';
import * as dotenv from 'dotenv';
import { formatTokenBalance } from '../src/utils/helpers';

// Load environment variables
dotenv.config();

/**
 * Test to verify if Snowtrace API returns holders sorted by balance
 */
async function testSnowtraceSorting() {
  try {
    // MU token address
    const tokenAddress = '0xD036414fa2BCBb802691491E323BFf1348C5F4Ba';
    const tokenSymbol = 'MU';
    const tokenDecimals = 18;
    
    console.log('Testing if Snowtrace API returns holders sorted by balance...');
    console.log(`Using ${tokenSymbol} token (${tokenAddress}) for test`);
    
    // Fetch multiple pages to verify cross-page sorting
    const pageSize = 100;
    const pagesToFetch = 2;
    const allHolders: Array<{ address: string, balance: string, balanceFormatted: number, page: number, indexInPage: number }> = [];
    
    for (let page = 1; page <= pagesToFetch; page++) {
      console.log(`\nFetching page ${page} of token holders...`);
      
      // Construct the Snowtrace API URL
      const apiUrl = `https://api.snowtrace.io/api?module=token&action=tokenholderlist&contractaddress=${tokenAddress}&page=${page}&offset=${pageSize}`;

      const response = await axios.get(apiUrl);
      
      if (response.data.status === '1' && response.data.result && response.data.result.length > 0) {
        const holdersData = response.data.result;
        let skippedZeroBalances = 0;
        
        // Process each holder
        for (let i = 0; i < holdersData.length; i++) {
          const holderData = holdersData[i];
          const address = holderData.TokenHolderAddress;
          const balance = holderData.TokenHolderQuantity;
          const balanceFormatted = formatTokenBalance(balance, tokenDecimals);
          
          // Skip holders with 0 balance (API errors)
          if (balanceFormatted === 0) {
            skippedZeroBalances++;
            continue;
          }
          
          allHolders.push({
            address,
            balance,
            balanceFormatted,
            page,
            indexInPage: i
          });
        }
        
        console.log(`Added ${holdersData.length - skippedZeroBalances} holders from page ${page} (skipped ${skippedZeroBalances} holders with 0 balance)`);
      } else {
        console.log(`No more holders found on page ${page}`);
        break;
      }
      
      // Add delay between pages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Print all holders in the order they came from the API
    console.log('\n=== ALL HOLDERS IN ORIGINAL ORDER ===');
    allHolders.forEach((holder, index) => {
      console.log(`${index + 1}. [Page ${holder.page}, Index ${holder.indexInPage}] Address: ${holder.address}, Balance: ${holder.balanceFormatted}`);
    });
    
    // Check if the list is sorted by balance (descending)
    let isSorted = true;
    let previousBalance = Infinity;
    const sortingIssues: Array<{ index: number, current: number, previous: number }> = [];
    
    allHolders.forEach((holder, index) => {
      if (holder.balanceFormatted > previousBalance) {
        isSorted = false;
        sortingIssues.push({
          index,
          current: holder.balanceFormatted,
          previous: previousBalance
        });
      }
      previousBalance = holder.balanceFormatted;
    });
    
    // Print results
    console.log(`\nTotal holders fetched: ${allHolders.length}`);
    console.log(`Is the list sorted by balance (descending)? ${isSorted ? 'YES' : 'NO'}`);
    
    if (!isSorted) {
      console.log('\n=== SORTING ISSUES ===');
      sortingIssues.forEach(issue => {
        const currentHolder = allHolders[issue.index];
        const previousHolder = allHolders[issue.index - 1];
        console.log(`Issue at index ${issue.index}:`);
        console.log(`  Current: [Page ${currentHolder.page}, Index ${currentHolder.indexInPage}] Address: ${currentHolder.address}, Balance: ${currentHolder.balanceFormatted}`);
        console.log(`  Previous: [Page ${previousHolder.page}, Index ${previousHolder.indexInPage}] Address: ${previousHolder.address}, Balance: ${previousHolder.balanceFormatted}`);
      });
    }
    
    // Verify page boundary
    if (allHolders.length > pageSize) {
      console.log('\n=== PAGE BOUNDARY CHECK ===');
      const lastHolderPage1 = allHolders.find(h => h.page === 1 && h.indexInPage === pageSize - 1);
      const firstHolderPage2 = allHolders.find(h => h.page === 2 && h.indexInPage === 0);
      
      if (lastHolderPage1 && firstHolderPage2) {
        console.log(`Last holder on page 1: Address: ${lastHolderPage1.address}, Balance: ${lastHolderPage1.balanceFormatted}`);
        console.log(`First holder on page 2: Address: ${firstHolderPage2.address}, Balance: ${firstHolderPage2.balanceFormatted}`);
        
        if (lastHolderPage1.balanceFormatted >= firstHolderPage2.balanceFormatted) {
          console.log('✅ Page boundary is correctly sorted');
        } else {
          console.log('❌ Page boundary is NOT correctly sorted');
        }
      } else {
        console.log('Could not find exact page boundary holders');
      }
    } else {
      console.log('\nNot enough holders to check page boundary (need more than 100 holders)');
    }
    
    return isSorted;
  } catch (error) {
    console.error('Error testing Snowtrace API sorting:', error);
    return false;
  }
}

// Run the test
testSnowtraceSorting()
  .then(result => {
    console.log(`\nTest completed. Snowtrace API ${result ? 'DOES' : 'DOES NOT'} return holders sorted by balance.`);
    process.exit(result ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
  });
