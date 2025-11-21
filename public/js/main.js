/**
 * Main JavaScript
 */

// Utility functions
function getBaseUrl() {
    return window.location.origin;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Sefer Maarexet - Main script loaded');
    loadAlertsBadge();
    
    // Refresh alerts badge every 30 seconds
    setInterval(loadAlertsBadge, 30000);
});

// Load alerts badge count
async function loadAlertsBadge() {
    try {
        const response = await fetch('/api/alerts/unread-count');
        const data = await response.json();
        
        if (data.success) {
            const badge = document.getElementById('alertsBadge');
            if (badge) {
                if (data.count > 0) {
                    badge.textContent = data.count;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error('Error loading alerts badge:', error);
    }
}

