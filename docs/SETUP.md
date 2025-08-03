# Environment Setup Guide

This guide will walk you through setting up the Restaurant Scheduling System from scratch.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+**: [Download here](https://nodejs.org/)
- **npm, yarn, or pnpm**: Package manager (npm comes with Node.js)
- **Git**: [Download here](https://git-scm.com/)
- **Modern web browser**: Chrome, Firefox, Safari, or Edge

## 1. Clone the Repository

```bash
git clone <repository-url>
cd restaurant-scheduling
```

## 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

## 3. Set Up Supabase

### 3.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up for a free account
3. Create a new project
4. Choose a region close to your location
5. Set a strong database password

### 3.2 Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (starts with `https://`)
   - **Anon public key** (starts with `eyJ`)
   - **Service role key** (starts with `eyJ`) - found under "Service role"

### 3.3 Configure Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Create a new query and paste the contents of `supabase/schema.sql`
3. Run the query to create all tables and policies
4. Go to **Authentication** → **Settings** and enable email confirmation if desired

## 4. Environment Configuration

### 4.1 Create Environment File

```bash
cp .env.example .env.local
```

### 4.2 Configure Environment Variables

Edit `.env.local` with your actual values:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google Chat Integration (Optional)
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/your-space/messages?key=your-key&token=your-token
```

### 4.3 Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ |
| `NEXT_PUBLIC_APP_URL` | Your app's URL | ✅ |
| `GOOGLE_CHAT_WEBHOOK_URL` | Google Chat webhook for notifications | ❌ |

## 5. Google Chat Integration (Optional)

### 5.1 Create a Google Chat Webhook

1. Open Google Chat
2. Go to the space where you want notifications
3. Click on the space name → **Manage webhooks**
4. Click **Add webhook**
5. Give it a name like "Restaurant Scheduling"
6. Copy the webhook URL
7. Add it to your `.env.local` file

### 5.2 Test the Integration

Once configured, the system will send notifications for:
- Employee clock in/out
- Schedule changes
- Leave requests
- Payroll completion

## 6. Database Initialization

### 6.1 Create Initial Admin User

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Go to `http://localhost:3000/register`

3. Create your first admin account:
   - Email: `admin@yourcompany.com`
   - Password: (choose a strong password)
   - Full Name: Your name
   - Employee ID: `ADMIN001`
   - Role: Admin

### 6.2 Set Up Initial Data

1. Log in as admin
2. Go to **Admin** → **Settings**
3. Configure company information:
   - Company name
   - Contact details
   - Working hours
   - Payroll settings

4. Create branches:
   - Go to **Admin** → **Branches**
   - Add your restaurant locations with GPS coordinates

5. Create employee accounts:
   - Go to **Admin** → **Users**
   - Add employees with appropriate roles

## 7. Development Server

Start the development server:

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## 8. Testing Setup

### 8.1 Run Tests

```bash
# Unit and integration tests
npm test

# E2E tests (requires development server to be running)
npm run test:e2e

# Test coverage
npm run test:coverage
```

### 8.2 E2E Testing Setup

The E2E tests use Playwright. If it's your first time running them:

```bash
npx playwright install
```

## 9. Production Deployment

### 9.1 Vercel Deployment (Recommended)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Configure environment variables in Vercel dashboard

### 9.2 Docker Deployment

1. Build the Docker image:
   ```bash
   docker build -t restaurant-scheduling .
   ```

2. Run the container:
   ```bash
   docker run -p 3000:3000 \
     -e NEXT_PUBLIC_SUPABASE_URL=your-url \
     -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
     -e SUPABASE_SERVICE_ROLE_KEY=your-service-key \
     restaurant-scheduling
   ```

3. Or use Docker Compose:
   ```bash
   docker-compose up -d
   ```

### 9.3 Environment Variables for Production

For production, update these variables:

```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## 10. System Configuration

### 10.1 Location Verification

Configure GPS settings in **Admin** → **Settings** → **Time & Attendance**:

- **Location Verification**: Enable/disable GPS checking
- **Verification Radius**: Distance allowed from workplace (meters)
- **GPS Accuracy**: Minimum accuracy required (meters)

### 10.2 Payroll Settings

Configure payroll in **Admin** → **Settings** → **Payroll**:

- **Pay Frequency**: Weekly, bi-weekly, or monthly
- **Currency**: THB, USD, or EUR
- **Tax Rate**: Percentage for income tax
- **Social Security Rate**: Percentage for social security
- **Overtime Threshold**: Hours per week before overtime

### 10.3 Notification Settings

Configure notifications in **Admin** → **Settings** → **Notifications**:

- **Email Notifications**: Enable/disable email alerts
- **Google Chat Notifications**: Enable/disable Chat integration
- **Notification Sender**: Email address for system notifications

## 11. User Roles and Permissions

### 11.1 Role Hierarchy

1. **Admin**: Full system access
   - All settings and configuration
   - User management
   - Financial data access

2. **HR**: Human resources functions
   - Employee management
   - Leave requests
   - Schedule oversight

3. **Accounting**: Financial operations
   - Payroll management
   - Salary advances
   - Financial reports

4. **Manager**: Branch operations
   - Local team management
   - Schedule creation
   - Basic reports

5. **Employee**: Self-service features
   - Personal schedule
   - Time tracking
   - Leave requests

### 11.2 Setting Up Users

For each new user:

1. Go to **Admin** → **Users**
2. Click **Add User**
3. Fill in required information:
   - Email (must be unique)
   - Full name
   - Employee ID (must be unique)
   - Phone number
   - Role
   - Branch assignment

4. The system will send login credentials to the user's email

## 12. Backup and Security

### 12.1 Database Backups

Supabase automatically backs up your database, but you can also:

1. Go to Supabase dashboard → **Settings** → **Database**
2. Use the backup tools or download database dumps
3. Set up automated backups if needed

### 12.2 Security Best Practices

1. **Strong Passwords**: Enforce password requirements in settings
2. **Regular Updates**: Keep dependencies updated
3. **Access Control**: Use appropriate roles for each user
4. **Environment Variables**: Never commit secrets to version control
5. **HTTPS**: Always use HTTPS in production
6. **Rate Limiting**: Configure rate limits in nginx or reverse proxy

## 13. Monitoring and Maintenance

### 13.1 Health Checks

The application includes health check endpoints:

- `/api/health`: Basic application health
- `/health`: Nginx health check (if using)

### 13.2 Logs and Debugging

- Application logs are visible in the server console
- Supabase provides database logs in the dashboard
- Use browser developer tools for client-side debugging

### 13.3 Performance Monitoring

Consider integrating:
- **Sentry**: Error tracking and performance monitoring
- **Google Analytics**: User behavior tracking
- **Vercel Analytics**: Performance insights (if using Vercel)

## 14. Troubleshooting

### 14.1 Common Issues

**Problem**: "Module not found" errors
**Solution**: Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

**Problem**: Supabase connection errors
**Solution**: Check environment variables and network connectivity

**Problem**: Location verification not working
**Solution**: Ensure HTTPS in production (required for geolocation API)

**Problem**: Tests failing
**Solution**: Check Jest configuration and mock setups

### 14.2 Getting Help

- Check the [API documentation](./API.md)
- Review error messages in browser console
- Check Supabase dashboard for database errors
- Create an issue in the repository

## 15. Advanced Configuration

### 15.1 Custom Themes

The application uses Tailwind CSS. To customize:

1. Edit `tailwind.config.js`
2. Modify CSS variables in `src/app/globals.css`
3. Update component styles as needed

### 15.2 Additional Integrations

The system is designed to be extensible:

- **SMS Notifications**: Add SMS provider integration
- **Email Services**: Configure SMTP or email service providers
- **Reporting Tools**: Integrate with BI tools or data warehouses
- **HR Systems**: Connect with existing HR software

### 15.3 Scaling Considerations

For larger deployments:

- Use Redis for session storage and caching
- Consider database read replicas
- Implement CDN for static assets
- Use load balancers for multiple instances
- Monitor database performance and optimize queries

This completes the setup guide. For additional help, refer to the README.md and API documentation.