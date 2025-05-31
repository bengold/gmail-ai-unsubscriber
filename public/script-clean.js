// Gmail AI Unsubscriber - Simplified JavaScript
let junkEmails = [];
let isAuthenticated = false;
let currentScanData = null;

// Theme Management
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

// Check for saved theme preference or default to 'light'
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.classList.toggle('dark', savedTheme === 'dark');
updateThemeIcon();

themeToggle?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', !isDark);
    localStorage.setItem('theme', !isDark ? 'dark' : 'light');
    updateThemeIcon();
});

function updateThemeIcon() {
    if (!themeIcon) return;
    const isDark = document.documentElement.classList.contains('dark');
    themeIcon.innerHTML = isDark 
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>';
}

// DOM Elements
const authBtn = document.getElementById('auth-btn');
const scanBtn = document.getElementById('scan-btn');
const unsubscribeBtn = document.getElementById('unsubscribe-btn');
const archiveBtn = document.getElementById('archive-btn');
const statsToggleBtn = document.getElementById('stats-toggle');
const statsSection = document.getElementById('stats-section');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressDetails = document.getElementById('progress-details');
const resultsSection = document.getElementById('results-section');
const resultsContent = document.getElementById('results-content');

// Statistics Elements
const totalEmailsEl = document.getElementById('total-emails');
const processedEmailsEl = document.getElementById('processed-emails');
const unsubscribedEmailsEl = document.getElementById('unsubscribed-emails');
const cacheHitsEl = document.getElementById('cache-hits');

