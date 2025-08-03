'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { 
  FileText, 
  Plus, 
  Filter, 
  RefreshCw,
  Clock,
  Calendar,
  DollarSign,
  ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ShiftSwapRequests } from '@/components/requests/shift-swap-requests';
import { LeaveRequests } from '@/components/requests/leave-requests';
import { SalaryAdvanceRequests } from '@/components/requests/salary-advance-requests';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface RequestStats {
  shiftSwaps: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
  leave: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
  advances: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
}

export default function RequestsPage() {
  const [activeTab, setActiveTab] = useState<'shifts' | 'leave' | 'advances'>('shifts');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RequestStats>({
    shiftSwaps: { pending: 0, approved: 0, rejected: 0, total: 0 },
    leave: { pending: 0, approved: 0, rejected: 0, total: 0 },
    advances: { pending: 0, approved: 0, rejected: 0, total: 0 },
  });

  const { user, getUserRole } = useAuth();
  const t = useTranslations();
  const userRole = getUserRole();

  const canCreateRequests = ['employee', 'manager', 'hr', 'admin'].includes(userRole);
  const canApproveRequests = ['manager', 'hr', 'admin'].includes(userRole);

  // Load initial data
  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      
      const [shiftSwapResponse, leaveResponse, advanceResponse] = await Promise.all([
        fetch('/api/requests/shift-swaps/stats'),
        fetch('/api/requests/leave/stats'),
        fetch('/api/requests/salary-advances/stats'),
      ]);

      const shiftSwapStats = shiftSwapResponse.ok ? await shiftSwapResponse.json() : { stats: { pending: 0, approved: 0, rejected: 0, total: 0 } };
      const leaveStats = leaveResponse.ok ? await leaveResponse.json() : { stats: { pending: 0, approved: 0, rejected: 0, total: 0 } };
      const advanceStats = advanceResponse.ok ? await advanceResponse.json() : { stats: { pending: 0, approved: 0, rejected: 0, total: 0 } };

      setStats({
        shiftSwaps: shiftSwapStats.stats,
        leave: leaveStats.stats,
        advances: advanceStats.stats,
      });
    } catch (error) {
      console.error('Error loading request stats:', error);
      toast.error('Failed to load request statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  const getTabStats = (type: 'shifts' | 'leave' | 'advances') => {
    switch (type) {
      case 'shifts':
        return stats.shiftSwaps;
      case 'leave':
        return stats.leave;
      case 'advances':
        return stats.advances;
      default:
        return { pending: 0, approved: 0, rejected: 0, total: 0 };
    }
  };

  const getTabIcon = (type: 'shifts' | 'leave' | 'advances') => {
    switch (type) {
      case 'shifts':
        return ArrowUpDown;
      case 'leave':
        return Calendar;
      case 'advances':
        return DollarSign;
      default:
        return FileText;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Employee Requests</h1>
          <p className="text-gray-500 mt-1">
            Manage shift swaps, leave requests, and salary advances
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadStats}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.shiftSwaps.total + stats.leave.total + stats.advances.total}
                </p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.shiftSwaps.pending + stats.leave.pending + stats.advances.pending}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.shiftSwaps.approved + stats.leave.approved + stats.advances.approved}
                </p>
              </div>
              <Badge className="bg-green-100 text-green-800">Approved</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.shiftSwaps.rejected + stats.leave.rejected + stats.advances.rejected}
                </p>
              </div>
              <Badge variant="destructive">Rejected</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Status:</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          {(['shifts', 'leave', 'advances'] as const).map((tab) => {
            const Icon = getTabIcon(tab);
            const tabStats = getTabStats(tab);
            
            return (
              <TabsTrigger key={tab} value={tab} className="flex items-center gap-2 relative">
                <Icon className="h-4 w-4" />
                {tab === 'shifts' ? 'Shift Swaps' : 
                 tab === 'leave' ? 'Leave Requests' : 
                 'Salary Advances'}
                {tabStats.pending > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {tabStats.pending}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="shifts">
          <ShiftSwapRequests
            statusFilter={statusFilter}
            canCreate={canCreateRequests}
            canApprove={canApproveRequests}
            userRole={userRole}
            onStatsUpdate={loadStats}
          />
        </TabsContent>

        <TabsContent value="leave">
          <LeaveRequests
            statusFilter={statusFilter}
            canCreate={canCreateRequests}
            canApprove={canApproveRequests}
            userRole={userRole}
            onStatsUpdate={loadStats}
          />
        </TabsContent>

        <TabsContent value="advances">
          <SalaryAdvanceRequests
            statusFilter={statusFilter}
            canCreate={canCreateRequests}
            canApprove={canApproveRequests}
            userRole={userRole}
            onStatsUpdate={loadStats}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}