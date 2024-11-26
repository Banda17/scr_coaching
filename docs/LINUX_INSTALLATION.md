# Linux Installation Guide

## Prerequisites

### System Requirements
- Ubuntu 20.04/22.04 LTS or compatible Linux distribution
- Node.js 20.x
- PostgreSQL 14+
- Git
- Build essentials

### Install Required Software

1. **Update System:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Install Node.js:**
   ```bash
   # Add NodeSource repository
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

   # Install Node.js
   sudo apt install -y nodejs

   # Verify installation
   node --version
   npm --version
   ```

3. **Install PostgreSQL:**
   ```bash
   # Add PostgreSQL repository
   sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
   wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
   
   # Update package lists
   sudo apt update
   
   # Install PostgreSQL
   sudo apt install -y postgresql-14 postgresql-contrib
   
   # Start PostgreSQL service
   sudo systemctl enable postgresql
   sudo systemctl start postgresql
   
   # Verify installation
   psql --version
   ```

4. **Install Build Tools:**
   ```bash
   sudo apt install -y build-essential python3-pip
   ```

## Installation Steps

### 1. Clone and Setup Repository

1. Clone Repository:
   ```bash
   git clone <repository-url>
   cd railway-operations
   ```

2. Install Dependencies:
   ```bash
   npm install
   ```

### 2. Database Setup

1. Configure PostgreSQL:
   ```bash
   # Switch to postgres user
   sudo -i -u postgres
   
   # Create database
   createdb railway_ops
   
   # Create user (if needed)
   createuser --interactive
   
   # Set password for postgres user
   psql -c "ALTER USER postgres WITH PASSWORD 'your_password';"
   
   # Exit postgres user shell
   exit
   ```

2. Configure Environment:
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Edit environment variables
   nano .env
   ```
   
   Add the following:
   ```env
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/railway_ops
   PGHOST=localhost
   PGPORT=5432
   PGUSER=postgres
   PGPASSWORD=your_password
   PGDATABASE=railway_ops
   ```

3. Run Database Migrations:
   ```bash
   npm run db:push
   ```

### 3. Development Environment

1. Start Development Server:
   ```bash
   npm run dev
   ```

2. Access Application:
   - Open browser: http://localhost:5000
   - Login with default credentials (if provided)

### 4. Production Setup

1. Configure Firewall:
   ```bash
   sudo ufw allow 5000/tcp
   sudo ufw status
   ```

2. Configure Process Manager:
   ```bash
   # Install PM2
   sudo npm install -g pm2
   
   # Start application
   pm2 start npm --name "railway-ops" -- start
   
   # Configure startup
   pm2 startup
   pm2 save
   ```

### 5. Troubleshooting

1. **PostgreSQL Issues:**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql
   
   # View PostgreSQL logs
   sudo tail -f /var/log/postgresql/postgresql-14-main.log
   
   # Restart PostgreSQL
   sudo systemctl restart postgresql
   ```

2. **Permission Issues:**
   ```bash
   # Fix project directory permissions
   sudo chown -R $USER:$USER .
   
   # Fix npm permissions
   mkdir -p ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.profile
   source ~/.profile
   ```

3. **Port Conflicts:**
   ```bash
   # Check ports in use
   sudo lsof -i :5000
   
   # Kill process using port
   sudo kill -9 <PID>
   ```

### 6. Linux-Specific Notes

1. **System Limits:**
   ```bash
   # Increase file watchers limit
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

2. **Database Maintenance:**
   ```bash
   # Create backup script
   sudo nano /etc/cron.daily/backup-railway-ops
   ```
   
   Add:
   ```bash
   #!/bin/bash
   pg_dump railway_ops > /backup/railway_ops_$(date +%Y%m%d).sql
   ```
   
   ```bash
   # Make script executable
   sudo chmod +x /etc/cron.daily/backup-railway-ops
   ```

3. **Resource Monitoring:**
   ```bash
   # Install monitoring tools
   sudo apt install -y htop iotop
   
   # Monitor system resources
   htop
   ```

4. **Security Considerations:**
   - Configure UFW firewall
   - Set up fail2ban
   - Regular system updates
   - SSL/TLS configuration
