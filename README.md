# Sefer Maarexet - Node.js Implementation

Modern Node.js/Express implementation of Sefer Maarexet system.

## Features

- ✅ Modern Node.js/Express architecture
- ✅ SQL Server and SQLite database support
- ✅ Real-time chat with Socket.IO
- ✅ Session-based authentication
- ✅ PIN authentication
- ✅ RESTful API
- ✅ File upload support
- ✅ Responsive modern UI
- ✅ Error handling and logging

## Prerequisites

- Node.js 18+ 
- npm 9+
- SQL Server (for main database)
- SQLite (for network items - optional)

## Installation

1. **Clone/Navigate to project directory**
   ```bash
   cd SeferMaarexet
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials and settings.

4. **Create necessary directories**
   ```bash
   mkdir -p data logs uploads public views
   ```

5. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

## Project Structure

```
SeferMaarexet/
├── config/           # Configuration files
│   └── database.js   # Database connections
├── middleware/       # Express middleware
│   ├── auth.js       # Authentication
│   └── errorHandler.js
├── routes/           # Route handlers
│   ├── auth.js       # Authentication routes
│   ├── home.js       # Home routes
│   ├── chat.js       # Chat routes
│   └── api.js        # API endpoints
├── services/         # Business logic
│   ├── chatManager.js
│   └── networkItemService.js
├── utils/            # Utilities
│   └── logger.js     # Logging
├── views/            # EJS templates
├── public/           # Static files
├── uploads/          # Uploaded files
├── data/             # Data files
├── logs/             # Log files
├── server.js         # Main server file
└── package.json      # Dependencies
```

## Environment Variables

See `.env.example` for all configuration options.

## API Endpoints

- `GET /api/chat/messages` - Get chat messages
- `POST /api/chat/send` - Send chat message
- `GET /api/chat/users` - Get online users
- `GET /api/alerts` - Get alerts
- `POST /api/alerts` - Save alert

## Development

The server runs on `http://localhost:3000` by default.

## License

ISC

