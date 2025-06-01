// Gmail AI Unsubscriber - Simplified JavaScript - Updated: 2025-05-31 18:20
let junkEmails = [];
let isAuthenticated = false;
let currentScanData = null;

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
const aiUnsubscribeBtn = document.getElementById('ai-unsubscribe-btn');

// Computer Use Test Elements
const computerUseUrlInput = document.getElementById('computer-use-url');
const testComputerUseBtn = document.getElementById('test-computer-use-btn');
const computerUseResults = document.getElementById('computer-use-results');
const computerUseContent = document.getElementById('computer-use-content');

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
aiUnsubscribeBtn?.addEventListener('click', aiUnsubscribeAll);
testComputerUseBtn?.addEventListener('click', testComputerUse);
testComputerUseBtn?.addEventListener('click', testComputerUse);

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
            
            // Debug: Log the first group to see its structure
            if (groups.length > 0) {
                console.log('First group data:', groups[0]);
                console.log('First group emails:', groups[0].emails);
            }
            
            updateStatistics({
                totalEmails: data.processed || 0,
                processedEmails: data.processed || 0,
                unsubscribedEmails: 0,
                cacheHits: stats.cacheHits || 0
            });
            
            hideProgress();
            
            if (groups.length > 0) {
                displayResults(groups, stats);
                if (unsubscribeBtn) unsubscribeBtn.disabled = false;
                if (aiUnsubscribeBtn) aiUnsubscribeBtn.disabled = false;
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
    // Calculate percentage from processed/total or use provided percentage
    let percentage = 0;
    if (progress.percentage !== undefined) {
        percentage = progress.percentage;
    } else if (progress.total > 0) {
        percentage = Math.round((progress.processed / progress.total) * 100);
    }
    
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }
    if (progressText) {
        progressText.textContent = `${percentage}%`;
    }
    if (progressDetails) {
        let message = 'Processing...';
        if (progress.status === 'starting') {
            message = 'Starting scan...';
        } else if (progress.status === 'preprocessing') {
            message = `Checking cache and preprocessing... (${progress.preprocessed || 0}/${progress.total || 0})`;
        } else if (progress.status === 'ai-analysis') {
            message = `AI analyzing batch ${progress.currentBatch || 0}/${progress.totalBatches || 0}...`;
        } else if (progress.status === 'complete') {
            message = 'Scan complete!';
        } else if (progress.status === 'error') {
            message = `Error: ${progress.error || 'Unknown error'}`;
        } else if (progress.message) {
            message = progress.message;
        }
        progressDetails.textContent = message;
    }
}

