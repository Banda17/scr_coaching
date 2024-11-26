# Windows Installation Guide

## Prerequisites

### System Requirements
- Windows 10 or later
- Node.js 20.x
- PostgreSQL 14+
- Git for Windows
- Visual Studio Code (recommended) or any preferred IDE

### Install Required Software

1. **Install Node.js:**
   - Download Node.js 20.x LTS from [nodejs.org](https://nodejs.org/)
   - Run the installer and follow the setup wizard
   - Verify installation:
     ```cmd
     node --version
     npm --version
     ```

2. **Install PostgreSQL:**
   - Download PostgreSQL 14+ from [postgresql.org](https://www.postgresql.org/download/windows/)
   - Run the installer
   - Keep note of the password you set for the postgres user
   - Add PostgreSQL bin directory to system PATH:
     ```
     C:\Program Files\PostgreSQL\14\bin
     ```
   - Verify installation:
     ```cmd
     psql --version
     ```

3. **Install Git:**
   - Download Git from [git-scm.com](https://git-scm.com/download/win)
   - During installation, choose:
     - Use Git from Git Bash only
     - Use OpenSSL library
     - Checkout as-is, commit Unix-style line endings
     - Use MinTTY terminal

## Installation Steps

### 1. Clone and Setup Repository

1. Open Command Prompt or PowerShell:
   ```cmd
   git clone <repository-url>
   cd railway-operations
   ```

2. Install Dependencies:
   ```cmd
   npm install
   ```

### 2. Database Setup

1. Create PostgreSQL Database:
   - Open Command Prompt as Administrator
   ```cmd
   psql -U postgres
   ```
   - At the PostgreSQL prompt:
   ```sql
   CREATE DATABASE railway_ops;
   \q
   ```

2. Configure Environment:
   - Copy `.env.example` to `.env`
   - Update with your PostgreSQL details:
   ```env
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/railway_ops
   PGHOST=localhost
   PGPORT=5432
   PGUSER=postgres
   PGPASSWORD=your_password
   PGDATABASE=railway_ops
   ```

3. Run Database Migrations:
   ```cmd
   npm run db:push
   ```

### 3. Development Environment

1. Start Development Server:
   ```cmd
   npm run dev
   ```
   This starts:
   - Backend server (port 5000)
   - Frontend development server
   - WebSocket server

2. Access Application:
   - Open browser: http://localhost:5000
   - Login with default credentials (if provided)

### 4. Troubleshooting

1. **PostgreSQL Connection Issues:**
   - Verify PostgreSQL service is running:
     ```cmd
     services.msc
     ```
   - Look for "postgresql-x64-14" service
   - Ensure it's running

2. **Port Conflicts:**
   - Check if ports are in use:
     ```cmd
     netstat -ano | findstr :5000
     ```
   - Kill process if needed:
     ```cmd
     taskkill /PID <process_id> /F
     ```

3. **Node.js Issues:**
   - Clear npm cache:
     ```cmd
     npm cache clean --force
     ```
   - Delete node_modules and reinstall:
     ```cmd
     rd /s /q node_modules
     del package-lock.json
     npm install
     ```

### 5. Windows-Specific Notes

1. **File Path Limits:**
   - Enable long paths in Windows:
     - Run Registry Editor (regedit)
     - Navigate to: `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem`
     - Set `LongPathsEnabled` to 1

2. **Terminal Configuration:**
   - Use Windows Terminal (recommended)
   - Configure Git Bash integration
   - Enable WSL2 for Linux-like environment

3. **Antivirus Considerations:**
   - Add project directory to exclusions
   - Whitelist Node.js and npm processes

4. **Performance Optimization:**
   - Disable Windows Defender real-time monitoring for project directory
   - Use SSD for project files and database
