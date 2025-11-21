/**
 * Chat Sidebar JavaScript
 */

(function() {
    'use strict';
    
    const SIDEBAR_WIDTH = 380;
    const STORAGE_KEY = 'chatSidebarCollapsed';
    
    const chatSidebar = document.getElementById('leftChatSidebar');
    const toggleBtn = document.getElementById('toggleChatSidebar');
    const chatToggleBtn = document.getElementById('chatToggleButton');
    const bodyContent = document.querySelector('.body-content');
    const body = document.body;
    
    if (!chatSidebar || !toggleBtn || !bodyContent) {
        console.warn('Sidebar elements not found');
        return;
    }
    
    // Load saved state
    const isCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
    
    // Initialize
    function initialize() {
        if (isCollapsed) {
            chatSidebar.classList.add('collapsed');
            chatToggleBtn.style.display = 'flex';
            body.classList.add('sidebar-collapsed');
        } else {
            chatSidebar.classList.remove('collapsed');
            chatToggleBtn.style.display = 'none';
            body.classList.remove('sidebar-collapsed');
        }
        updateIcon(isCollapsed);
    }
    
    // Update icon
    function updateIcon(collapsed) {
        const icon = toggleBtn.querySelector('i');
        if (icon) {
            icon.className = collapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        }
    }
    
    // Toggle sidebar
    function toggle() {
        const currentlyCollapsed = chatSidebar.classList.contains('collapsed');
        const newState = !currentlyCollapsed;
        
        if (newState) {
            chatSidebar.classList.add('collapsed');
            chatToggleBtn.style.display = 'flex';
            body.classList.add('sidebar-collapsed');
        } else {
            chatSidebar.classList.remove('collapsed');
            chatToggleBtn.style.display = 'none';
            body.classList.remove('sidebar-collapsed');
        }
        
        updateIcon(newState);
        localStorage.setItem(STORAGE_KEY, newState.toString());
    }
    
    // Event listeners
    toggleBtn.addEventListener('click', toggle);
    if (chatToggleBtn) {
        chatToggleBtn.addEventListener('click', toggle);
    }
    
    // Initialize
    initialize();
})();

