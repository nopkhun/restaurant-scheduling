'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Calculator, 
  Calendar, 
  Users, 
  TrendingUp, 
  FileText, 
  Clock,
  CheckCircle,
  AlertTriangle,
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { PayrollPeriods } from '@/components/payroll/payroll-periods';
import { PayrollCalculations } from '@/components/payroll/payroll-calculations';
import { PayrollSummary } from '@/components/payroll/payroll-summary';
import { toast } from 'sonner';

interface PayrollStats {
  currentPeriod: {
    id: string;
    description: string;
    status: string;
    totalEmployees: number;
    totalGross: number;
    totalNet: number;
    daysUntilPay: number;
  } | null;
  yearToDate: {
    totalPeriods: number;
    totalGross: number;
    totalNet: number;
    totalEmployees: number;
  };
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
    user: string;
  }>;
}

export default function PayrollDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<PayrollStats | null>(null);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const t = useTranslations();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payroll/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading payroll stats:', error);
      toast.error('Failed to load payroll statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'text-gray-600';
      case 'processing':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FileText className="h-4 w-4" />;
      case 'processing':
        return <Clock className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payroll Management</h1>
          <p className="text-gray-600">Manage employee payroll, calculations, and periods</p>
        </div>
      </div>

      {/* Overview Stats */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Current Period */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Period</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats.currentPeriod ? (
                <div>
                  <div className="text-2xl font-bold">
                    {stats.currentPeriod.totalEmployees}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.currentPeriod.description}
                  </p>
                  <div className={`flex items-center gap-1 mt-1 ${getStatusColor(stats.currentPeriod.status)}`}>
                    {getStatusIcon(stats.currentPeriod.status)}
                    <span className="text-xs capitalize">{stats.currentPeriod.status}</span>
                  </div>
                  {stats.currentPeriod.daysUntilPay > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      Pay in {stats.currentPeriod.daysUntilPay} days
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No active period</div>
              )}
            </CardContent>
          </Card>

          {/* Total Employees */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.yearToDate.totalEmployees}
              </div>
              <p className="text-xs text-muted-foreground">
                Year to date: {stats.yearToDate.totalPeriods} periods
              </p>
            </CardContent>
          </Card>

          {/* Gross Payroll */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Gross</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.currentPeriod ? formatCurrency(stats.currentPeriod.totalGross) : '—'}
              </div>
              <p className="text-xs text-muted-foreground">
                YTD: {formatCurrency(stats.yearToDate.totalGross)}
              </p>
            </CardContent>
          </Card>

          {/* Net Payroll */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Net</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.currentPeriod ? formatCurrency(stats.currentPeriod.totalNet) : '—'}
              </div>
              <p className="text-xs text-muted-foreground">
                YTD: {formatCurrency(stats.yearToDate.totalNet)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
          <TabsTrigger value="calculations">Calculations</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {stats.recentActivity.slice(0, 5).map((activity, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.description}</p>
                          <p className="text-xs text-gray-500">
                            {activity.user} • {new Date(activity.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No recent activity</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <button
                    onClick={() => setActiveTab('periods')}
                    className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">Create New Period</p>
                        <p className="text-sm text-gray-500">Set up a new payroll period</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('calculations')}
                    className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Calculator className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium">Run Calculations</p>
                        <p className="text-sm text-gray-500">Calculate payroll for employees</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('reports')}
                    className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="font-medium">Generate Reports</p>
                        <p className="text-sm text-gray-500">View payroll reports and summaries</p>
                      </div>
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Current Period Summary */}
          {stats?.currentPeriod && (
            <PayrollSummary 
              periodId={stats.currentPeriod.id}
              onRefresh={loadStats}
            />
          )}
        </TabsContent>

        <TabsContent value="periods">
          <PayrollPeriods onStatsUpdate={loadStats} />
        </TabsContent>

        <TabsContent value="calculations">
          <PayrollCalculations onStatsUpdate={loadStats} />
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Reports Coming Soon</p>
                <p>Comprehensive payroll reports and analytics will be available here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}