function displayResults(groups, stats) {
    if (!resultsContent) return;
    
    resultsSection.classList.remove('hidden');
    
    resultsContent.innerHTML = groups.map((group, groupIndex) => {
        // Debug: Log each group's email structure
        if (groupIndex === 0 && group.emails && group.emails.length > 0) {
            console.log('First email in first group:', group.emails[0]);
            console.log('Email has subject?', 'subject' in group.emails[0]);
        }
        
        const mostRecentDate = group.emails && group.emails.length > 0 
            ? group.emails.reduce((latest, email) => {
                const emailDate = new Date(email.date || email.internalDate);
                const latestDate = new Date(latest);
                return emailDate > latestDate ? email.date || email.internalDate : latest;
            }, group.emails[0].date || group.emails[0].internalDate)
            : null;
        
        const relativeTime = formatRelativeTime(mostRecentDate);
        
        return `
            <div class="email-group bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700" data-sender="${escapeHtml(group.domain || group.sender)}">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="text-lg font-semibold text-gray-900 dark:text-white">${escapeHtml(group.senderName || group.sender || group.domain)}</h4>
                            ${group.averageConfidence ? `<span class="text-xs px-2 py-1 rounded-full ${getConfidenceColor(group.averageConfidence / 100)} font-medium">
                                ${group.averageConfidence}% confidence
                            </span>` : ''}
                        </div>
                        
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
                            </svg>
                            ${escapeHtml(group.domain)}
                        </p>
                        
                        <div class="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                            <span class="flex items-center">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                </svg>
                                ${group.emails.length} email${group.emails.length === 1 ? '' : 's'}
                            </span>
                            <span class="flex items-center">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                ${relativeTime}
                            </span>
                        </div>
                        
                        <!-- Email Subject Lines (Collapsible) -->
                        <div class="mb-3">
                            <button type="button" onclick="toggleSubjects(${groupIndex})" class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 flex items-center focus:outline-none">
                                <svg class="w-4 h-4 mr-1 transform transition-transform" id="subjects-arrow-${groupIndex}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                                </svg>
                                View subject lines (${group.emails.length})
                            </button>
                            <div id="subjects-${groupIndex}" class="hidden mt-2 pl-5 space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                                ${group.emails && group.emails.length > 0 ? group.emails.map(email => {
                                    const subject = email.subject || 'No subject';
                                    const dateStr = email.date ? formatRelativeTime(email.date) : '';
                                    return `
                                        <div class="text-xs text-gray-600 dark:text-gray-400 py-1 border-l-2 border-gray-200 dark:border-gray-600 pl-3">
                                            <span class="font-medium">${escapeHtml(subject)}</span>
                                            ${dateStr ? `<span class="text-gray-500 dark:text-gray-500 ml-2">(${dateStr})</span>` : ''}
                                        </div>
                                    `;
                                }).join('') : '<div class="text-xs text-gray-500">No emails found</div>'}
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-2 ml-4">
                        <button onclick="unsubscribeGroup('${escapeHtml(group.domain || group.sender)}', event)" 
                                class="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                            Unsubscribe
                        </button>
                        <button onclick="enhancedUnsubscribeGroup('${escapeHtml(group.domain || group.sender)}', '${group.emails[0]?.id || ''}', event)" 
                                class="px-3 py-2 text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center btn-ai" 
                                title="Use AI-powered unsubscribe with higher success rate">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                            </svg>
                            AI Unsubscribe
                        </button>
                        <button onclick="skipGroup('${escapeHtml(group.domain || group.sender)}', event)" 
                                class="px-3 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            Skip
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Helper function to get confidence score color
function getConfidenceColor(confidence) {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
}

// Function to toggle subject lines visibility
function toggleSubjects(groupIndex) {
    const subjectsDiv = document.getElementById(`subjects-${groupIndex}`);
    const arrow = document.getElementById(`subjects-arrow-${groupIndex}`);
    
    if (subjectsDiv && arrow) {
        const isHidden = subjectsDiv.classList.contains('hidden');
        subjectsDiv.classList.toggle('hidden');
        arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    }
}

// Make it globally available
window.toggleSubjects = toggleSubjects;

async function unsubscribeGroup(sender, event) {
    console.log('DEBUG: unsubscribeGroup called with sender:', sender);
    
    // Get the button that was clicked
    const button = event ? event.target.closest('button') : null;
    const originalButtonContent = button ? button.innerHTML : null;
    const groupElement = button ? button.closest('.bg-white, .dark\\:bg-gray-800') : null;
    
    try {
        // Show loading state
        if (button) {
            button.disabled = true;
            button.innerHTML = `
                <svg class="w-4 h-4 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Unsubscribing...
            `;
        }
        
        // Find the group data for this sender
        if (!currentScanData || !currentScanData.groups) {
            showNotification('No scan data available. Please scan emails first.', 'error');
            return;
        }
        
        const group = currentScanData.groups.find(g => 
            (g.domain === sender) || (g.sender === sender)
        );
        
        if (!group) {
            showNotification(`Could not find group data for ${sender}`, 'error');
            console.error('Available groups:', currentScanData.groups.map(g => ({ domain: g.domain, sender: g.sender })));
            return;
        }
        
        // Check if group.emails exists and is an array
        if (!group.emails || !Array.isArray(group.emails)) {
            showNotification(`No emails found in group for ${sender}`, 'error');
            console.error('Group data:', group);
            return;
        }
        
        // Extract email IDs from the group with better error checking
        const emailIds = group.emails
            .map(email => email && email.id)
            .filter(id => id); // Remove any undefined/null IDs
        
        const senderDomain = group.domain || group.sender || sender;
        
        if (!emailIds || emailIds.length === 0) {
            showNotification(`No valid email IDs found for ${sender}`, 'error');
            console.error('Group emails:', group.emails);
            return;
        }
        
        if (!senderDomain) {
            showNotification(`No sender domain found for ${sender}`, 'error');
            console.error('Group data:', group);
            return;
        }
        
        console.log('Sending unsubscribe request:', { senderDomain, emailIds });
        
        const response = await fetch('/api/emails/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                senderDomain,
                emailIds
            })
        });
        const data = await response.json();
        
        if (response.ok && data.success) {
            showNotification(`Successfully unsubscribed from ${sender}`, 'success');
            
            // Show success state and remove group after delay
            if (button && groupElement) {
                button.innerHTML = `
                    <svg class="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Unsubscribed
                `;
                button.classList.remove('btn-danger');
                button.classList.add('bg-green-600', 'text-white');
                
                // Fade out and remove the group element after 2 seconds
                setTimeout(() => {
                    groupElement.style.transition = 'opacity 0.5s ease-out';
                    groupElement.style.opacity = '0';
                    setTimeout(() => {
                        groupElement.remove();
                        // Check if we should continue scanning
                        checkForContinuousScanning();
                    }, 500);
                }, 2000);
            }
        } else {
            showNotification(`Failed to unsubscribe from ${sender}: ${data.error}`, 'error');
            
            // Show error state
            if (button) {
                button.innerHTML = `
                    <svg class="w-4 h-4 mr-1 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    Failed
                `;
                button.classList.add('bg-red-600', 'text-white');
                
                // Restore button after 3 seconds
                setTimeout(() => {
                    button.innerHTML = originalButtonContent;
                    button.disabled = false;
                    button.classList.remove('bg-red-600', 'text-white');
                }, 3000);
            }
        }
    } catch (error) {
        showNotification(`Error unsubscribing from ${sender}: ${error.message}`, 'error');
        
        // Show error state
        if (button) {
            button.innerHTML = `
                <svg class="w-4 h-4 mr-1 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                Error
            `;
            button.classList.add('bg-red-600', 'text-white');
            
            // Restore button after 3 seconds
            setTimeout(() => {
                button.innerHTML = originalButtonContent;
                button.disabled = false;
                button.classList.remove('bg-red-600', 'text-white');
            }, 3000);
        }
    }
}

async function skipGroup(sender, event) {
    const button = event?.target?.closest('button');
    const originalButtonContent = button?.innerHTML;
    
    try {
        // Show loading state
        if (button) {
            button.innerHTML = `
                <svg class="w-4 h-4 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Skipping...
            `;
            button.disabled = true;
        }
        
        // Find the group data for this sender to get proper domain
        let senderDomain = sender;
        let senderName = sender;
        
        if (currentScanData && currentScanData.groups) {
            const group = currentScanData.groups.find(g => 
                (g.domain === sender) || (g.sender === sender)
            );
            if (group) {
                senderDomain = group.domain || sender;
                senderName = group.senderName || group.sender || sender;
            }
        }
        
        const response = await fetch('/api/emails/skip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                senderDomain,
                senderName,
                reason: 'User skipped during scan'
            })
        });
        const data = await response.json();
        
        if (response.ok && data.success) {
            showNotification(`Skipped ${sender}`, 'success');
            
            // Show success state
            if (button) {
                button.innerHTML = `
                    <svg class="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Skipped
                `;
                button.classList.add('bg-gray-500', 'text-white');
            }
            
            // Find and hide the group element with fade-out animation
            const groupElement = button?.closest('.email-group') || 
                               Array.from(document.querySelectorAll('.email-group')).find(el => 
                                   el.textContent.includes(sender)
                               );
            
            if (groupElement) {
                groupElement.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
                groupElement.style.opacity = '0.3';
                groupElement.style.transform = 'scale(0.95)';
                
                setTimeout(() => {
                    groupElement.style.opacity = '0';
                    groupElement.style.transform = 'translateX(-100%) scale(0.9)';
                    
                    setTimeout(() => {
                        groupElement.remove();
                        // Check if we should continue scanning
                        checkForContinuousScanning();
                    }, 500);
                }, 1000);
            }
        } else {
            showNotification(`Failed to skip ${sender}: ${data.error}`, 'error');
            
            // Show error state
            if (button) {
                button.innerHTML = `
                    <svg class="w-4 h-4 mr-1 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    Failed
                `;
                button.classList.add('bg-red-600', 'text-white');
                
                // Restore button after 3 seconds
                setTimeout(() => {
                    button.innerHTML = originalButtonContent;
                    button.disabled = false;
                    button.classList.remove('bg-red-600', 'text-white');
                }, 3000);
            }
        }
    } catch (error) {
        showNotification(`Error skipping ${sender}: ${error.message}`, 'error');
        
        // Show error state
        if (button) {
            button.innerHTML = `
                <svg class="w-4 h-4 mr-1 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                Error
            `;
            button.classList.add('bg-red-600', 'text-white');
            
            // Restore button after 3 seconds
            setTimeout(() => {
                button.innerHTML = originalButtonContent;
                button.disabled = false;
                button.classList.remove('bg-red-600', 'text-white');
            }, 3000);
        }
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
    if (totalEmailsEl) totalEmailsEl.textContent = (stats.totalEmails || 0).toLocaleString();
    if (processedEmailsEl) processedEmailsEl.textContent = (stats.processedEmails || 0).toLocaleString();
    if (unsubscribedEmailsEl) unsubscribedEmailsEl.textContent = (stats.unsubscribedEmails || 0).toLocaleString();
    if (cacheHitsEl) cacheHitsEl.textContent = (stats.cacheHits || 0).toLocaleString();
}

function showNotification(message, type = 'info', duration = 4000) {
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
    }, duration);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function enhancedUnsubscribeGroup(sender, emailId, event) {
    if (!emailId) {
        showNotification('No email ID available for enhanced unsubscribe', 'error');
        return;
    }

    const button = event?.target?.closest('button');
    const originalButtonContent = button?.innerHTML;

    try {
        // Show loading state
        if (button) {
            button.innerHTML = `
                <svg class="w-4 h-4 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                AI Processing...
            `;
            button.disabled = true;
        }

        const response = await fetch('/api/emails/unsubscribe-enhanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                emailId: emailId,
                senderDomain: sender 
            })
        });
        const data = await response.json();
        
        if (response.ok && data.success) {
            let message = `AI Unsubscribe successful for ${sender}`;
            if (data.method === 'list-unsubscribe-header') {
                message += ' (via email headers)';
            } else if (data.method === 'form-automation') {
                message += ' (via automated form)';
            }
            
            showNotification(message, 'success');
            
            // Show additional details if available
            if (data.url) {
                showNotification(`Unsubscribe URL: ${data.url}`, 'info');
            }
            
            // Show success state
            if (button) {
                button.innerHTML = `
                    <svg class="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    AI Success
                `;
                button.classList.add('bg-green-600', 'text-white');
            }
            
            // Find and remove the group element with animation
            const groupElement = button?.closest('.email-group') || 
                               Array.from(document.querySelectorAll('.email-group')).find(el => 
                                   el.textContent.includes(sender)
                               );
            
            if (groupElement) {
                groupElement.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
                groupElement.style.opacity = '0.7';
                groupElement.style.transform = 'scale(0.98)';
                
                setTimeout(() => {
                    groupElement.style.opacity = '0';
                    groupElement.style.transform = 'translateX(100%) scale(0.95)';
                    
                    setTimeout(() => {
                        groupElement.remove();
                        // Check if we should continue scanning
                        checkForContinuousScanning();
                    }, 500);
                }, 2000);
            }
            
            // Update counter
            updateUnsubscribedCount();
        } else {
            let errorMessage = `AI Unsubscribe failed for ${sender}`;
            if (data.message) {
                errorMessage += `: ${data.message}`;
            }
            if (data.method === 'manual-fallback') {
                errorMessage += ' (Manual action may be required)';
            }
            showNotification(errorMessage, 'warning');
            
            // If there's a URL, show it for manual action
            if (data.url) {
                showNotification(`Manual unsubscribe URL: ${data.url}`, 'info');
            }
            
            // Show error/warning state
            if (button) {
                button.innerHTML = `
                    <svg class="w-4 h-4 mr-1 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                    Manual
                `;
                button.classList.add('bg-yellow-600', 'text-white');
                
                // Restore button after 5 seconds
                setTimeout(() => {
                    button.innerHTML = originalButtonContent;
                    button.disabled = false;
                    button.classList.remove('bg-yellow-600', 'text-white');
                }, 5000);
            }
        }
    } catch (error) {
        console.error('Enhanced unsubscribe error:', error);
        showNotification(`Error during AI unsubscribe from ${sender}: ${error.message}`, 'error');
        
        // Show error state
        if (button) {
            button.innerHTML = `
                <svg class="w-4 h-4 mr-1 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                Error
            `;
            button.classList.add('bg-red-600', 'text-white');
            
            // Restore button after 3 seconds
            setTimeout(() => {
                button.innerHTML = originalButtonContent;
                button.disabled = false;
                button.classList.remove('bg-red-600', 'text-white');
            }, 3000);
        }
    }
}

async function aiUnsubscribeAll() {
    if (!currentScanData || !currentScanData.groups) {
        showNotification('No scan data available', 'warning');
        return;
    }

    const button = aiUnsubscribeBtn;
    button.disabled = true;
    button.innerHTML = `
        <svg class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        AI Processing...
    `;
    
    showNotification('Beginning AI-powered unsubscribe process...', 'info');
    
    let completedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    
    try {
        // Process each group individually to show progress
        for (const group of currentScanData.groups) {
            if (group.emails && group.emails.length > 0) {
                try {
                    // Show progress notification
                    showNotification(`Processing ${group.senderName || group.domain} (${completedCount + 1}/${currentScanData.groups.length})`, 'info', 2000);
                    
                    const emailIds = group.emails.map(email => email.id);
                    
                    // Call the enhanced unsubscribe endpoint
                    const response = await fetch('/api/emails/bulk-unsubscribe-enhanced', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            senderDomain: group.domain || group.sender,
                            emailIds: emailIds
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok && data.success) {
                        successCount++;
                        // Remove this group from display
                        const groupElement = document.querySelector(`[data-sender="${escapeHtml(group.domain || group.sender)}"]`);
                        if (groupElement) {
                            groupElement.style.opacity = '0.5';
                            groupElement.style.transition = 'opacity 0.3s ease-out';
                            setTimeout(() => groupElement?.remove(), 300);
                        }
                    } else {
                        failedCount++;
                        console.warn(`Failed to unsubscribe from ${group.senderName || group.domain}:`, data.error || 'Unknown error');
                    }
                } catch (groupError) {
                    failedCount++;
                    console.error(`Error processing ${group.senderName || group.domain}:`, groupError);
                }
                
                completedCount++;
                
                // Update button text with progress
                button.innerHTML = `
                    <svg class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    AI Processing (${completedCount}/${currentScanData.groups.length})
                `;
                
                // Small delay between requests to avoid overloading
                await new Promise(r => setTimeout(r, 500));
            }
        }
        
        // Show final results
        if (successCount > 0) {
            showNotification(`Successfully processed ${successCount} senders with AI (${failedCount} failed)`, 'success');
            if (successCount === currentScanData.groups.length && resultsContent) {
                resultsContent.innerHTML = '<div class="text-center py-8 text-gray-500">All AI unsubscribe requests completed successfully!</div>';
            }
        } else {
            showNotification(`AI unsubscribe completed with ${failedCount} failures and no successes`, 'warning');
        }
    } catch (error) {
        showNotification(`AI unsubscribe error: ${error.message}`, 'error');
    } finally {
        // Restore button
        button.disabled = false;
        button.innerHTML = `
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
            AI Unsubscribe
        `;
    }
}

async function testComputerUse() {
    const url = computerUseUrlInput?.value?.trim();
    
    if (!url) {
        showNotification('Please enter a URL to test', 'warning');
        return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showNotification('Please enter a valid URL starting with http:// or https://', 'warning');
        return;
    }

    const button = testComputerUseBtn;
    if (!button) return;

    button.disabled = true;
    button.innerHTML = `
        <svg class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        Testing Computer Use...
    `;
    
    showNotification('Starting Computer Use test... This may take a moment.', 'info');
    
    try {
        const response = await fetch('/api/emails/test-computer-use', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Show results
            if (computerUseResults && computerUseContent) {
                computerUseResults.classList.remove('hidden');
                
                let resultHtml = `
                    <div class="mb-3">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            data.success ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }">
                            ${data.success ? '✅ Success' : '❌ Failed'}
                        </span>
                        <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">Method: ${data.method}</span>
                    </div>
                    <div class="mb-2">
                        <strong>Message:</strong> ${escapeHtml(data.message)}
                    </div>
                `;
                
                if (data.url) {
                    resultHtml += `<div class="mb-2"><strong>URL:</strong> <a href="${escapeHtml(data.url)}" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">${escapeHtml(data.url)}</a></div>`;
                }
                
                if (data.steps && data.steps.length > 0) {
                    resultHtml += `
                        <div class="mb-2">
                            <strong>Steps Performed:</strong>
                            <ol class="list-decimal list-inside mt-1 text-sm space-y-1">
                                ${data.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}
                            </ol>
                        </div>
                    `;
                }
                
                if (data.error) {
                    resultHtml += `<div class="text-red-600 dark:text-red-400"><strong>Error:</strong> ${escapeHtml(data.error)}</div>`;
                }
                
                computerUseContent.innerHTML = resultHtml;
            }
            
            showNotification(
                data.success ? 'Computer Use test completed successfully!' : 'Computer Use test completed with issues', 
                data.success ? 'success' : 'warning'
            );
        } else {
            showNotification(`Computer Use test failed: ${data.error || 'Unknown error'}`, 'error');
            if (computerUseResults && computerUseContent) {
                computerUseResults.classList.remove('hidden');
                computerUseContent.innerHTML = `<div class="text-red-600 dark:text-red-400">Error: ${escapeHtml(data.error || 'Unknown error')}</div>`;
            }
        }
    } catch (error) {
        showNotification(`Computer Use test error: ${error.message}`, 'error');
        if (computerUseResults && computerUseContent) {
            computerUseResults.classList.remove('hidden');
            computerUseContent.innerHTML = `<div class="text-red-600 dark:text-red-400">Network Error: ${escapeHtml(error.message)}</div>`;
        }
    } finally {
        // Restore button
        button.disabled = false;
        button.innerHTML = `
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
            Test Computer Use
        `;
    }
}

