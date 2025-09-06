const fs = require('fs');
const path = require('path');

// Simple test script to verify deletion request functionality
async function testDeletionRequest() {
  console.log('🧪 Testing Deletion Request API...');
  
  try {
    // Test with a real admin session if available
    const response = await fetch('http://localhost:3000/api/deletion-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // This would need a real auth token in practice
      },
      body: JSON.stringify({
        entityType: 'campaign',
        entityId: 'test-campaign-123',
        entityName: 'Test Campaign for Deletion',
        reason: 'End-to-end testing of deletion request functionality'
      })
    });

    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Deletion request created successfully:', data.id);
      return true;
    } else {
      const error = await response.json();
      console.log('❌ Request failed:', error);
      return false;
    }
  } catch (error) {
    console.error('💥 Test error:', error.message);
    return false;
  }
}

// Run the test
testDeletionRequest();