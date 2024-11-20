# Configuration Guide

## Environment Variables

### Required Variables
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
NODE_ENV=development|production
```

## Development Setup

### Prerequisites
1. Node.js 20.x
2. PostgreSQL 14+
3. npm or yarn

### Installation Steps
```bash
# Install dependencies
npm install

# Setup database
npm run db:push

# Start development server
npm run dev
```

### Database Migration
```bash
# Generate migration
npm run db:generate

# Push schema changes
npm run db:push
```

## Production Deployment

### Replit Deployment
1. Fork the repository to Replit
2. Set required environment variables
3. Run `npm run build`
4. Use `npm start` as the run command

### Environment Configuration
1. Set `NODE_ENV=production`
2. Configure secure session settings
3. Enable HTTPS if required
4. Set appropriate CORS configuration

## Security Configuration

### Session Configuration
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

### CORS Configuration
```javascript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
};
```

## WebSocket Configuration

### Client Configuration
```javascript
const socket = io({
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 3000
});
```

### Server Configuration
```javascript
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
```

## Database Indexing

### Recommended Indexes
```sql
CREATE INDEX idx_schedules_train_id ON schedules(train_id);
CREATE INDEX idx_schedules_departure_location ON schedules(departure_location_id);
CREATE INDEX idx_schedules_arrival_location ON schedules(arrival_location_id);
CREATE INDEX idx_schedules_status ON schedules(status);
```

## Performance Tuning

### Node.js Configuration
```javascript
// Garbage Collection
node --max-old-space-size=4096

// Clustering
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
```

### Database Connection Pool
```javascript
const pool = {
  max: 20,
  min: 5,
  idle: 10000
};
```

## Monitoring Setup

### Health Check Endpoint
```http
GET /api/health

Response:
{
  "status": "healthy|unhealthy",
  "database": "connected|disconnected"
}
```

### Error Logging
```javascript
// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});
```
