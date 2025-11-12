chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'matchMarkets') {
    try {
      await handleMatchMarkets(message.text);
    } catch (error) {
      console.error('Error matching markets:', error);
      // Store error state
      chrome.storage.local.set({ 
        markets: [], 
        error: 'Failed to fetch markets. Please try again.' 
      });
      // Still open popup to show error
      chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: 400,
        height: 600
      });
    }
  }
});

async function handleMatchMarkets(text) {
  try {
    // Clear previous results
    chrome.storage.local.set({ markets: [], error: null });
    
    // Step 1: Call matching API to get slugs
    const matchUrl = `https://betall.de-mo.app/api/match?query=${encodeURIComponent(text)}`;
    console.log('Calling match API:', matchUrl);
    
    const matchResponse = await fetchWithTimeout(matchUrl, 10000);
    if (!matchResponse.ok) {
      throw new Error(`Match API returned ${matchResponse.status}`);
    }
    
    const slugs = await matchResponse.json();
    console.log('Got slugs:', slugs);
    
    if (!Array.isArray(slugs) || slugs.length === 0) {
      // No markets found
      chrome.storage.local.set({ markets: [], error: null });
      chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: 400,
        height: 600
      });
      return;
    }
    
    // Step 2: Fetch market details for each slug in parallel
    const marketPromises = slugs.map(async (slug) => {
      try {
        const marketUrl = `https://gamma-api.polymarket.com/markets/slug/${slug}`;
        console.log('Fetching market:', marketUrl);
        
        const marketResponse = await fetchWithTimeout(marketUrl, 10000);
        if (!marketResponse.ok) {
          console.warn(`Failed to fetch market ${slug}: ${marketResponse.status}`);
          return null;
        }
        
        const marketData = await marketResponse.json();
        console.log('Got market data for', slug, ':', marketData);
        return marketData;
      } catch (error) {
        console.warn(`Error fetching market ${slug}:`, error);
        return null;
      }
    });
    
    const marketResults = await Promise.all(marketPromises);
    const validMarkets = marketResults.filter(market => market !== null);
    
    console.log('Valid markets:', validMarkets);
    
    // Step 3: Store results and open popup
    chrome.storage.local.set({ markets: validMarkets, error: null });
    
    chrome.windows.create({
      url: 'popup.html',
      type: 'popup',
      width: 400,
      height: 600
    });
    
  } catch (error) {
    console.error('Error in handleMatchMarkets:', error);
    throw error;
  }
}

async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}