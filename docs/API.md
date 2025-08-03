# API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

All API endpoints require authentication via Supabase session cookies. Users must be logged in to access any API endpoints.

### Headers
```
Content-Type: application/json
Cookie: supabase-auth-token=<session-token>
```

## Role-Based Access Control

API endpoints are protected by role-based access control:

- **Admin**: Full access to all endpoints
- **HR**: Access to employee management, schedules, leave requests
- **Accounting**: Access to payroll, salary advances, financial reports
- **Manager**: Access to branch-specific data and team management
- **Employee**: Access to personal data and self-service features

## Authentication Endpoints

### POST /api/auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "employee"
  },
  "message": "Login successful"
}
```

### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "phone": "+66812345678",
  "employee_id": "EMP001",
  "role": "employee",
  "branch_id": "uuid"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "message": "Registration successful"
}
```

### POST /api/auth/logout
Logout current user.

**Response:**
```json
{
  "message": "Logout successful"
}
```

## Schedule Management

### GET /api/schedules
Get schedules with optional filtering.

**Query Parameters:**
- `start_date` (string): Filter by start date (YYYY-MM-DD)
- `end_date` (string): Filter by end date (YYYY-MM-DD)
- `branch_id` (string): Filter by branch ID
- `employee_id` (string): Filter by employee ID

**Response:**
```json
{
  "schedules": [
    {
      "id": "uuid",
      "employee_id": "uuid",
      "branch_id": "uuid",
      "shift_date": "2024-01-15",
      "start_time": "09:00:00",
      "end_time": "17:00:00",
      "break_duration": 60,
      "notes": "Morning shift",
      "employee": {
        "full_name": "John Doe",
        "employee_id": "EMP001"
      },
      "branch": {
        "name": "Main Branch"
      }
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "totalPages": 10
  }
}
```

### POST /api/schedules
Create a new schedule.

**Required Role:** Manager, HR, Admin

**Request Body:**
```json
{
  "employee_id": "uuid",
  "branch_id": "uuid",
  "shift_date": "2024-01-15",
  "start_time": "09:00:00",
  "end_time": "17:00:00",
  "break_duration": 60,
  "notes": "Morning shift"
}
```

### PUT /api/schedules/[id]
Update an existing schedule.

**Required Role:** Manager, HR, Admin

**Request Body:**
```json
{
  "start_time": "08:00:00",
  "end_time": "16:00:00",
  "notes": "Updated morning shift"
}
```

### DELETE /api/schedules/[id]
Delete a schedule.

**Required Role:** Manager, HR, Admin

## Time Tracking

### GET /api/timesheet/active
Get the current active time entry for the logged-in user.

**Response:**
```json
{
  "time_entry": {
    "id": "uuid",
    "schedule_id": "uuid",
    "clock_in_time": "2024-01-15T09:00:00Z",
    "clock_out_time": null,
    "clock_in_location": {
      "latitude": 13.7563,
      "longitude": 100.5018
    },
    "clock_in_accuracy": 15,
    "location_verified": true
  }
}
```

### POST /api/timesheet/clock-in
Clock in for a shift.

**Request Body:**
```json
{
  "location": {
    "latitude": 13.7563,
    "longitude": 100.5018
  },
  "accuracy": 15,
  "notes": "Starting shift"
}
```

**Response:**
```json
{
  "time_entry": {
    "id": "uuid",
    "clock_in_time": "2024-01-15T09:00:00Z",
    "location_verified": true
  },
  "message": "Clocked in successfully",
  "location_verification": {
    "verified": true,
    "distance": 25,
    "accuracy": 15
  }
}
```

### POST /api/timesheet/clock-out
Clock out from a shift.

**Request Body:**
```json
{
  "location": {
    "latitude": 13.7563,
    "longitude": 100.5018
  },
  "accuracy": 15,
  "notes": "End of shift"
}
```

**Response:**
```json
{
  "time_entry": {
    "id": "uuid",
    "clock_in_time": "2024-01-15T09:00:00Z",
    "clock_out_time": "2024-01-15T17:00:00Z",
    "total_hours": 8.0
  },
  "message": "Clocked out successfully"
}
```

