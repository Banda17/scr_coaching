# Installation Guide

## Prerequisites

### System Requirements
- Node.js 20.x
- PostgreSQL 14+
- npm or yarn package manager

### Required Environment Variables
```env
# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=railway_ops

# Server Configuration
PORT=5000
NODE_ENV=development
```

## Installation Steps

### 1. Clone the Repository
```bash
git clone <repository-url>
cd railway-operations
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
1. Create a PostgreSQL database:
   ```sql
   CREATE DATABASE railway_ops;
   ```

2. Configure environment variables:
   - Copy the `.env.example` file to `.env`
   - Update the database connection details
   - Ensure all required environment variables are set

3. Run database migrations:
   ```bash
   npm run db:push
   ```

### 4. Development Setup

#### Start Development Server
```bash
npm run dev
```
This will start:
- Backend server on port 5000
- Frontend development server with hot reloading
- WebSocket server for real-time updates

#### Available Scripts
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm start`: Run production server
- `npm run check`: Run TypeScript type checking
- `npm run db:push`: Update database schema

### 5. Production Deployment

#### Replit Deployment
1. Fork the repository to Replit
2. Set required environment variables in Replit's Secrets tab:
   - `DATABASE_URL`
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`
   - `NODE_ENV=production`

3. Install dependencies:
   ```bash
   npm install
   ```

4. Build the application:
   ```bash
   npm run build
   ```

5. Start the server:
   ```bash
   npm start
   ```

### 6. Database Configuration

#### Required Indexes
```sql
CREATE INDEX idx_schedules_train_id ON schedules(train_id);
CREATE INDEX idx_schedules_departure_location ON schedules(departure_location_id);
CREATE INDEX idx_schedules_arrival_location ON schedules(arrival_location_id);
CREATE INDEX idx_schedules_status ON schedules(status);
```

#### Database Maintenance
Regular maintenance tasks:
1. Analyze tables: `ANALYZE schedules, trains, locations;`
2. Update statistics: `VACUUM ANALYZE;`
3. Clean up expired sessions: Run weekly cleanup tasks

### 7. Security Configuration

#### Session Settings
```javascript
const sessionSettings = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production'
  }
};
```

#### CORS Configuration
```javascript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
};
```

### 8. Troubleshooting

#### Common Issues

1. Database Connection Issues
   - Verify PostgreSQL service is running
   - Check environment variables
   - Ensure database user has proper permissions

2. Build Errors
   - Clear node_modules and reinstall dependencies
   - Verify Node.js version compatibility
   - Check for TypeScript errors: `npm run check`

3. Runtime Errors
   - Check server logs
   - Verify WebSocket connection
   - Validate environment configuration

### 9. Monitoring

#### Health Check
- Endpoint: `GET /api/health`
- Monitors:
  - Server status
  - Database connection
  - WebSocket availability

#### Error Logging
- Server logs are available in the console
- Production errors are logged with timestamps
- Monitor WebSocket connection status

### 10. Support

For additional support:
1. Check the documentation in the `docs` directory
2. Review API documentation in `docs/api.md`
3. Consult database schema in `docs/database.md`
4. Review security guidelines in `docs/security.md`
