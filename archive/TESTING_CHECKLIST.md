# Trading Caller - Testing Checklist ✅

## Critical Features Testing

### 🚨 Stablecoin Protection
- [ ] Test signal generation with USDT - should reject
- [ ] Test signal generation with USDC - should reject
- [ ] Test signal generation with DAI - should reject
- [ ] Verify console warnings appear
- [ ] Verify NO SHORT signals generated for stablecoins
- [ ] Test all stablecoins in the list

**Test Cases:**
```javascript
// Should all return null and log warnings
generateSignal({ token: { symbol: 'USDT' }, ... })
generateSignal({ token: { symbol: 'USDC' }, ... })
generateSignal({ token: { symbol: 'DAI' }, ... })
```

**Expected Result:** ✅ No signals generated, warnings logged

---

### 🔥 Oversold Scanner

#### Multi-Timeframe Functionality
- [ ] Switch to 1H timeframe - data updates
- [ ] Switch to 4H timeframe - data updates
- [ ] Switch to 1D timeframe - data updates
- [ ] Verify RSI values change per timeframe
- [ ] Check cache invalidation on timeframe change

#### Search Functionality
- [ ] Search for "SOL" - filters correctly
- [ ] Search for "BONK" - shows only BONK
- [ ] Search with partial match "BO" - shows BON K, etc.
- [ ] Clear search - shows all tokens
- [ ] Verify debouncing (300ms delay)

#### Filtering
- [ ] Filter "All Tokens" - shows everything
- [ ] Filter "Extreme Only" - only RSI < 20
- [ ] Filter "Strong Only" - only RSI < 30
- [ ] Filter "Moderate" - RSI 30-40
- [ ] Verify filters work with search

#### Export
- [ ] Click export button
- [ ] CSV file downloads
- [ ] Filename has date stamp
- [ ] CSV contains all columns
- [ ] Data is accurate
- [ ] Opens in Excel correctly

#### UI Elements
- [ ] Token cards display correctly
- [ ] Color coding matches severity
- [ ] Click on card opens DEXScreener
- [ ] Hover effects work
- [ ] Loading states appear
- [ ] Error states show helpful messages
- [ ] Empty states are clear

---

### 💼 Positions Dashboard

#### Open Positions Tab
- [ ] Shows active positions
- [ ] P&L updates in real-time
- [ ] Colors: green for profit, red for loss
- [ ] Entry vs current price shown
- [ ] Targets displayed
- [ ] Stop loss visible
- [ ] Time in position accurate
- [ ] Empty state if no positions

#### Closed Positions Tab
- [ ] Shows completed trades
- [ ] Table displays all columns
- [ ] Entry/exit prices accurate
- [ ] P&L calculations correct
- [ ] Time in position shown
- [ ] Win/loss indicators work
- [ ] Table is sortable (if implemented)
- [ ] Empty state if no closed positions

#### Pending Entry Tab
- [ ] Shows signals waiting entry
- [ ] Entry target vs current shown
- [ ] Confidence score displayed
- [ ] Risk level shown
- [ ] Empty state if none pending

#### Stats Overview
- [ ] Total P&L calculates correctly
- [ ] ROI percentage accurate
- [ ] Win rate matches actual
- [ ] W/L count is correct
- [ ] Open positions count accurate
- [ ] Best trade shows highest %
- [ ] Worst trade shows lowest %

---

### ⌨️ Keyboard Shortcuts

#### Navigation
- [ ] Press 1 → Signals section
- [ ] Press 2 → History section
- [ ] Press 3 → Volume section
- [ ] Press 4 → RSI section
- [ ] Press 5 → Oversold section
- [ ] Press 6 → Positions section
- [ ] Press 7 → Funding section
- [ ] Press 8 → Unlocks section
- [ ] Press 9 → Leaderboard section

#### Actions
- [ ] Press R → Refreshes current section
- [ ] Press / → Focuses search input
- [ ] Press E → Exports data (when available)
- [ ] Press ? → Opens help modal
- [ ] Press ESC → Closes modals/clears search

#### Context Awareness
- [ ] Shortcuts ignored when typing in input
- [ ] ESC blurs input fields
- [ ] ? works from any section

---

### 📢 Toast Notifications
- [ ] Info toast appears and auto-dismisses
- [ ] Success toast (green border)
- [ ] Warning toast (orange border)
- [ ] Error toast (red border)
- [ ] Smooth fade-in animation
- [ ] Auto-dismiss after 3 seconds
- [ ] Only one toast at a time

---

### ⚡ Caching System

#### Cache Hits
- [ ] First load fetches from API
- [ ] Second load uses cache
- [ ] Console shows "Cache HIT"
- [ ] Faster load time on cached data

#### Cache Expiry
- [ ] Wait for TTL to expire
- [ ] Next load fetches fresh data
- [ ] Console shows "Cache MISS"

#### Cache Invalidation
- [ ] Manual refresh clears cache
- [ ] Timeframe change invalidates
- [ ] Filter change doesn't invalidate

#### Fallback
- [ ] Disconnect network
- [ ] Stale cache is used
- [ ] Error shows but data still displays

---

## Browser Compatibility

### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Browsers
- [ ] Chrome Mobile
- [ ] Safari iOS
- [ ] Firefox Mobile

---

## Responsive Design