### GET /api/timesheet/entries
Get timesheet entries with filtering.

**Query Parameters:**
- `start_date` (string): Filter by start date
- `end_date` (string): Filter by end date
- `employee_id` (string): Filter by employee (admin/manager only)

**Response:**
```json
{
  "entries": [
    {
      "id": "uuid",
      "shift_date": "2024-01-15",
      "clock_in_time": "2024-01-15T09:00:00Z",
      "clock_out_time": "2024-01-15T17:00:00Z",
      "total_hours": 8.0,
      "status": "completed"
    }
  ]
}
```

## Leave Management

### GET /api/leave-requests
Get leave requests.

**Query Parameters:**
- `status` (string): Filter by status (pending, approved, rejected)
- `employee_id` (string): Filter by employee

**Response:**
```json
{
  "requests": [
    {
      "id": "uuid",
      "employee_id": "uuid",
      "leave_type": "annual",
      "start_date": "2024-01-20",
      "end_date": "2024-01-22",
      "total_days": 3,
      "reason": "Family vacation",
      "status": "pending",
      "employee": {
        "full_name": "John Doe"
      }
    }
  ]
}
```

### POST /api/leave-requests
Submit a new leave request.

**Request Body:**
```json
{
  "leave_type": "annual",
  "start_date": "2024-01-20",
  "end_date": "2024-01-22",
  "reason": "Family vacation"
}
```

### PUT /api/leave-requests/[id]
Update leave request status (approve/reject).

**Required Role:** Manager, HR, Admin

**Request Body:**
```json
{
  "status": "approved",
  "admin_notes": "Approved for vacation"
}
```

## Shift Swaps

### GET /api/shift-swaps
Get shift swap requests.

**Response:**
```json
{
  "swaps": [
    {
      "id": "uuid",
      "requesting_employee_id": "uuid",
      "target_employee_id": "uuid",
      "requesting_schedule_id": "uuid",
      "target_schedule_id": "uuid",
      "status": "pending",
      "requesting_employee": {
        "full_name": "John Doe"
      },
      "target_employee": {
        "full_name": "Jane Smith"
      }
    }
  ]
}
```

### POST /api/shift-swaps
Request a shift swap.

**Request Body:**
```json
{
  "target_employee_id": "uuid",
  "requesting_schedule_id": "uuid",
  "target_schedule_id": "uuid",
  "reason": "Family emergency"
}
```

### PUT /api/shift-swaps/[id]
Respond to a shift swap request.

**Request Body:**
```json
{
  "status": "approved"
}
```

## Payroll Management

### GET /api/payroll/periods
Get payroll periods.

**Required Role:** Accounting, Admin

**Response:**
```json
{
  "periods": [
    {
      "id": "uuid",
      "period_start": "2024-01-01",
      "period_end": "2024-01-31",
      "status": "draft",
      "total_gross": 150000.00,
      "total_net": 120000.00
    }
  ]
}
```

### POST /api/payroll/calculate
Calculate payroll for a period.

**Required Role:** Accounting, Admin

**Request Body:**
```json
{
  "period_start": "2024-01-01",
  "period_end": "2024-01-31",
  "branch_ids": ["uuid1", "uuid2"]
}
```

### GET /api/payroll/periods/[id]
Get detailed payroll information for a period.

**Required Role:** Accounting, Admin

**Response:**
```json
{
  "period": {
    "id": "uuid",
    "period_start": "2024-01-01",
    "period_end": "2024-01-31",
    "status": "draft"
  },
  "entries": [
    {
      "id": "uuid",
      "employee_id": "uuid",
      "regular_hours": 160,
      "overtime_hours": 20,
      "gross_salary": 30000,
      "net_salary": 25000,
      "employee": {
        "full_name": "John Doe"
      }
    }
  ]
}
```

### GET /api/payroll/payslips/[id]
Get individual payslip.

**Response:**
```json
{
  "payslip": {
    "id": "uuid",
    "employee_id": "uuid",
    "period_start": "2024-01-01",
    "period_end": "2024-01-31",
    "regular_hours": 160,
    "overtime_hours": 20,
    "gross_salary": 30000,
    "deductions": {
      "tax": 1500,
      "social_security": 750
    },
    "net_salary": 25000
  }
}
```