// Utility function to format relative time
function formatRelativeTime(dateString) {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return 'Unknown';
    }
    
    const now = new Date();
    const diffInMs = now - date;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInDays > 365) {
        const years = Math.floor(diffInDays / 365);
        return `${years} year${years > 1 ? 's' : ''} ago`;
    } else if (diffInDays > 30) {
        const months = Math.floor(diffInDays / 30);
        return `${months} month${months > 1 ? 's' : ''} ago`;
    } else if (diffInDays > 0) {
        return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else if (diffInHours > 0) {
        return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInMinutes > 0) {
        return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

function generateGroupHtml(group) {
    const mostRecentDate = group.emails && group.emails.length > 0 
        ? group.emails.reduce((latest, email) => {
            const emailDate = new Date(email.date || email.internalDate);
            const latestDate = new Date(latest);
            return emailDate > latestDate ? email.date || email.internalDate : latest;
        }, group.emails[0].date || group.emails[0].internalDate)
        : null;
    
    const relativeTime = formatRelativeTime(mostRecentDate);
    
    return `
        <div class="email-group bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        ${escapeHtml(group.senderName || group.sender || group.domain)}
                    </h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        ${escapeHtml(group.domain || 'Unknown domain')}
                    </p>
                    <div class="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <span class="flex items-center">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                            </svg>
                            ${group.emails ? group.emails.length : 0} emails
                        </span>
                        <span class="flex items-center">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            ${relativeTime}
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="flex flex-wrap gap-2">
                <button onclick="unsubscribeGroup('${escapeHtml(group.domain || group.sender)}', event)" 
                        class="btn btn-danger flex items-center text-sm">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    Unsubscribe
                </button>
                
                <button onclick="enhancedUnsubscribeGroup('${escapeHtml(group.domain || group.sender)}', '${group.emails[0]?.id || ''}', event)" 
                        class="btn btn-primary flex items-center text-sm">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                    Smart Unsubscribe
                </button>
                
                <button onclick="skipGroup('${escapeHtml(group.domain || group.sender)}', event)" 
                        class="btn btn-secondary flex items-center text-sm">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Skip
                </button>
            </div>
        </div>
    `;
}

// Continuous scanning functionality
let continuousScanningEnabled = false;
let continuousScanningInProgress = false;

// Add continuous scanning toggle to UI after initial scan
function addContinuousScanningToggle() {
    const resultsSection = document.getElementById('results-section');
    if (!resultsSection || document.getElementById('continuous-scan-toggle')) {
        return; // Already exists or no results section
    }

    const toggleContainer = document.createElement('div');
    toggleContainer.id = 'continuous-scan-container';
    toggleContainer.className = 'bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4';
    toggleContainer.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <h4 class="text-sm font-medium text-blue-900 dark:text-blue-100">Continuous Scanning</h4>
                <p class="text-xs text-blue-700 dark:text-blue-300">Automatically scan for new junk emails in the background</p>
            </div>
            <label class="flex items-center cursor-pointer">
                <input type="checkbox" id="continuous-scan-toggle" class="sr-only">
                <div class="relative">
                    <div class="block bg-gray-600 w-10 h-6 rounded-full"></div>
                    <div class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition"></div>
                </div>
            </label>
        </div>
    `;

    resultsSection.insertBefore(toggleContainer, resultsSection.firstChild);

    // Add event listener for toggle
    const toggle = document.getElementById('continuous-scan-toggle');
    toggle.addEventListener('change', function() {
        continuousScanningEnabled = this.checked;
        
        if (this.checked) {
            // Enable continuous scanning
            this.parentElement.querySelector('.block').classList.remove('bg-gray-600');
            this.parentElement.querySelector('.block').classList.add('bg-blue-600');
            this.parentElement.querySelector('.dot').style.transform = 'translateX(100%)';
            
            showNotification('Continuous scanning enabled', 'success');
            checkForContinuousScanning();
        } else {
            // Disable continuous scanning
            this.parentElement.querySelector('.block').classList.remove('bg-blue-600');
            this.parentElement.querySelector('.block').classList.add('bg-gray-600');
            this.parentElement.querySelector('.dot').style.transform = 'translateX(0%)';
            
            showNotification('Continuous scanning disabled', 'info');
        }
    });
}

// Check if we should start continuous scanning
async function checkForContinuousScanning() {
    if (!continuousScanningEnabled || continuousScanningInProgress) {
        return;
    }

    // Check if there are no more groups to process
    const resultsContent = document.getElementById('results-content');
    if (!resultsContent) {
        return;
    }

    const visibleGroups = resultsContent.querySelectorAll('.email-group:not(.hidden)');
    
    // If we have fewer than 3 groups visible, try to scan for more
    if (visibleGroups.length < 3) {
        console.log(`🔄 Only ${visibleGroups.length} groups remaining, scanning for more emails...`);
        await scanMoreEmails();
    }
}

// Scan for additional emails
async function scanMoreEmails() {
    if (continuousScanningInProgress) {
        return;
    }

    continuousScanningInProgress = true;
    
    try {
        showNotification('Scanning for more junk emails...', 'info');
        
        const response = await fetch('/api/emails/scan-more', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                skipProcessed: true
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.groups && data.groups.length > 0) {
            console.log(`✅ Found ${data.groups.length} new email groups`);
            
            // Add new groups to existing results
            const existingGroups = junkEmails || [];
            const newGroups = data.groups.filter(newGroup => 
                !existingGroups.some(existing => existing.domain === newGroup.domain)
            );
            
            if (newGroups.length > 0) {
                junkEmails = [...existingGroups, ...newGroups];
                
                // Update UI with new groups
                appendNewGroups(newGroups);
                
                showNotification(`Found ${newGroups.length} new junk email groups`, 'success');
                
                // Update statistics
                if (data.stats) {
                    updateStatistics(data.stats);
                }
            } else {
                showNotification('No new junk email groups found', 'info');
            }
        } else {
            showNotification('No additional junk emails found', 'info');
        }
    } catch (error) {
        console.error('Error scanning for more emails:', error);
        showNotification('Error scanning for more emails: ' + error.message, 'error');
    } finally {
        continuousScanningInProgress = false;
    }
}

// Append new groups to existing results
function appendNewGroups(newGroups) {
    const resultsContent = document.getElementById('results-content');
    if (!resultsContent) {
        return;
    }

    // Get current group count to continue indexing
    const existingGroups = resultsContent.querySelectorAll('.email-group');
    let groupIndex = existingGroups.length;

    newGroups.forEach(group => {
        const groupHtml = generateGroupHtml(group, groupIndex);
        const groupElement = document.createElement('div');
        groupElement.innerHTML = groupHtml;
        
        // Add fade-in animation
        groupElement.firstElementChild.style.opacity = '0';
        groupElement.firstElementChild.style.transform = 'translateY(20px)';
        
        resultsContent.appendChild(groupElement.firstElementChild);
        
        // Trigger animation
        setTimeout(() => {
            groupElement.firstElementChild.style.opacity = '1';
            groupElement.firstElementChild.style.transform = 'translateY(0)';
            groupElement.firstElementChild.style.transition = 'all 0.3s ease-out';
        }, 100);
        
        groupIndex++;
    });
}

// Update the displayResults function to add the toggle
function originalDisplayResults(groups, stats) {
    const resultsSection = document.getElementById('results-section');
    const resultsContent = document.getElementById('results-content');
    const scanTimestamp = document.getElementById('scan-timestamp');
    
    if (!resultsSection || !resultsContent) return;

    junkEmails = groups || [];

    // Show scan timestamp
    if (scanTimestamp) {
        scanTimestamp.textContent = new Date().toLocaleString();
    }

    if (!groups || groups.length === 0) {
        resultsContent.innerHTML = `
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                <svg class="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m13-8l-2-2-2 2m0 0l-2 2m2-2v4"></path>
                </svg>
                <p class="text-lg font-medium">No junk emails found!</p>
                <p class="text-sm">Your inbox is clean or all promotional emails are already processed.</p>
            </div>
        `;
        resultsSection.classList.remove('hidden');
        return;
    }

    resultsContent.innerHTML = groups.map((group, index) => generateGroupHtml(group, index)).join('');

    // Update statistics
    updateStatistics(stats);

    resultsSection.classList.remove('hidden');
    
    // Add continuous scanning toggle after displaying results
    setTimeout(() => {
        addContinuousScanningToggle();
    }, 500);
}

// Replace the original displayResults function
if (typeof displayResults === 'function') {
    displayResults = originalDisplayResults;
}