### Desktop (1920x1080)
- [ ] All sections display correctly
- [ ] No horizontal scroll
- [ ] Grids use full width
- [ ] Cards are properly sized

### Laptop (1366x768)
- [ ] Layout adjusts correctly
- [ ] No elements cut off
- [ ] Readable font sizes

### Tablet (768x1024)
- [ ] Cards stack appropriately
- [ ] Nav becomes mobile menu
- [ ] Touch targets are large enough
- [ ] Modals are properly sized

### Mobile (375x667)
- [ ] Single column layout
- [ ] Mobile nav works
- [ ] Cards are full width
- [ ] Text is readable
- [ ] No tiny touch targets

---

## Performance

### Load Times
- [ ] Initial load < 2 seconds
- [ ] Cached loads < 500ms
- [ ] Section switches instant
- [ ] Search results < 100ms

### API Calls
- [ ] Cache reduces calls by ~70%
- [ ] No unnecessary duplicate calls
- [ ] Debouncing prevents spam
- [ ] Proper error retry logic

### Memory
- [ ] No memory leaks on navigation
- [ ] Cache cleanup runs
- [ ] Old data gets removed

---

## Error Handling

### Network Errors
- [ ] Offline: Shows error message
- [ ] Offline: Uses stale cache
- [ ] 500 error: Shows error state
- [ ] 404 error: Shows helpful message
- [ ] Timeout: Retries or shows error

### Data Errors
- [ ] Invalid data: Graceful fallback
- [ ] Missing fields: Defaults applied
- [ ] Empty results: Empty state shown
- [ ] Malformed JSON: Error caught

---

## Accessibility

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Enter activates buttons
- [ ] Space toggles checkboxes
- [ ] ESC closes modals
- [ ] Arrow keys in dropdowns

### Screen Readers
- [ ] Headings are properly nested
- [ ] Alt text on important images
- [ ] ARIA labels where needed
- [ ] Focus indicators visible

### Visual
- [ ] Color contrast meets WCAG AA
- [ ] Text is readable at 200% zoom
- [ ] No color-only information
- [ ] Focus states are clear

---

## Edge Cases

### Data Edge Cases
- [ ] Empty API response
- [ ] Single item in list
- [ ] Very long token names
- [ ] Extreme RSI values (0, 100)
- [ ] Negative prices (shouldn't happen)
- [ ] Very large/small numbers

### UI Edge Cases
- [ ] Long search terms
- [ ] Special characters in search
- [ ] Rapid filter switching
- [ ] Spam clicking buttons
- [ ] Window resize while loading

---

## Integration Testing

### Signal → Position Flow
- [ ] Generate signal
- [ ] Track in performance system
- [ ] Show in Positions Dashboard
- [ ] Update stats correctly
- [ ] Close position
- [ ] Move to closed tab
- [ ] Stats recalculate

### Oversold → DEXScreener
- [ ] Click token card
- [ ] Opens DEXScreener in new tab
- [ ] Correct token address
- [ ] Chart loads

---

## Security

### Input Sanitization
- [ ] Search input is sanitized
- [ ] No XSS in token names
- [ ] No injection in filters
- [ ] URLs are validated

### API Security
- [ ] No sensitive data in logs
- [ ] API keys not exposed
- [ ] CORS properly configured

---

## Regression Testing

After each deployment:
- [ ] All keyboard shortcuts still work
- [ ] Caching still functions
- [ ] Positions data still accurate
- [ ] Oversold scanner still updates
- [ ] Export still works
- [ ] Mobile still responsive

---

## Manual Testing Scenarios

### Scenario 1: New User
1. Land on site
2. See Signals section
3. Press 5 to go to Oversold
4. Search for "SOL"
5. Click card to see chart
6. Press E to export
7. Check CSV in Excel
**Expected:** Smooth, intuitive flow

### Scenario 2: Power User
1. Press 6 for Positions
2. Review P&L
3. Press R to refresh
4. Press / to search
5. Press ? for help
6. Use keyboard to navigate
**Expected:** Fast, efficient workflow

### Scenario 3: Mobile User
1. Open on phone
2. Tap mobile menu
3. Go to Oversold
4. Search for token
5. Tap card to view chart
6. Return and export
**Expected:** Touch-friendly, no issues

---

## Performance Benchmarks

### Target Metrics
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 2.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] First Input Delay < 100ms

### Cache Performance
- [ ] Cache hit rate > 60%
- [ ] Cached load < 500ms
- [ ] API reduction > 60%

---

## Final Checks Before Deploy

- [ ] All critical features work
- [ ] No console errors
- [ ] No broken links
- [ ] All images load
- [ ] Favicon present
- [ ] Meta tags correct
- [ ] Mobile responsive
- [ ] Fast load times
- [ ] Error handling works
- [ ] Help modal accurate
- [ ] Keyboard shortcuts listed
- [ ] Export functional
- [ ] Caching active
- [ ] Stablecoin protection on
- [ ] README.md up to date

---

## Known Issues
(Document any known issues here)

---

## Test Results Summary

**Date Tested:** ___________  
**Tester:** ___________  
**Browser:** ___________  
**Device:** ___________  

**Pass Rate:** _____%  
**Critical Failures:** ____  
**Minor Issues:** ____  

**Ready for Production:** [ ] YES [ ] NO

---

**Notes:**
