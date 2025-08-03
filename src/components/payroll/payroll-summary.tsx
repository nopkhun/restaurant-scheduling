'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { 
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface PayrollSummaryData {
  period: {
    id: string;
    period_start: string;
    period_end: string;
    cutoff_date: string;
    pay_date: string;
    status: string;
    notes?: string;
  };
  entries: Array<{
    id: string;
    employee_id: string;
    regular_hours: number;
    overtime_hours: number;
    holiday_hours: number;
    gross_salary: number;
    net_salary: number;
    status: string;
    employee?: {
      full_name: string;
      employee_id: string;
    };
  }>;
  summary: {
    totalEmployees: number;
    totalGrossSalary: number;
    totalNetSalary: number;
    totalDeductions: number;
    totalSocialSecurity: number;
    totalTax: number;
    totalAdvances: number;
    statusCounts: {
      draft: number;
      processing: number;
      completed: number;
      error: number;
    };
  };
}

interface PayrollSummaryProps {
  periodId: string;
  onRefresh: () => void;
}

export function PayrollSummary({ periodId, onRefresh }: PayrollSummaryProps) {
  const [data, setData] = useState<PayrollSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const t = useTranslations();

  useEffect(() => {
    loadSummary();
  }, [periodId]);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/payroll/periods/${periodId}`);
      if (response.ok) {
        const summaryData = await response.json();
        setData(summaryData);
      }
    } catch (error) {
      console.error('Error loading payroll summary:', error);
      toast.error('Failed to load payroll summary');
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="text-gray-600">Draft</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCompletionPercentage = () => {
    if (!data) return 0;
    const { statusCounts } = data.summary;
    const total = statusCounts.draft + statusCounts.processing + statusCounts.completed + statusCounts.error;
    if (total === 0) return 0;
    return (statusCounts.completed / total) * 100;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Period Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Period Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No payroll data available for this period</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const completionPercentage = getCompletionPercentage();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Current Period Summary
          </CardTitle>
          {getStatusBadge(data.period.status)}
        </div>
        <div className="text-sm text-gray-600">
          {format(parseISO(data.period.period_start), 'MMM d')} - {format(parseISO(data.period.period_end), 'MMM d, yyyy')}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Progress */}
          {data.summary.totalEmployees > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Payroll Completion</span>
                <span>{Math.round(completionPercentage)}%</span>
              </div>
              <Progress value={completionPercentage} className="w-full" />
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{data.summary.statusCounts.completed} of {data.summary.totalEmployees} completed</span>
                <span>Pay Date: {format(parseISO(data.period.pay_date), 'MMM d, yyyy')}</span>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-800">Employees</p>
                <p className="text-2xl font-bold text-blue-900">{data.summary.totalEmployees}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">Gross Total</p>
                <p className="text-xl font-bold text-green-900">
                  {formatCurrency(data.summary.totalGrossSalary)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
              <DollarSign className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-purple-800">Net Total</p>
                <p className="text-xl font-bold text-purple-900">
                  {formatCurrency(data.summary.totalNetSalary)}
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Financial Breakdown */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Financial Breakdown</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Gross Salary:</span>
                  <span className="font-mono">{formatCurrency(data.summary.totalGrossSalary)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Social Security:</span>
                  <span className="font-mono text-red-600">-{formatCurrency(data.summary.totalSocialSecurity)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax Deduction:</span>
                  <span className="font-mono text-red-600">-{formatCurrency(data.summary.totalTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Salary Advances:</span>
                  <span className="font-mono text-red-600">-{formatCurrency(data.summary.totalAdvances)}</span>
                </div>
                <hr />
                <div className="flex justify-between font-semibold">
                  <span>Net Salary:</span>
                  <span className="font-mono text-green-600">{formatCurrency(data.summary.totalNetSalary)}</span>
                </div>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Status Distribution</h4>
              <div className="space-y-2">
                {Object.entries(data.summary.statusCounts).map(([status, count]) => (
                  count > 0 && (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(status)}
                        <span className="text-sm capitalize">{status}</span>
                      </div>
                      <span className="font-mono text-sm">{count}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>

          {/* Recent Entries */}
          {data.entries.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Recent Entries</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {data.entries.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-sm">{entry.employee?.full_name}</p>
                        <p className="text-xs text-gray-500">
                          {entry.regular_hours + entry.overtime_hours + entry.holiday_hours}h total
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-medium">
                        {formatCurrency(entry.net_salary)}
                      </p>
                      {getStatusBadge(entry.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}