// Test API Authentication Helper
// This script helps test authenticated API endpoints by extracting session tokens

const testApiAuth = {
  // Extract session token from browser storage
  getSessionToken: () => {
    const supabaseSession = localStorage.getItem('sb-' + window.location.hostname.replace(/\./g, '-') + '-auth-token');
    if (supabaseSession) {
      try {
        const session = JSON.parse(supabaseSession);
        return session.access_token;
      } catch (e) {
        console.error('Failed to parse session token:', e);
      }
    }
    return null;
  },

  // Test API endpoint with authentication
  testEndpoint: async (url, options = {}) => {
    const token = testApiAuth.getSessionToken();
    if (!token) {
      console.error('No authentication token found. Please log in first.');
      return null;
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      console.log(`${options.method || 'GET'} ${url}:`, response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Response:', data);
        return data;
      } else {
        const error = await response.text();
        console.error('Error:', error);
        return null;
      }
    } catch (error) {
      console.error('Request failed:', error);
      return null;
    }
  },

  // Test transaction endpoints
  testTransactions: async () => {
    console.log('Testing Transaction APIs...');
    
    // Test GET current transactions
    await testApiAuth.testEndpoint('/api/transactions/current?limit=5');
    
    // Test POST create transaction
    await testApiAuth.testEndpoint('/api/transactions/create', {
      method: 'POST',
      body: JSON.stringify({
        merchant: 'Test Store API',
        amount: 29.99,
        category: 'Shopping',
        description: 'API Test Transaction',
        date: new Date().toISOString().split('T')[0]
      })
    });
  }
};

// Make it available globally
window.testApiAuth = testApiAuth;

console.log('Test API Auth helper loaded. Available methods:');
console.log('- testApiAuth.getSessionToken() - Get current session token');
console.log('- testApiAuth.testEndpoint(url, options) - Test any API endpoint');
console.log('- testApiAuth.testTransactions() - Test transaction APIs');