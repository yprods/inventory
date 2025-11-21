/**
 * Chat JavaScript
 */

(function() {
    'use strict';
    
    const socket = io();
    const messagesContainer = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const onlineUsersDiv = document.getElementById('onlineUsers');
    
    // Join chat
    socket.emit('user-join', 'User'); // Replace with actual username
    
    let selectedFile = null;
    
    // Handle file selection
    window.handleFileSelect = function(event) {
        const file = event.target.files[0];
        if (file) {
            selectedFile = file;
            showFilePreview(file);
        }
    };
    
    function showFilePreview(file) {
        const preview = document.getElementById('filePreview');
        preview.innerHTML = `
            <div class="alert alert-info d-flex justify-content-between align-items-center">
                <span><i class="fas fa-file"></i> ${file.name} (${(file.size / 1024).toFixed(2)} KB)</span>
                <button class="btn btn-sm btn-danger" onclick="clearFile()">
                    <i class="fas fa-times"></i> הסר
                </button>
            </div>
        `;
        preview.style.display = 'block';
    }
    
    window.clearFile = function() {
        selectedFile = null;
        document.getElementById('fileInput').value = '';
        document.getElementById('filePreview').style.display = 'none';
    };
    
    // Send message
    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message && !selectedFile) return;
        
        if (selectedFile) {
            // Upload file first
            const formData = new FormData();
            formData.append('file', selectedFile);
            
            try {
                const uploadResponse = await fetch('/api/chat/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const uploadData = await uploadResponse.json();
                
                if (uploadData.success) {
                    socket.emit('message', { 
                        message: message || 'קובץ מצורף',
                        file: uploadData.file 
                    });
                    clearFile();
                } else {
                    alert('שגיאה בהעלאת הקובץ');
                }
            } catch (error) {
                console.error('File upload error:', error);
                alert('שגיאה בהעלאת הקובץ');
            }
        } else {
            socket.emit('message', { message });
        }
        
        messageInput.value = '';
    }
    
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Receive new message
    socket.on('new-message', (message) => {
        addMessage(message);
    });
    
    // Update online users
    socket.on('online-users', (users) => {
        onlineUsersDiv.textContent = `${users.length} משתמשים מחוברים`;
    });
    
    // Add message to UI
    function addMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message own'; // You can determine own/other based on user
        let fileHtml = '';
        if (message.file) {
            fileHtml = `
                <div class="mt-2">
                    <a href="${message.file.url}" target="_blank" class="btn btn-sm btn-outline-light">
                        <i class="fas fa-file"></i> ${message.file.originalName}
                    </a>
                </div>
            `;
        }
        messageDiv.innerHTML = `
            <div class="message-bubble">
                ${escapeHtml(message.text)}
                ${fileHtml}
            </div>
            <div class="message-meta">${message.user} - ${new Date(message.timestamp).toLocaleTimeString('he-IL')}</div>
        `;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Load initial messages
    fetch('/api/chat/messages')
        .then(res => res.json())
        .then(data => {
            if (data.success && data.messages) {
                data.messages.forEach(msg => addMessage(msg));
            }
        })
        .catch(err => console.error('Error loading messages:', err));
    
    // Heartbeat
    setInterval(() => {
        socket.emit('heartbeat');
    }, 30000);
})();

