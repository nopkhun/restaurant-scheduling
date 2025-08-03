'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar, 
  DollarSign,
  Clock,
  Download,
  RefreshCw,
  Filter,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { format, subDays, subMonths } from 'date-fns';

interface ReportFilters {
  type: string;
  start_date: string;
  end_date: string;
  branch_id?: string;
  employee_id?: string;
  granularity: string;
}

interface Branch {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  full_name: string;
  employee_id?: string;
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  const [filters, setFilters] = useState<ReportFilters>({
    type: 'overview',
    start_date: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    granularity: 'monthly',
  });

  const { user } = useAuth();
  const t = useTranslations();

  useEffect(() => {
    loadBranches();
    loadEmployees();
    generateReport();
  }, []);

  const loadBranches = async () => {
    try {
      const response = await fetch('/api/branches');
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches || []);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/admin/users?limit=100');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.users || []);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`/api/admin/reports?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setReportData(data.report);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const setQuickDateRange = (range: string) => {
    const today = new Date();
    let startDate: Date;

    switch (range) {
      case 'week':
        startDate = subDays(today, 7);
        break;
      case 'month':
        startDate = subMonths(today, 1);
        break;
      case '3months':
        startDate = subMonths(today, 3);
        break;
      case 'year':
        startDate = subMonths(today, 12);
        break;
      default:
        startDate = subMonths(today, 1);
    }

    setFilters(prev => ({
      ...prev,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(today, 'yyyy-MM-dd'),
    }));
  };

