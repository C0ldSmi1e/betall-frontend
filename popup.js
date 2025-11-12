document.addEventListener('DOMContentLoaded', async function() {
  const loadingDiv = document.getElementById('loading');
  const resultsDiv = document.getElementById('results');
  const emptyDiv = document.getElementById('empty');
  
  try {
    // Get stored markets data
    const data = await chrome.storage.local.get(['markets', 'error']);
    
    if (data.error) {
      showError(data.error);
      return;
    }
    
    const markets = data.markets || [];
    
    if (markets.length === 0) {
      showEmpty();
    } else {
      showMarkets(markets);
    }
  } catch (error) {
    console.error('Error loading popup:', error);
    showError('Failed to load markets');
  }
});

function showError(message) {
  const loadingDiv = document.getElementById('loading');
  const resultsDiv = document.getElementById('results');
  const emptyDiv = document.getElementById('empty');
  
  loadingDiv.style.display = 'none';
  resultsDiv.style.display = 'none';
  emptyDiv.style.display = 'block';
  emptyDiv.innerHTML = `<p>${message}</p>`;
}

function showEmpty() {
  const loadingDiv = document.getElementById('loading');
  const resultsDiv = document.getElementById('results');
  const emptyDiv = document.getElementById('empty');
  
  loadingDiv.style.display = 'none';
  resultsDiv.style.display = 'none';
  emptyDiv.style.display = 'block';
}

function showMarkets(markets) {
  const loadingDiv = document.getElementById('loading');
  const resultsDiv = document.getElementById('results');
  const emptyDiv = document.getElementById('empty');
  
  loadingDiv.style.display = 'none';
  emptyDiv.style.display = 'none';
  resultsDiv.style.display = 'block';
  
  // Generate HTML for each market
  const marketsHTML = markets.map(market => generateMarketHTML(formatMarket(market))).join('');
  resultsDiv.innerHTML = marketsHTML;
}

function calculatePayout(price, betAmount = 10) {
  // If betting $10 on Yes at 68% (0.68 price)
  // Payout = $10 / 0.68 = $14.70
  return (betAmount / parseFloat(price)).toFixed(2);
}

function formatMarket(data) {
  // Handle different possible data structures from Polymarket API
  const yesPrice = parseFloat(data.outcomePrices?.[0] || data.outcomes?.[0]?.price || 0.5);
  const noPrice = parseFloat(data.outcomePrices?.[1] || data.outcomes?.[1]?.price || 0.5);
  
  return {
    question: data.question || data.title || 'Unknown Market',
    slug: data.slug || data.id || '',
    yesPercentage: (yesPrice * 100).toFixed(0),
    noPercentage: (noPrice * 100).toFixed(0),
    yesPayout: calculatePayout(yesPrice, 10),
    noPayout: calculatePayout(noPrice, 10),
    url: `https://polymarket.com/event/${data.slug || data.id || ''}`
  };
}

function generateMarketHTML(market) {
  return `
    <div class="market-card">
      <div class="market-header">
        <div class="polymarket-label">POLYMARKET</div>
        <h2 class="market-title">${escapeHtml(market.question)}</h2>
      </div>

      <div class="bet-options">
        <div class="bet-option yes-option">
          <div class="option-info">
            <span class="outcome-label">Yes</span>
            <span class="outcome-percentage">${market.yesPercentage}%</span>
          </div>
          <div class="payout-info">
            <span class="bet-amount">$10 →</span>
            <span class="payout-amount">$${market.yesPayout}</span>
          </div>
        </div>

        <div class="bet-option no-option">
          <div class="option-info">
            <span class="outcome-label">No</span>
            <span class="outcome-percentage">${market.noPercentage}%</span>
          </div>
          <div class="payout-info">
            <span class="bet-amount">$10 →</span>
            <span class="payout-amount">$${market.noPayout}</span>
          </div>
        </div>
      </div>

      <a href="${escapeHtml(market.url)}" target="_blank" class="place-bet-button">
        Place Bet
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
    </div>
  `;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}