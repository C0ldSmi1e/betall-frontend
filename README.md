# Updated Browser Extension MVP - With Your Design

## Project Structure (same)

```
extension/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── styles.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Updated TODO Tasks

### **Task 1: Create `manifest.json`**

**Requirements:**
```json
{
  "manifest_version": 3,
  "name": "Polymarket Match",
  "version": "1.0.0",
  "description": "Find relevant Polymarket prediction markets for selected text",
  "permissions": [
    "activeTab",
    "storage"
  ],
  "host_permissions": [
    "https://betall.de-mo.app/*",
    "https://gamma-api.polymarket.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["styles.css"]
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

### **Task 2: Implement `content.js` - Text Selection & Icon**

**Requirements:**

1. **Detect text selection:**
   - Listen for `mouseup` event
   - Get selected text via `window.getSelection()`
   - Only trigger if selection is 10+ characters

2. **Show floating icon:**
   - Create a div with a 🎯 emoji or custom icon
   - Position it near the end of selection using `Range.getBoundingClientRect()`
   - Make it clickable
   - Hide when user clicks elsewhere

3. **Send message to background script:**
   - When icon clicked, send message with selected text
   - Use `chrome.runtime.sendMessage()`

**Expected behavior:**
```javascript
// User selects: "Will Bitcoin reach 100k by end of year?"
// Icon appears at the end of selection
// User clicks icon
// Message sent to background: { action: "matchMarkets", text: "..." }
```

**Visual style for icon:**
- Small circular button (32px × 32px)
- Polymarket brand color or gradient
- Smooth fade-in animation
- Hover effect
- z-index: 999999

---

### **Task 3: Implement `background.js` - API Orchestration**

**Requirements:**

1. **Listen for messages from content script**
2. **Step 1: Call your matching API:**
   ```javascript
   const matchUrl = `https://betall.de-mo.app/api/match?query=${encodeURIComponent(text)}`;
   const matchResponse = await fetch(matchUrl);
   const slugs = await matchResponse.json();
   ```

3. **Step 2: For each slug, fetch market details from Polymarket:**
   ```javascript
   const marketUrl = `https://gamma-api.polymarket.com/markets/slug/${slug}`;
   const marketResponse = await fetch(marketUrl);
   const marketData = await marketResponse.json();
   ```

4. **Step 3: Store results and open popup:**
   ```javascript
   chrome.storage.local.set({ markets: marketDataArray });
   chrome.windows.create({
     url: 'popup.html',
     type: 'popup',
     width: 400,
     height: 600
   });
   ```

**Expected data flow:**
```
Selected text → Your API → ["slug1", "slug2", "slug3"]
                    ↓
Parallel fetch to Polymarket API for each slug
                    ↓
Store full market objects in chrome.storage
                    ↓
Open popup window to display results
```

**Error handling:**
- Handle network failures gracefully
- Show "No markets found" if empty results
- Timeout after 10 seconds

---

### **Task 4: Implement `popup.html` - Match Your Design**

**Requirements:**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="loading" class="loading">
    <div class="spinner"></div>
    <p>Finding markets...</p>
  </div>

  <div id="results" class="results" style="display: none;">
    <!-- Markets will be injected here by popup.js -->
  </div>

  <div id="empty" class="empty" style="display: none;">
    <p>No markets found</p>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

**Market card template (to be generated in popup.js):**
```html
<div class="market-card">
  <div class="market-header">
    <div class="polymarket-label">POLYMARKET</div>
    <h2 class="market-title">{question}</h2>
  </div>

  <div class="bet-options">
    <div class="bet-option yes-option">
      <div class="option-info">
        <span class="outcome-label">Yes</span>
        <span class="outcome-percentage">{yesPercentage}%</span>
      </div>
      <div class="payout-info">
        <span class="bet-amount">$10 →</span>
        <span class="payout-amount">${yesPayout}</span>
      </div>
    </div>

    <div class="bet-option no-option">
      <div class="option-info">
        <span class="outcome-label">No</span>
        <span class="outcome-percentage">{noPercentage}%</span>
      </div>
      <div class="payout-info">
        <span class="bet-amount">$10 →</span>
        <span class="payout-amount">${noPayout}</span>
      </div>
    </div>
  </div>

  <a href="https://polymarket.com/event/{slug}" target="_blank" class="place-bet-button">
    Place Bet
    <svg><!-- External link icon --></svg>
  </a>
</div>
```

---

### **Task 5: Implement `popup.js` - With Payout Calculations**

**Requirements:**

1. **Load and display markets** (same as before)

2. **Calculate payouts:**
   ```javascript
   function calculatePayout(price, betAmount = 10) {
     // If betting $10 on Yes at 68% (0.68 price)
     // Payout = $10 / 0.68 = $14.70
     return (betAmount / parseFloat(price)).toFixed(2);
   }
   ```

3. **Format market data:**
   ```javascript
   function formatMarket(data) {
     const yesPrice = parseFloat(data.outcomePrices[0]);
     const noPrice = parseFloat(data.outcomePrices[1]);
     
     return {
       question: data.question,
       slug: data.slug,
       yesPercentage: (yesPrice * 100).toFixed(0),
       noPercentage: (noPrice * 100).toFixed(0),
       yesPayout: calculatePayout(yesPrice, 10),
       noPayout: calculatePayout(noPrice, 10),
       url: `https://polymarket.com/event/${data.slug}`
     };
   }
   ```

4. **Generate HTML for each market:**
   - Create the card structure matching the template
   - Inject into `#results` container
   - Show first market immediately, others below (scrollable)

---

### **Task 6: Implement `styles.css` - Exact Design Match**

**Requirements:**

```css
/* Color Palette */
:root {
  --polymarket-yellow: #F5C842;
  --polymarket-green: #00D395;
  --polymarket-red: #FF5A7A;
  --background-dark: #1A1A1A;
  --card-background: #2A2A2A;
  --text-primary: #FFFFFF;
  --text-secondary: #A0A0A0;
}

/* Popup Window */
body {
  margin: 0;
  padding: 0;
  width: 400px;
  max-height: 600px;
  overflow-y: auto;
  background: var(--background-dark);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--text-primary);
}

/* Market Card */
.market-card {
  background: var(--background-dark);
  border-radius: 16px;
  padding: 24px;
  margin: 16px;
}

/* Header */
.market-header {
  margin-bottom: 24px;
}

.polymarket-label {
  color: var(--polymarket-yellow);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.market-title {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 500;
  margin: 0;
  line-height: 1.4;
}

/* Bet Options */
.bet-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.bet-option {
  background: var(--card-background);
  border-radius: 8px;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-left: 4px solid;
  transition: background 0.2s;
}

.bet-option:hover {
  background: #333;
}

.yes-option {
  border-left-color: var(--polymarket-green);
}

.no-option {
  border-left-color: var(--polymarket-red);
}

.option-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.outcome-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.outcome-percentage {
  font-size: 16px;
  color: var(--text-secondary);
}

.payout-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bet-amount {
  font-size: 14px;
  color: var(--text-secondary);
}

.payout-amount {
  font-size: 18px;
  font-weight: 600;
}

.yes-option .payout-amount {
  color: var(--polymarket-green);
}

.no-option .payout-amount {
  color: var(--polymarket-red);
}

/* Place Bet Button */
.place-bet-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  background: var(--polymarket-yellow);
  color: #000;
  font-size: 16px;
  font-weight: 600;
  padding: 16px;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.2s;
}

.place-bet-button:hover {
  background: #E5B832;
}

.place-bet-button svg {
  width: 16px;
  height: 16px;
}

/* Loading State */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--card-background);
  border-top-color: var(--polymarket-yellow);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty State */
.empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

/* Floating Icon in content.js */
.polymarket-icon {
  position: absolute;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #6B4CE6 0%, #9B51E0 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 999999;
  transition: transform 0.2s, box-shadow 0.2s;
  animation: fadeIn 0.2s;
}

.polymarket-icon:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.polymarket-icon::after {
  content: '🎯';
  font-size: 18px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Scrollbar styling */
body::-webkit-scrollbar {
  width: 8px;
}

body::-webkit-scrollbar-track {
  background: var(--background-dark);
}

body::-webkit-scrollbar-thumb {
  background: var(--card-background);
  border-radius: 4px;
}

body::-webkit-scrollbar-thumb:hover {
  background: #444;
}
```

---

### **Task 7: Create Icons** (UNCHANGED)
Same as before.

---

### **Task 8: Update `README.md`**

Add note about the design matching Polymarket's official UI.

---

## Updated Testing Checklist

After implementation, verify:
- [ ] Dark theme matches your screenshot
- [ ] Yellow "POLYMARKET" label in header
- [ ] Green left border on Yes option
- [ ] Red left border on No option
- [ ] Payout calculations are correct ($10 / price)
- [ ] Yellow "Place Bet" button works
- [ ] Hover effects on bet options
- [ ] Multiple markets stack vertically if >1 result
- [ ] Scrollable if many results

---

## Visual Specs from Your Design

- **Card width**: 400px
- **Card padding**: 24px
- **Border radius**: 16px (card), 8px (buttons/options)
- **Font sizes**: 
  - POLYMARKET label: 11px
  - Title: 18px
  - Outcome label: 16px
  - Payout: 18px
- **Colors**:
  - Yellow: #F5C842
  - Green: #00D395
  - Red: #FF5A7A
  - Dark BG: #1A1A1A