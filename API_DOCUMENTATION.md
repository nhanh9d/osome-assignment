# API Documentation

## Base URL
```
http://localhost:3000/api/v1
```

## Endpoints

### Health Check
- **GET** `/healthcheck`
- **Description**: Check if the service is running
- **Response**: 200 OK

### Tickets

#### List All Tickets
- **GET** `/tickets`
- **Description**: Returns all tickets in the system (no pagination)
- **Response**: Array of tickets with company and user details
```json
[
  {
    "id": 1,
    "type": "managementReport",
    "status": "open",
    "category": "accounting",
    "companyId": 1,
    "assigneeId": 1,
    "company": { ... },
    "assignee": { ... }
  }
]
```

#### Create Ticket
- **POST** `/tickets`
- **Description**: Creates a new ticket with automatic assignment
- **Request Body**:
```json
{
  "type": "managementReport|registrationAddressChange|strikeOff",
  "companyId": 1
}
```
- **Business Rules**:
  - `managementReport`: Assigned to Accountant (most recent if multiple)
  - `registrationAddressChange`: 
    - Assigned to Corporate Secretary
    - Falls back to Director if no Secretary exists
    - Throws error if multiple Secretaries/Directors
    - Throws error if duplicate open ticket exists
  - `strikeOff`: 
    - Assigned to Director
    - Resolves all other active tickets in the company
    - Throws error if multiple Directors exist

- **Response**: Created ticket details
- **Errors**:
  - 404: Company not found
  - 409: Business rule violations (duplicates, multiple assignees, no assignee)
  - 500: Internal server error

### Reports

#### Generate Reports (Async)
- **POST** `/reports`
- **Description**: Starts background processing of all reports
- **Response**: 202 Accepted
```json
{
  "message": "Report generation started",
  "status": "processing",
  "checkStatusAt": "/api/v1/reports"
}
```
- **Performance**: Returns immediately (< 10ms)

#### Generate Reports (Sync - Legacy)
- **POST** `/reports/sync`
- **Description**: Generates reports synchronously (blocks until complete)
- **Response**: 201 Created
```json
{
  "message": "finished"
}
```
- **Warning**: This endpoint blocks for several seconds

#### Check Report Status
- **GET** `/reports`
- **Description**: Check the status of report generation
- **Response**:
```json
{
  "accounts.csv": "finished in 2.65s (61 files)",
  "yearly.csv": "finished in 2.65s (61 files)",
  "fs.csv": "finished in 2.65s (61 files)"
}
```
- **Status Values**: 
  - `idle`: Not started
  - `processing`: In progress
  - `finished in Xs (N files)`: Completed
  - `error`: Failed

#### Get Performance Metrics
- **GET** `/reports/metrics`
- **Description**: Get detailed performance metrics for report generation
- **Response**:
```json
{
  "accounts": {
    "startTime": 123456.789,
    "endTime": 123459.789,
    "filesProcessed": 61,
    "duration": "3.00"
  },
  "yearly": { ... },
  "fs": { ... }
}
```

## Error Handling

All endpoints follow standard HTTP status codes:
- **200**: Success
- **201**: Created
- **202**: Accepted (async processing)
- **404**: Resource not found
- **409**: Conflict (business rule violation)
- **500**: Internal server error

Error responses include descriptive messages:
```json
{
  "statusCode": 409,
  "message": "Company already has an open registrationAddressChange ticket",
  "error": "Conflict"
}
```

## Performance Optimizations

### Reports Service
- **Async Processing**: Reports process in background without blocking
- **Parallel Processing**: All three reports run simultaneously
- **File Caching**: Files are cached in memory during processing
- **Stream Processing**: Large files are processed using streams
- **Batch Processing**: Files processed in batches of 5

### Response Times
- Async report generation: < 10ms response time
- Report processing: ~2-3 seconds in background
- Ticket creation: < 100ms

## Security Considerations

1. **Input Validation**: All inputs are validated using class-validator
2. **SQL Injection Protection**: Using Sequelize ORM with parameterized queries
3. **Error Messages**: Generic error messages for unexpected errors
4. **Logging**: Errors are logged server-side for debugging

## Rate Limiting

Currently not implemented. In production, consider adding:
- Rate limiting per IP
- Request throttling
- API key authentication