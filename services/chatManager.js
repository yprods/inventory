/**
 * Chat Manager Service
 * Manages chat messages and online users
 */

const logger = require('../utils/logger');

class ChatManager {
    constructor() {
        this.messages = [];
        this.onlineUsers = new Map(); // userId -> { name, lastSeen }
        this.maxMessages = 200;
    }
    
    initialize(io) {
        this.io = io;
        
        io.on('connection', (socket) => {
            logger.info(`User connected: ${socket.id}`);
            
            // User joins
            socket.on('user-join', (userName) => {
                this.onlineUsers.set(socket.id, {
                    name: userName,
                    lastSeen: new Date()
                });
                this.broadcastOnlineUsers();
            });
            
            // User sends message
            socket.on('message', (data) => {
                const userName = this.onlineUsers.get(socket.id)?.name || 'Guest';
                const message = this.addMessage(userName, data.message || '', data.file || null);
                io.emit('new-message', message);
            });
            
            // User disconnects
            socket.on('disconnect', () => {
                logger.info(`User disconnected: ${socket.id}`);
                this.onlineUsers.delete(socket.id);
                this.broadcastOnlineUsers();
            });
            
            // Heartbeat
            socket.on('heartbeat', () => {
                const user = this.onlineUsers.get(socket.id);
                if (user) {
                    user.lastSeen = new Date();
                }
            });
        });
        
        // Clean up old messages periodically
        setInterval(() => {
            this.cleanupMessages();
        }, 60000); // Every minute
        
        // Clean up inactive users
        setInterval(() => {
            this.cleanupInactiveUsers();
        }, 30000); // Every 30 seconds
    }
    
    addMessage(userName, text, file = null) {
        const message = {
            id: Date.now().toString(),
            user: userName,
            text: text.trim(),
            timestamp: new Date().toISOString(),
            isFile: file !== null,
            file: file
        };
        
        this.messages.push(message);
        
        // Keep only last N messages
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }
        
        return message;
    }
    
    getMessages() {
        return this.messages.slice(-50); // Return last 50 messages
    }
    
    getOnlineUsers() {
        return Array.from(this.onlineUsers.values()).map(u => u.name);
    }
    
    broadcastOnlineUsers() {
        if (this.io) {
            this.io.emit('online-users', this.getOnlineUsers());
        }
    }
    
    cleanupMessages() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        this.messages = this.messages.filter(msg => {
            const msgDate = new Date(msg.timestamp);
            return msgDate > oneHourAgo;
        });
    }
    
    cleanupInactiveUsers() {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        for (const [socketId, user] of this.onlineUsers.entries()) {
            if (user.lastSeen < fiveMinutesAgo) {
                this.onlineUsers.delete(socketId);
            }
        }
        if (this.onlineUsers.size > 0) {
            this.broadcastOnlineUsers();
        }
    }
}

// Singleton instance
const chatManager = new ChatManager();

module.exports = chatManager;

