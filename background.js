chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'matchMarkets') {
    handleMatchMarkets(message.text, sender.tab.id);
    return true; // Keep the message channel open for async response
  }
});

async function handleMatchMarkets(text, tabId) {
  try {
    // Step 1: Call matching API to get slugs
    // const matchUrl = `https://betall.de-mo.app/api/match?query=${encodeURIComponent(text)}`;
    const matchUrl = `http://localhost:8000/api/match?query=${encodeURIComponent(text)}`;
    
    const matchResponse = await fetch(matchUrl);
    if (!matchResponse.ok) {
      throw new Error(`Match API returned ${matchResponse.status}`);
    }
    
    const response = await matchResponse.json();
    
    // Handle API response format: { error, data: { slugs: [...] } }
    if (response.error) {
      throw new Error(`Match API error: ${response.error}`);
    }
    
    // slugs: { slug: string, similarity: number }[]
    // filter slugs by similarity > 0.5
    const slugs = response.data?.slugs?.filter(slug => slug.similarity > 0.5) || [];
    
    if (!Array.isArray(slugs) || slugs.length === 0) {
      chrome.tabs.sendMessage(tabId, { action: 'showEmpty' });
      return;
    }

    // Step 2: Fetch market details for the first slug
    const randomSlug = slugs[Math.floor(Math.random() * slugs.length)];
    const marketUrl = `https://gamma-api.polymarket.com/markets/slug/${randomSlug.slug}`;
    
    const marketResponse = await fetch(marketUrl);
    if (!marketResponse.ok) {
      throw new Error(`Failed to fetch market ${randomSlug.slug}: ${marketResponse.status}`);
    }
    
    const marketData = await marketResponse.json();
    
    // Format and send market data
    const formattedMarket = formatMarket(marketData);
    chrome.tabs.sendMessage(tabId, {
      action: 'showMarket',
      market: formattedMarket
    });
    
  } catch (error) {
    console.error('Error in background script:', error);
    chrome.tabs.sendMessage(tabId, {
      action: 'showError',
      error: 'Failed to fetch markets. Please try again.'
    });
  }
}

function calculatePayout(price, betAmount = 10) {
  return (betAmount / parseFloat(price)).toFixed(2);
}

function formatMarket(data) {
  // Parse outcomePrices - they come as JSON string array
  let outcomePrices = [];
  try {
    if (typeof data.outcomePrices === 'string') {
      outcomePrices = JSON.parse(data.outcomePrices);
    } else if (Array.isArray(data.outcomePrices)) {
      outcomePrices = data.outcomePrices;
    }
  } catch (e) {
    console.error('Error parsing outcomePrices:', e);
    outcomePrices = ['0.5', '0.5']; // fallback
  }
  
  // Convert string prices to numbers
  const yesPrice = parseFloat(outcomePrices[0] || '0.5');
  const noPrice = parseFloat(outcomePrices[1] || '0.5');
  
  return {
    question: data.question || 'Unknown Market',
    slug: data.slug || '',
    yesPercentage: (yesPrice * 100).toFixed(0),
    noPercentage: (noPrice * 100).toFixed(0),
    yesPayout: calculatePayout(yesPrice, 10),
    noPayout: calculatePayout(noPrice, 10),
    url: `https://polymarket.com/event/${data.slug || ''}`
  };
}