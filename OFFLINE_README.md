# Vet Nexus - Offline Functionality

## Overview
Vet Nexus now supports **full offline functionality**, allowing you to use the app without internet connectivity. All changes are automatically synced when you reconnect.

## Features

### ✅ Works Offline
- **POS Sales**: Record sales and generate receipts/invoices
- **Client Management**: Add new clients
- **Patient Management**: Register new patients
- **Inventory**: View and update stock levels
- **Data Access**: View all cached data instantly

### 🔄 Automatic Sync
- Changes are queued locally when offline
- Automatic sync when internet connection is restored
- Manual sync button available
- Retry logic with exponential backoff

### 📊 Sync Status Indicator
- Real-time connection status (online/offline)
- Pending operations count
- Sync progress indicator
- Error notifications with details

## How It Works

### Data Storage
- **IndexedDB**: All data is cached locally in your browser
- **Persistent**: Data survives browser restarts
- **Secure**: Isolated per-origin, encrypted at rest on modern devices

### Sync Queue
- Operations are queued with priority (sales = highest)
- FIFO processing when online
- Automatic retry on failure (up to 5 attempts)
- Conflict resolution: last-write-wins for most entities

### Offline Indicators
Look for the status indicator in the top-right corner:
- 🟡 **Amber**: Offline mode (changes pending)
- 🔵 **Blue**: Syncing in progress
- 🔴 **Red**: Sync errors detected
- 🟢 **Green**: All synced successfully

## Usage

### Making Sales Offline
1. Add items to cart as normal
2. Select customer (or walk-in)
3. Click "Pay & Receipt" or "Issue Invoice"
4. Success message shows "(Will sync when online)" if offline
5. Receipt/invoice is generated immediately
6. Transaction syncs automatically when online

### Adding Clients/Patients Offline
1. Navigate to Clients or Patients
2. Click "Add New"
3. Fill in details
4. Save - item is created with temporary ID
5. Syncs to server when online, real ID assigned

### Viewing Sync Status
1. Click the status indicator in top-right
2. View pending operations count
3. See any sync errors
4. Click "Force Sync Now" to manually trigger sync

## Technical Details

### Storage Limits
- **Typical**: 50MB - 1GB depending on browser
- **Recommended**: Keep last 6 months of data offline
- **Monitoring**: Storage quota warnings implemented

### Temporary IDs
- Offline-created items get temporary IDs (e.g., `temp-1234567890-abc`)
- Replaced with server IDs after successful sync
- UI handles both temporary and real IDs seamlessly

### Conflict Resolution
- **Inventory quantities**: Server wins (prevents overselling)
- **Client/Patient data**: Last write wins
- **Sales**: No conflicts (append-only)

## Troubleshooting

### Sync Stuck?
1. Check internet connection
2. Click status indicator → "Force Sync Now"
3. Check for errors in details panel
4. Clear errors if persistent failures

### Data Not Showing?
1. Refresh the page (data loads from cache)
2. Check browser console for errors
3. Ensure IndexedDB is enabled in browser settings

### Storage Full?
1. Click status indicator
2. Review old data
3. Consider clearing cache for old records
4. Contact support if issues persist

## Browser Compatibility
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ⚠️ IE 11: Not supported (IndexedDB limitations)

## Cloud Run Integration
The offline architecture is optimized for Cloud Run:
- Mitigates cold start delays (app loads from cache)
- Reduces API calls (saves compute costs)
- Stateless backend scales independently
- Browser handles retry logic

## Security Notes
- Data encrypted at rest on modern devices
- JWT tokens stored securely in localStorage
- Sync queue protected by authentication
- No sensitive data in service worker cache

## Future Enhancements
- [ ] Selective sync (choose data range)
- [ ] Manual conflict resolution UI
- [ ] Offline image uploads with compression
- [ ] Background sync for large datasets
- [ ] Export offline data as backup
