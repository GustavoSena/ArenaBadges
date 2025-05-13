import { describe, expect, test } from '@jest/globals';

// Create a simplified version of the filtering function to test
function filterBasicHandles(basicHandles: string[], upgradedHandles: string[], permanentAccounts: string[], excludeBasicForUpgraded: boolean): string[] {
  let filteredBasicHandles = basicHandles;
  
  if (excludeBasicForUpgraded) {
    // Create a set of upgraded handles for faster lookups
    const upgradedHandlesSet = new Set(upgradedHandles);
    // Create a set of permanent accounts for faster lookups
    const permanentAccountsSet = new Set(permanentAccounts.map(handle => handle.toLowerCase()));
    
    // Filter out basic handles that are also in upgraded handles, but keep permanent accounts
    filteredBasicHandles = basicHandles.filter(handle => 
      !upgradedHandlesSet.has(handle) || permanentAccountsSet.has(handle.toLowerCase())
    );
  }
  
  // Add permanent accounts to the list
  return [...new Set([...filteredBasicHandles, ...permanentAccounts])];
}

describe('Badge Holder Utilities', () => {
  test('should preserve permanent accounts when excludeBasicForUpgraded is true', () => {
    // Setup
    const basicHandles = ['user1', 'user2', 'user3', 'permanentUser'];
    const upgradedHandles = ['user1', 'user4', 'permanentUser'];
    const permanentAccounts = ['permanentUser', 'otherPermanentUser'];
    const excludeBasicForUpgraded = true;
    
    // Execute
    const result = filterBasicHandles(basicHandles, upgradedHandles, permanentAccounts, excludeBasicForUpgraded);
    
    // Verify
    expect(result).toContain('user2');
    expect(result).toContain('user3');
    expect(result).toContain('permanentUser');
    expect(result).toContain('otherPermanentUser');
    expect(result).not.toContain('user1'); // Should be excluded as it's in upgraded list
    expect(result).not.toContain('user4'); // Was never in basic list
    expect(result.length).toBe(4); // user2, user3, permanentUser, otherPermanentUser
  });
  
  test('should allow addresses in both lists when excludeBasicForUpgraded is false', () => {
    // Setup
    const basicHandles = ['user1', 'user2', 'user3', 'permanentUser'];
    const upgradedHandles = ['user1', 'user4', 'permanentUser'];
    const permanentAccounts = ['permanentUser', 'otherPermanentUser'];
    const excludeBasicForUpgraded = false;
    
    // Execute
    const result = filterBasicHandles(basicHandles, upgradedHandles, permanentAccounts, excludeBasicForUpgraded);
    
    // Verify
    expect(result).toContain('user1'); // Should be included as excludeBasicForUpgraded is false
    expect(result).toContain('user2');
    expect(result).toContain('user3');
    expect(result).toContain('permanentUser');
    expect(result).toContain('otherPermanentUser');
    expect(result).not.toContain('user4'); // Was never in basic list
    expect(result.length).toBe(5); // user1, user2, user3, permanentUser, otherPermanentUser
  });
  
  test('should handle case insensitivity for permanent accounts', () => {
    // Setup
    const basicHandles = ['user1', 'user2', 'PermanentUser'];
    const upgradedHandles = ['user1', 'user4', 'PERMANENTUSER'];
    const permanentAccounts = ['permanentUser', 'otherPermanentUser'];
    const excludeBasicForUpgraded = true;
    
    // Execute
    const result = filterBasicHandles(basicHandles, upgradedHandles, permanentAccounts, excludeBasicForUpgraded);
    
    // Verify
    expect(result).toContain('user2');
    expect(result).toContain('PermanentUser'); // Original case preserved
    expect(result).toContain('permanentUser'); // From permanent accounts
    expect(result).toContain('otherPermanentUser');
    expect(result).not.toContain('user1'); // Should be excluded as it's in upgraded list
    expect(result.length).toBe(4); // user2, PermanentUser, permanentUser, otherPermanentUser
  });
  
  test('should handle empty inputs gracefully', () => {
    // Setup - empty basic handles
    let result = filterBasicHandles([], ['user1'], ['permanent'], true);
    expect(result).toEqual(['permanent']);
    
    // Setup - empty upgraded handles
    result = filterBasicHandles(['user1', 'user2'], [], ['permanent'], true);
    expect(result).toContain('user1');
    expect(result).toContain('user2');
    expect(result).toContain('permanent');
    expect(result.length).toBe(3);
    
    // Setup - empty permanent accounts
    result = filterBasicHandles(['user1', 'user2'], ['user1'], [], true);
    expect(result).toContain('user2');
    expect(result).not.toContain('user1');
    expect(result.length).toBe(1);
    
    // Setup - all empty
    result = filterBasicHandles([], [], [], true);
    expect(result).toEqual([]);
  });
});
