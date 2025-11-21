# Sefer Maarexet - Node.js Implementation

Modern Node.js/Express implementation with SQLite fallback support.

## Features

- ✅ **SQLite Fallback**: Automatically uses SQLite if SQL Server is unavailable
- ✅ **Secure Libraries**: All dependencies are up-to-date and secure
- ✅ **Fixed Routing**: All routes properly configured
- ✅ **Database Support**: Works with or without SQL Server connection

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file:

```env
PORT=1212
SESSION_SECRET=your-secret-key
PIN_CODE=4231

# SQL Server (optional - will use SQLite if not configured)
DB_SERVER=localhost
DB_DATABASE=SeferMaarexet
DB_USER=your_user
DB_PASSWORD=your_password
DB_PORT=1433
```

## Running

```bash
npm start
```

The app will:
1. Try to connect to SQL Server
2. If unavailable, automatically fall back to SQLite
3. Create SQLite database in `data/sefer_maarexet.db`

## Database

- **SQL Server**: Primary database (if configured)
- **SQLite**: Automatic fallback (works offline)

## Security

All libraries are updated to latest secure versions:
- Express 4.21.0
- better-sqlite3 11.0.0 (replaces sqlite3)
- Helmet 8.0.0
- All other dependencies updated

