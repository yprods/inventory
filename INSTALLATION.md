# Installation Guide - Sefer Maarexet Node.js

## Quick Start

1. **Install Node.js** (if not already installed)
   - Download from https://nodejs.org/ (version 18+)
   - Verify: `node --version`

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   # Copy example env file
   copy .env.example .env
   
   # Edit .env with your database credentials
   # Set DB_SERVER, DB_DATABASE, DB_USER, DB_PASSWORD
   ```

4. **Start the server**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open browser: http://localhost:3000
   - Default PIN: 4231 (change in .env)

## Database Setup

### SQL Server
- Ensure SQL Server is running
- Update connection string in `.env`
- Database should have CI and DATABOX tables

### SQLite (Optional)
- Automatically created in `data/network_items.db`
- No additional setup needed

## Project Structure

```
SeferMaarexet/
├── config/          # Configuration
├── middleware/      # Express middleware
├── routes/          # Route handlers
├── services/        # Business logic
├── utils/           # Utilities
├── views/           # EJS templates
├── public/          # Static files (CSS, JS)
├── data/            # Data files
├── logs/            # Log files
├── uploads/         # Uploaded files
└── server.js        # Main entry point
```

## Features

✅ Modern Node.js/Express architecture
✅ Real-time chat with Socket.IO
✅ SQL Server + SQLite support
✅ Session-based authentication
✅ PIN authentication
✅ RESTful API
✅ Responsive UI
✅ Error handling & logging

## Troubleshooting

**Port already in use:**
- Change PORT in .env file

**Database connection error:**
- Check SQL Server is running
- Verify credentials in .env
- Check firewall settings

**Module not found:**
- Run `npm install` again
- Delete `node_modules` and reinstall

