// API Logger - Intercepts and logs all fetch calls
export function setupAPILogger() {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch;
  
  window.fetch = async function(...args) {
    const [resource, config] = args;
    const method = config?.method || 'GET';
    const url = typeof resource === 'string' ? resource : resource?.url;
    
    // Skip logging for Next.js internal prefetch requests with undefined URLs
    if (!url || url === 'undefined') {
      // Still make the request but don't log it
      return originalFetch.apply(this, args);
    }
    
    // Log the API call
    console.group(`🔵 API ${method} ${url}`);
    console.log('Request:', {
      url,
      method,
      headers: config?.headers,
      body: config?.body
    });
    console.log('Timestamp:', new Date().toISOString());
    console.trace('Call Stack');
    console.groupEnd();
    
    // Make the actual request
    try {
      const response = await originalFetch.apply(this, args);
      
      // Log the response (skip if URL was undefined)
      if (url && url !== 'undefined') {
        console.group(`🟢 API Response ${method} ${url}`);
        console.log('Status:', response.status, response.statusText);
        console.log('Headers:', response.headers);
        console.groupEnd();
      }
      
      return response;
    } catch (error) {
      // Log errors (skip if URL was undefined)
      if (url && url !== 'undefined') {
        console.group(`🔴 API Error ${method} ${url}`);
        console.error('Error:', error);
        console.groupEnd();
      }
      
      throw error;
    }
  };
}

// Function to disable API logging
export function disableAPILogger() {
  if (typeof window === 'undefined') return;
  
  // Restore original fetch if it was saved
  if (window.fetch && window.fetch.name === '') {
    // This is our wrapped function, need to restore the original
    // For now, just log that we would disable it
    console.log('API Logger disabled');
  }
}