// Event Listeners
authBtn?.addEventListener('click', authenticate);
scanBtn?.addEventListener('click', scanEmails);
unsubscribeBtn?.addEventListener('click', unsubscribeAll);
archiveBtn?.addEventListener('click', archiveAll);
statsToggleBtn?.addEventListener('click', toggleStats);

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
    await checkAuthenticationStatus();
    
    // Handle OAuth callback if code is present
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    
    if (authStatus === 'success') {
        showNotification('Gmail connected successfully!', 'success');
        await checkAuthenticationStatus();
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authStatus === 'error') {
        showNotification('Authentication failed. Please try again.', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

// Toggle statistics visibility
function toggleStats() {
    if (statsSection) {
        const isHidden = statsSection.classList.contains('hidden');
        statsSection.classList.toggle('hidden', !isHidden);
        
        // Update button text
        if (statsToggleBtn) {
            if (isHidden) {
                statsToggleBtn.innerHTML = `<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                   </svg>Hide Stats`;
                showPerformanceStats();
            } else {
                statsToggleBtn.innerHTML = `<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00-2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4"></path>
                   </svg>Stats`;
            }
        }
    }
}

async function checkAuthenticationStatus() {
    try {
        const response = await fetch('/api/emails/auth-status');
        const data = await response.json();
        
        if (data.isAuthenticated) {
            isAuthenticated = true;
            showNotification(data.message, 'success');
            
            // Update auth button
            if (authBtn) {
                authBtn.innerHTML = `<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>Connected`;
                authBtn.disabled = true;
                authBtn.classList.remove('btn-primary');
                authBtn.classList.add('btn-success');
            }
            
            // Enable scan button
            if (scanBtn) scanBtn.disabled = false;
        } else {
            isAuthenticated = false;
            if (authBtn) {
                authBtn.innerHTML = `<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>Connect Gmail`;
                authBtn.disabled = false;
            }
        }
    } catch (error) {
        console.error('Auth status check failed:', error);
        showNotification('Failed to check authentication status', 'error');
    }
}

async function authenticate() {
    try {
        window.location.href = '/api/auth/gmail';
    } catch (error) {
        showNotification('Authentication failed: ' + error.message, 'error');
    }
}

async function scanEmails() {
    if (!isAuthenticated) {
        showNotification('Please connect your Gmail account first', 'warning');
        return;
    }

    const button = scanBtn;
    button.disabled = true;
    button.innerHTML = 'Scanning...';
    
    showProgress();
    
    try {
        const scanPromise = fetch('/api/emails/scan', { method: 'POST' });
        
        // Poll for progress updates
        const progressInterval = setInterval(async () => {
            try {
                const progressResponse = await fetch('/api/emails/progress');
                const progress = await progressResponse.json();
                
                updateProgress(progress);
                
                if (progress.status === 'complete' || progress.status === 'error') {
                    clearInterval(progressInterval);
                }
            } catch (error) {
                console.log('Progress update failed:', error);
            }
        }, 1000);
        
        const response = await scanPromise;
        const data = await response.json();
        
        clearInterval(progressInterval);

        if (response.ok) {
            currentScanData = data;
            const groups = data.groups || [];
            const stats = data.stats || {};
            
            updateStatistics({
                totalEmails: data.processed || 0,
                processedEmails: data.processed || 0,
                junkEmails: data.junkEmails || 0,
                cacheHits: stats.cacheHits || 0
            });
            
            hideProgress();
            
            if (groups.length > 0) {
                displayResults(groups, stats);
                if (unsubscribeBtn) unsubscribeBtn.disabled = false;
                if (archiveBtn) archiveBtn.disabled = false;
            } else {
                showNotification('No junk emails found! Your inbox is clean. 🎉', 'success');
            }
            
            showNotification(`Scan complete! Found ${data.junkEmails} junk emails from ${groups.length} senders.`, 'success');
        } else {
            hideProgress();
            showNotification(`Scan failed: ${data.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        hideProgress();
        showNotification(`Scan error: ${error.message}`, 'error');
    }
    
    button.disabled = false;
    button.innerHTML = '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>Scan Emails';
}

function showProgress() {
    if (progressSection) progressSection.classList.remove('hidden');
}

function hideProgress() {
    if (progressSection) progressSection.classList.add('hidden');
}

function updateProgress(progress) {
    if (progressBar) {
        progressBar.style.width = `${progress.percentage || 0}%`;
    }
    if (progressText) {
        progressText.textContent = `${progress.percentage || 0}%`;
    }
    if (progressDetails) {
        progressDetails.textContent = progress.message || 'Processing...';
    }
}

function displayResults(groups, stats) {
    if (!resultsContent) return;
    
    resultsSection.classList.remove('hidden');
    
    resultsContent.innerHTML = groups.map(group => `
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white">${escapeHtml(group.sender)}</h4>
                    <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">${group.emails.length} emails</p>
                    <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        ${group.emails.map(e => e.subject).slice(0, 2).map(s => escapeHtml(s.substring(0, 50) + (s.length > 50 ? '...' : ''))).join(', ')}
                        ${group.emails.length > 2 ? ` +${group.emails.length - 2} more` : ''}
                    </p>
                </div>
                <div class="flex gap-2 ml-4">
                    <button onclick="unsubscribeGroup('${escapeHtml(group.sender)}')" 
                            class="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
                        Unsubscribe
                    </button>
                    <button onclick="skipGroup('${escapeHtml(group.sender)}')" 
                            class="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">
                        Skip
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function unsubscribeGroup(sender) {
    try {
        const response = await fetch('/api/emails/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender })
        });
        const data = await response.json();
        
        if (response.ok && data.success) {
            showNotification(`Unsubscribed from ${sender}`, 'success');
            // Remove the group from display
            const groupElement = event.target.closest('.bg-white, .dark\\:bg-gray-800');
            if (groupElement) groupElement.remove();
        } else {
            showNotification(`Failed to unsubscribe from ${sender}: ${data.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error unsubscribing from ${sender}: ${error.message}`, 'error');
    }
}

async function skipGroup(sender) {
    try {
        const response = await fetch('/api/emails/skip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender })
        });
        const data = await response.json();
        
        if (response.ok && data.success) {
            showNotification(`Skipped ${sender}`, 'success');
            // Remove the group from display
            const groupElement = event.target.closest('.bg-white, .dark\\:bg-gray-800');
            if (groupElement) groupElement.remove();
        } else {
            showNotification(`Failed to skip ${sender}: ${data.error}`, 'error');
        }
    } catch (error) {
        showNotification(`Error skipping ${sender}: ${error.message}`, 'error');
    }
}

async function unsubscribeAll() {
    if (!currentScanData || !currentScanData.groups) {
        showNotification('No scan data available', 'warning');
        return;
    }

    const button = unsubscribeBtn;
    button.disabled = true;
    button.innerHTML = 'Unsubscribing...';
    
    try {
        const response = await fetch('/api/emails/unsubscribe-all', { method: 'POST' });
        const data = await response.json();
        
        if (response.ok && data.success) {
            showNotification(`Successfully unsubscribed from ${data.unsubscribedCount} senders`, 'success');
            if (resultsContent) resultsContent.innerHTML = '<div class="text-center py-8 text-gray-500">All unsubscribe requests completed!</div>';
        } else {
            showNotification(`Bulk unsubscribe failed: ${data.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        showNotification(`Unsubscribe error: ${error.message}`, 'error');
    }
    
    button.disabled = false;
    button.innerHTML = '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Unsubscribe All';
}

async function archiveAll() {
    if (!currentScanData || !currentScanData.groups) {
        showNotification('No scan data available', 'warning');
        return;
    }

    const button = archiveBtn;
    button.disabled = true;
    button.innerHTML = 'Archiving...';
    
    try {
        const response = await fetch('/api/emails/archive-all', { method: 'POST' });
        const data = await response.json();
        
        if (response.ok && data.success) {
            showNotification(`Successfully archived ${data.archivedCount} emails`, 'success');
        } else {
            showNotification(`Archive failed: ${data.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        showNotification(`Archive error: ${error.message}`, 'error');
    }
    
    button.disabled = false;
    button.innerHTML = '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>Archive All';
}

async function showPerformanceStats() {
    try {
        const response = await fetch('/api/performance/stats');
        const data = await response.json();
        
        const performanceContent = document.getElementById('performance-content');
        if (performanceContent) {
            performanceContent.innerHTML = `
                <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Performance Statistics</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <h5 class="font-medium text-gray-900 dark:text-white mb-2 text-sm">Cache Performance</h5>
                        <div class="space-y-1 text-xs">
                            <div class="flex justify-between">
                                <span>Hit Rate:</span>
                                <span class="font-mono">${((data.cache?.hits || 0) / Math.max((data.cache?.hits || 0) + (data.cache?.misses || 0), 1) * 100).toFixed(1)}%</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Total Hits:</span>
                                <span class="font-mono">${(data.cache?.hits || 0).toLocaleString()}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Cached Keys:</span>
                                <span class="font-mono">${(data.cache?.keys || 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <h5 class="font-medium text-gray-900 dark:text-white mb-2 text-sm">Memory Usage</h5>
                        <div class="space-y-1 text-xs">
                            <div class="flex justify-between">
                                <span>RSS:</span>
                                <span class="font-mono">${Math.round((data.memory?.rss || 0) / 1024 / 1024)}MB</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Heap Used:</span>
                                <span class="font-mono">${Math.round((data.memory?.heapUsed || 0) / 1024 / 1024)}MB</span>
                            </div>
                            <div class="flex justify-between">
                                <span>External:</span>
                                <span class="font-mono">${Math.round((data.memory?.external || 0) / 1024 / 1024)}MB</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load performance stats:', error);
        const performanceContent = document.getElementById('performance-content');
        if (performanceContent) {
            performanceContent.innerHTML = `
                <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Performance Statistics</h4>
                <div class="text-sm text-red-600 dark:text-red-400">
                    Failed to load performance data: ${error.message}
                </div>
            `;
        }
    }
}

function updateStatistics(stats) {
    if (totalEmailsEl) totalEmailsEl.textContent = stats.totalEmails.toLocaleString();
    if (processedEmailsEl) processedEmailsEl.textContent = stats.processedEmails.toLocaleString();
    if (unsubscribedEmailsEl) unsubscribedEmailsEl.textContent = stats.unsubscribedEmails?.toLocaleString() || '0';
    if (cacheHitsEl) cacheHitsEl.textContent = stats.cacheHits.toLocaleString();
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const typeClass = type === 'success' ? 'bg-green-600 text-white' :
                     type === 'error' ? 'bg-red-600 text-white' :
                     type === 'warning' ? 'bg-yellow-600 text-white' :
                     'bg-blue-600 text-white';
    
    notification.className = `fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4 p-4 rounded-lg shadow-lg ${typeClass}`;
    
    const iconPath = type === 'success' ? 'M5 13l4 4L19 7' :
                    type === 'error' ? 'M6 18L18 6M6 6l12 12' :
                    type === 'warning' ? 'M12 9v2m0 4h.01' :
                    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    
    notification.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}"></path>
                </svg>
                <span class="text-sm font-medium">${escapeHtml(message)}</span>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