  const exportReport = () => {
    if (!reportData) return;

    const exportData = {
      report: reportData,
      filters,
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${filters.type}-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'overview': return <BarChart3 className="h-5 w-5" />;
      case 'attendance': return <Clock className="h-5 w-5" />;
      case 'payroll': return <DollarSign className="h-5 w-5" />;
      case 'leave': return <Calendar className="h-5 w-5" />;
      case 'performance': return <TrendingUp className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Reports & Analytics
          </h1>
          <p className="text-gray-600">Generate comprehensive reports and insights</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportReport} disabled={!reportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={generateReport} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
            <div>
              <Label>Report Type</Label>
              <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Overview</SelectItem>
                  <SelectItem value="attendance">Attendance</SelectItem>
                  <SelectItem value="payroll">Payroll</SelectItem>
                  <SelectItem value="leave">Leave Requests</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
              />
            </div>
            <div>
              <Label>Branch</Label>
              <Select value={filters.branch_id || ''} onValueChange={(value) => handleFilterChange('branch_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Branches</SelectItem>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Employee</Label>
              <Select value={filters.employee_id || ''} onValueChange={(value) => handleFilterChange('employee_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Employees</SelectItem>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name} {employee.employee_id && `(${employee.employee_id})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Granularity</Label>
              <Select value={filters.granularity} onValueChange={(value) => handleFilterChange('granularity', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Quick Date Ranges */}
          <div className="flex gap-2">
            <Label className="text-sm text-gray-600">Quick ranges:</Label>
            <Button variant="outline" size="sm" onClick={() => setQuickDateRange('week')}>
              Last Week
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQuickDateRange('month')}>
              Last Month
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQuickDateRange('3months')}>
              Last 3 Months
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQuickDateRange('year')}>
              Last Year
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            <span className="ml-4 text-lg">Generating report...</span>
          </CardContent>
        </Card>
      ) : reportData ? (
        <div className="space-y-6">
          {/* Report Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getReportIcon(reportData.type)}
                {reportData.type.charAt(0).toUpperCase() + reportData.type.slice(1)} Report
              </CardTitle>
              <div className="text-sm text-gray-600">
                Period: {format(new Date(reportData.period.start), 'MMM d, yyyy')} - {format(new Date(reportData.period.end), 'MMM d, yyyy')}
                <span className="ml-4">Generated: {format(new Date(reportData.generated_at), 'MMM d, yyyy HH:mm')}</span>
              </div>
            </CardHeader>
          </Card>

          {/* Report-specific content */}
          {reportData.type === 'overview' && (
            <OverviewReportContent data={reportData} formatCurrency={formatCurrency} />
          )}
          {reportData.type === 'attendance' && (
            <AttendanceReportContent data={reportData} />
          )}
          {reportData.type === 'payroll' && (
            <PayrollReportContent data={reportData} formatCurrency={formatCurrency} />
          )}
          {reportData.type === 'leave' && (
            <LeaveReportContent data={reportData} />
          )}
          {reportData.type === 'performance' && (
            <PerformanceReportContent data={reportData} />
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12 text-gray-500">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg">No report generated yet</p>
            <p className="text-sm">Select your filters and click "Generate Report" to begin</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OverviewReportContent({ data, formatCurrency }: { data: any; formatCurrency: (amount: number) => string }) {
  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Employees</p>
                <p className="text-2xl font-bold">{data.summary.totalEmployees}</p>
                <p className="text-xs text-green-600">{data.summary.employeeUtilization}% active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Schedules</p>
                <p className="text-2xl font-bold">{data.summary.totalSchedules}</p>
                <p className="text-xs text-green-600">{data.summary.scheduleCompletionRate}% completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Leave Requests</p>
                <p className="text-2xl font-bold">{data.summary.totalLeaveRequests}</p>
                <p className="text-xs text-orange-600">{data.summary.pendingLeaveRequests} pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Total Payroll</p>
                <p className="text-lg font-bold">{formatCurrency(data.summary.payrollTotals.gross)}</p>
                <p className="text-xs text-gray-600">Net: {formatCurrency(data.summary.payrollTotals.net)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Role Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(data.roleDistribution).map(([role, count]: [string, any]) => (
              <div key={role} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm capitalize">{role}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Schedule Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(data.monthlyTrends).map(([month, stats]: [string, any]) => (
              <div key={month} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="font-medium">{format(new Date(month + '-01'), 'MMM yyyy')}</span>
                <div className="flex gap-4 text-sm">
                  <span>Total: <strong>{stats.total}</strong></span>
                  <span>Completed: <strong>{stats.completed}</strong></span>
                  <span className="text-green-600">
                    Rate: <strong>{stats.total ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}%</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function AttendanceReportContent({ data }: { data: any }) {
  return (
    <>
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold">{data.summary.totalEmployeesTracked}</p>
              <p className="text-sm">Employees Tracked</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold">{data.summary.averageHoursPerEmployee}h</p>
              <p className="text-sm">Avg Hours/Employee</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold">{data.summary.overallOnTimeRate}%</p>
              <p className="text-sm">On-Time Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Attendance */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Attendance Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Days Worked</TableHead>
                <TableHead>On Time</TableHead>
                <TableHead>Late Days</TableHead>
                <TableHead>Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.attendanceData.map((emp: any) => (
                <TableRow key={emp.employee.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{emp.employee.full_name}</div>
                      <div className="text-sm text-gray-500">{emp.employee.employee_id}</div>
                    </div>
                  </TableCell>
                  <TableCell>{emp.totalHours.toFixed(1)}h</TableCell>
                  <TableCell>{emp.totalDays}</TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 text-green-800">
                      {emp.onTimePercentage}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={emp.latePercentage > 20 ? 'destructive' : 'outline'}>
                      {emp.lateDays} ({emp.latePercentage}%)
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${emp.onTimePercentage}%` }}
                        />
                      </div>
                      <span className="text-sm">{emp.averageHoursPerDay}h/day</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function PayrollReportContent({ data, formatCurrency }: { data: any; formatCurrency: (amount: number) => string }) {
  return (
    <>
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-lg font-bold">{formatCurrency(data.totals.grossSalary)}</p>
              <p className="text-sm">Total Gross</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-lg font-bold">{formatCurrency(data.totals.netSalary)}</p>
              <p className="text-sm">Total Net</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold">{data.totals.regularHours + data.totals.overtimeHours}h</p>
              <p className="text-sm">Total Hours</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold">{data.summary.overtimePercentage}%</p>
              <p className="text-sm">Overtime Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Payroll */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Payroll Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Total Gross</TableHead>
                <TableHead>Total Net</TableHead>
                <TableHead>Avg Gross</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Entries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.employeeData.map((emp: any) => (
                <TableRow key={emp.employee.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{emp.employee.full_name}</div>
                      <div className="text-sm text-gray-500">{emp.employee.employee_id}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{formatCurrency(emp.totalGross)}</TableCell>
                  <TableCell className="font-mono">{formatCurrency(emp.totalNet)}</TableCell>
                  <TableCell className="font-mono">{formatCurrency(parseFloat(emp.averageGross))}</TableCell>
                  <TableCell>{emp.totalHours.toFixed(1)}h</TableCell>
                  <TableCell>{emp.entryCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function LeaveReportContent({ data }: { data: any }) {
  return (
    <>
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Requests Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold">{data.summary.totalRequests}</p>
              <p className="text-sm">Total Requests</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold">{data.summary.approvedRequests}</p>
              <p className="text-sm">Approved</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold">{data.summary.pendingRequests}</p>
              <p className="text-sm">Pending</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold">{data.summary.rejectedRequests}</p>
              <p className="text-sm">Rejected</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold">{data.summary.approvalRate}%</p>
              <p className="text-sm">Approval Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leave Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Type Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(data.leaveTypeStats).map(([type, stats]: [string, any]) => (
              <div key={type} className="p-4 border rounded-lg">
                <h4 className="font-medium capitalize mb-2">{type}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-medium">{stats.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Approved:</span>
                    <span className="font-medium text-green-600">{stats.approved}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Days Taken:</span>
                    <span className="font-medium">{stats.totalDays}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Employee Leave Details */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Leave Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Total Requests</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Days Taken</TableHead>
                <TableHead>Approval Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.employeeData.map((emp: any) => (
                <TableRow key={emp.employee.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{emp.employee.full_name}</div>
                      <div className="text-sm text-gray-500">{emp.employee.employee_id}</div>
                    </div>
                  </TableCell>
                  <TableCell>{emp.totalRequests}</TableCell>
                  <TableCell>{emp.approvedRequests}</TableCell>
                  <TableCell>{emp.totalDaysTaken}</TableCell>
                  <TableCell>
                    <Badge className={emp.approvalRate > 80 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {emp.approvalRate}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function PerformanceReportContent({ data }: { data: any }) {
  return (
    <>
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold">{data.summary.totalSchedules}</p>
              <p className="text-sm">Total Schedules</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold">{data.summary.completedSchedules}</p>
              <p className="text-sm">Completed</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold">{data.summary.cancelledSchedules}</p>
              <p className="text-sm">Cancelled</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold">{data.summary.overallCompletionRate}%</p>
              <p className="text-sm">Completion Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Total Scheduled</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Completion Rate</TableHead>
                <TableHead>Reliability Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.employeePerformance.map((emp: any) => (
                <TableRow key={emp.employee.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{emp.employee.full_name}</div>
                      <div className="text-sm text-gray-500">{emp.employee.employee_id}</div>
                    </div>
                  </TableCell>
                  <TableCell>{emp.totalScheduled}</TableCell>
                  <TableCell>{emp.completed}</TableCell>
                  <TableCell>
                    <Badge className={emp.completionRate > 90 ? 'bg-green-100 text-green-800' : emp.completionRate > 70 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                      {emp.completionRate}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${emp.reliabilityScore}%` }}
                        />
                      </div>
                      <span className="text-sm">{emp.reliabilityScore}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Department Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Department Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.departmentPerformance.map((dept: any) => (
              <div key={dept.branch} className="p-4 border rounded-lg">
                <h4 className="font-medium mb-3">{dept.branch}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Schedules:</span>
                    <span className="font-medium">{dept.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed:</span>
                    <span className="font-medium text-green-600">{dept.completed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completion Rate:</span>
                    <Badge className={dept.completionRate > 90 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {dept.completionRate}%
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}