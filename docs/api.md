# API Documentation

## Authentication Endpoints

### Register User
```http
POST /api/register
Content-Type: application/json

{
  "username": "string",
  "password": "string",
  "role": "viewer" | "operator" | "admin"
}
```

### Login
```http
POST /api/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

### Logout
```http
POST /api/logout
```

### Get Current User
```http
GET /api/user
```

## Train Management

### Get All Trains
```http
GET /api/trains
```

Response:
```json
[
  {
    "id": "number",
    "trainNumber": "string",
    "description": "string",
    "type": "express" | "local" | "freight" | "special"
  }
]
```

## Location Management

### Get All Locations
```http
GET /api/locations
```

Response:
```json
[
  {
    "id": "number",
    "name": "string",
    "code": "string"
  }
]
```

## Schedule Management

### Get Schedules
```http
GET /api/schedules
```

Query Parameters:
- startDate (optional): ISO date string
- endDate (optional): ISO date string

### Create Schedule
```http
POST /api/schedules
Content-Type: application/json

{
  "trainId": "number",
  "departureLocationId": "number",
  "arrivalLocationId": "number",
  "scheduledDeparture": "ISO date string",
  "scheduledArrival": "ISO date string",
  "status": "string",
  "isCancelled": "boolean"
}
```

### Update Schedule
```http
PATCH /api/schedules/:id
Content-Type: application/json

{
  "status": "string",
  "actualDeparture": "ISO date string",
  "actualArrival": "ISO date string",
  "isCancelled": "boolean"
}
```

### Delete Schedule
```http
DELETE /api/schedules/:id
```

### Import Schedules
```http
POST /api/schedules/import
Content-Type: multipart/form-data

file: Excel file
```

## Analytics

### Get Schedule Metrics
```http
GET /api/analytics/schedule-metrics
```

Response:
```json
{
  "overview": {
    "total": "number",
    "delayed": "number",
    "cancelled": "number"
  },
  "trainUtilization": [
    {
      "trainId": "number",
      "trainNumber": "string",
      "scheduleCount": "number"
    }
  ],
  "routePerformance": [
    {
      "departureId": "number",
      "departureName": "string",
      "arrivalId": "number",
      "totalTrips": "number",
      "delayedTrips": "number",
      "avgDelayMinutes": "number",
      "peakHourTrips": "number"
    }
  ]
}
```

## WebSocket Events

### Client → Server

#### Update Schedule
```javascript
socket.emit('updateSchedule', {
  id: number,
  status: string,
  actualDeparture?: string,
  actualArrival?: string
});
```

### Server → Client

#### Schedule Updated
```javascript
socket.on('scheduleUpdated', (schedule) => {
  // Handle updated schedule
});
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "string"
}
```

### 401 Unauthorized
```json
{
  "error": "Not authenticated"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```