## Salary Advances

### GET /api/salary-advances
Get salary advance requests.

**Response:**
```json
{
  "advances": [
    {
      "id": "uuid",
      "employee_id": "uuid",
      "amount": 5000,
      "reason": "Medical expenses",
      "status": "pending",
      "employee": {
        "full_name": "John Doe"
      }
    }
  ]
}
```

### POST /api/salary-advances
Request a salary advance.

**Request Body:**
```json
{
  "amount": 5000,
  "reason": "Medical expenses",
  "repayment_months": 3
}
```

## User Management

### GET /api/admin/users
Get all users with filtering.

**Required Role:** Admin, HR

**Query Parameters:**
- `role` (string): Filter by role
- `branch_id` (string): Filter by branch
- `search` (string): Search by name or email

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "employee_id": "EMP001",
      "role": "employee",
      "branch_id": "uuid",
      "is_active": true
    }
  ]
}
```

### POST /api/admin/users
Create a new user.

**Required Role:** Admin, HR

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "employee_id": "EMP001",
  "role": "employee",
  "branch_id": "uuid"
}
```

### PUT /api/admin/users/[id]
Update user information.

**Required Role:** Admin, HR

**Request Body:**
```json
{
  "full_name": "John Smith",
  "role": "manager",
  "is_active": false
}
```

## System Settings

### GET /api/admin/settings
Get system settings.

**Required Role:** Admin

**Response:**
```json
{
  "settings": {
    "company_name": "Restaurant Name",
    "default_work_hours": 8,
    "overtime_threshold": 40,
    "require_location_verification": true,
    "location_verification_radius_meters": 50
  }
}
```

### PATCH /api/admin/settings
Update system settings.

**Required Role:** Admin

**Request Body:**
```json
{
  "company_name": "New Restaurant Name",
  "overtime_threshold": 45,
  "require_location_verification": false
}
```

## Reports

### GET /api/admin/reports/attendance
Get attendance reports.

**Required Role:** Manager, HR, Admin

**Query Parameters:**
- `start_date` (string): Report start date
- `end_date` (string): Report end date
- `branch_id` (string): Filter by branch
- `employee_id` (string): Filter by employee

**Response:**
```json
{
  "report": {
    "period": {
      "start_date": "2024-01-01",
      "end_date": "2024-01-31"
    },
    "summary": {
      "total_employees": 25,
      "total_hours": 4000,
      "average_hours_per_employee": 160
    },
    "employees": [
      {
        "employee_id": "uuid",
        "full_name": "John Doe",
        "total_hours": 160,
        "overtime_hours": 20,
        "attendance_rate": 95.5
      }
    ]
  }
}
```

### GET /api/admin/reports/payroll
Get payroll reports.

**Required Role:** Accounting, Admin

**Response:**
```json
{
  "report": {
    "total_gross": 500000,
    "total_net": 400000,
    "total_deductions": 100000,
    "by_department": [
      {
        "branch_name": "Main Branch",
        "employee_count": 15,
        "total_gross": 300000
      }
    ]
  }
}
```

## Error Handling

All API endpoints return standardized error responses:

### 400 Bad Request
```json
{
  "error": "Invalid request data",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Rate Limiting

API endpoints are rate limited to prevent abuse:
- **Authentication endpoints**: 5 requests per minute
- **General endpoints**: 100 requests per minute
- **Report endpoints**: 10 requests per minute

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)

**Response includes pagination metadata:**
```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Webhooks

The system supports webhooks for real-time notifications:

### Google Chat Integration
Configure webhook URL in system settings to receive:
- Schedule changes
- Clock in/out notifications
- Leave request notifications
- Payroll completion alerts

### Webhook Payload Example
```json
{
  "event": "employee_clocked_in",
  "timestamp": "2024-01-15T09:00:00Z",
  "data": {
    "employee_name": "John Doe",
    "branch_name": "Main Branch",
    "clock_in_time": "09:00:00"
  }
}
```