# Restaurant Scheduling System

A comprehensive employee scheduling and time tracking system built for restaurants and hospitality businesses. Features GPS-verified time tracking, payroll management, and real-time schedule coordination.

## 🚀 Features

### 📅 Schedule Management
- **Calendar View**: Monthly, weekly, and daily schedule views
- **Shift Management**: Create, edit, and delete shifts
- **Multi-branch Support**: Manage multiple restaurant locations
- **Real-time Updates**: Live schedule synchronization

### ⏰ Time Tracking
- **GPS Verification**: Location-verified clock in/out with anti-spoofing
- **Accuracy Control**: Configurable GPS accuracy requirements
- **Manual Override**: Admin override for location issues
- **Break Tracking**: Automatic break reminders for long shifts

### 👥 Employee Self-Service
- **Shift Swapping**: Request and approve shift swaps between employees
- **Leave Requests**: Submit and manage vacation/sick leave requests
- **Salary Advances**: Request salary advances with approval workflow
- **Schedule Viewing**: Personal schedule access and notifications

### 💰 Payroll Management
- **Thai Labor Law Compliance**: Accurate overtime and tax calculations
- **Automated Calculations**: Regular hours, overtime, holiday pay
- **Payslip Generation**: PDF payslips with detailed breakdowns
- **Export Options**: JSON, Excel, and PDF export formats

### 🔗 Google Chat Integration
- **Automated Notifications**: Schedule changes and payslip delivery
- **Real-time Alerts**: Clock in/out notifications for managers
- **Shift Reminders**: Automated shift reminder messages

### 🛡️ Security & Administration
- **Role-based Access Control**: Admin, HR, Accounting, Manager, Employee roles
- **Audit Logging**: Complete system activity tracking
- **System Settings**: Comprehensive configuration management
- **Multi-language Support**: English and Thai language support

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth
- **Testing**: Jest, React Testing Library, Playwright
- **Deployment**: Vercel-ready with Docker support

## 📋 Prerequisites

- Node.js 18+ 
- npm/yarn/pnpm
- Supabase project
- Google Chat webhook (for notifications)

## ⚙️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/nopkhun/restaurant-scheduling.git
   cd restaurant-scheduling
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   
   Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```

   Configure your environment variables:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # Google Chat Integration
   GOOGLE_CHAT_WEBHOOK_URL=your_google_chat_webhook_url

   # App Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Database Setup**
   
   Run the database migrations:
   ```bash
   npm run db:setup
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

## 🗄️ Database Schema

The system uses PostgreSQL with the following main tables:

- **profiles**: User profiles and role management
- **branches**: Restaurant branch locations
- **schedules**: Employee shift schedules  
- **time_entries**: Clock in/out records
- **leave_requests**: Employee leave applications
- **shift_swaps**: Shift exchange requests
- **salary_advances**: Salary advance requests
- **payroll_periods**: Payroll period management
- **payroll_entries**: Individual employee payroll records
- **system_settings**: Configurable system parameters
- **system_logs**: Audit trail and activity logs

## 🔐 Authentication & Roles

### User Roles

1. **Admin**: Full system access
   - User management
   - System settings
   - All financial data

2. **HR**: Human resources management
   - Employee data
   - Leave management
   - Schedule oversight

3. **Accounting**: Financial operations
   - Payroll management
   - Salary advances
   - Financial reports

4. **Manager**: Branch operations
   - Branch-specific schedules
   - Local team management
   - Basic reports

5. **Employee**: Self-service features
   - Personal schedule
   - Time tracking
   - Leave requests
   - Shift swaps

## 🧪 Testing

The project includes comprehensive testing:

### Run Tests
```bash
# Unit and integration tests
npm test

# E2E tests  
npm run test:e2e

# Test coverage
npm run test:coverage
```

### Test Structure
- **Unit Tests**: `/src/**/__tests__/`
- **Integration Tests**: `/src/app/api/**/__tests__/`
- **E2E Tests**: `/e2e/`

## 📱 Usage

### For Employees
1. **Login**: Use provided credentials
2. **View Schedule**: Check upcoming shifts
3. **Clock In/Out**: Use location-verified time tracking
4. **Request Leave**: Submit vacation/sick leave requests
5. **Swap Shifts**: Request shift exchanges with colleagues

### For Managers
1. **Create Schedules**: Assign shifts to employees
2. **Approve Requests**: Handle leave and shift swap requests
3. **Monitor Attendance**: Track employee clock in/out times
4. **View Reports**: Access team performance metrics

### For Administrators
1. **User Management**: Create and manage employee accounts
2. **System Settings**: Configure system parameters
3. **Payroll Processing**: Generate and manage payroll
4. **Reports**: Access comprehensive analytics

## 🌍 Internationalization

The system supports multiple languages:
- **English**: Default language
- **Thai**: Full Thai language support

Language can be configured in system settings or per-user preferences.

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Deploy to Vercel**
   ```bash
   vercel deploy
   ```

2. **Environment Variables**
   Configure the same environment variables in your Vercel dashboard.

### Docker Deployment

1. **Build Docker Image**
   ```bash
   docker build -t restaurant-scheduling .
   ```

2. **Run Container**
   ```bash
   docker run -p 3000:3000 \
     -e NEXT_PUBLIC_SUPABASE_URL=your_url \
     -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
     restaurant-scheduling
   ```

## 📊 System Configuration

### Location Verification Settings
- **Radius**: Set acceptable distance from workplace (default: 50m)
- **Accuracy**: Minimum GPS accuracy required (default: 50m)
- **Override**: Allow manual clock in without location

### Payroll Settings
- **Pay Frequency**: Weekly, bi-weekly, or monthly
- **Tax Rates**: Configurable tax percentages
- **Overtime Rules**: Hours threshold and multipliers
- **Social Security**: Contribution rates and caps

### Notification Settings
- **Email**: SMTP configuration for email notifications
- **Google Chat**: Webhook integration for team notifications
- **SMS**: Optional SMS notification service

## 🔧 Development

### Project Structure
```
src/
├── app/                    # Next.js 15 App Router
│   ├── api/               # API routes
│   ├── [locale]/          # Internationalized pages
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/                # shadcn/ui components
│   ├── auth/              # Authentication components
│   ├── schedule/          # Schedule management
│   ├── timesheet/         # Time tracking
│   └── payroll/           # Payroll components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
│   ├── auth/              # Authentication utilities
│   ├── location/          # GPS and location services
│   ├── payroll/           # Payroll calculations
│   └── supabase/          # Database client
├── types/                 # TypeScript type definitions
└── validations/           # Zod schemas
```

### Code Style
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **Tailwind CSS**: Utility-first styling

### Contributing
1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the documentation in `/docs`
- Review the API documentation

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with Next.js and Supabase
- UI components from shadcn/ui
- Icons from Lucide React
- Testing with Jest and Playwright
