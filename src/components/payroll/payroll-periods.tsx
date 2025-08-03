'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Calendar,
  Plus,
  Eye,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Filter,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface PayrollPeriod {
  id: string;
  period_start: string;
  period_end: string;
  cutoff_date: string;
  pay_date: string;
  status: 'draft' | 'processing' | 'completed' | 'error';
  created_at: string;
  notes?: string;
  creator?: {
    full_name: string;
  };
  processor?: {
    full_name: string;
  };
  computedStatus?: string;
  canProcess?: boolean;
  daysUntilPay?: number;
}

interface PayrollPeriodsProps {
  onStatsUpdate: () => void;
}

interface CreatePeriodProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreatePeriodDialog({ onClose, onSuccess }: CreatePeriodProps) {
  const [frequency, setFrequency] = useState<'weekly' | 'bi-weekly' | 'monthly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState<string>('');
  const [generateYear, setGenerateYear] = useState<boolean>(false);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [cutoffDays, setCutoffDays] = useState<number>(3);
  const [payDays, setPayDays] = useState<number>(7);
  const [submitting, setSubmitting] = useState(false);

  const t = useTranslations();

  const handleSubmit = async () => {
    if (!generateYear && !startDate) {
      toast.error('Please select a start date');
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        frequency,
        cutoffDays,
        payDays,
      };

      if (generateYear) {
        body.generateYear = year;
      } else {
        body.startDate = startDate;
      }

      const response = await fetch('/api/payroll/periods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payroll period');
      }

      const data = await response.json();
      toast.success(data.message);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating payroll period:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create payroll period';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create Payroll Period
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">Payroll Frequency *</Label>
            <Select value={frequency} onValueChange={(value: any) => setFrequency(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generation Type */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="single"
                name="generation"
                checked={!generateYear}
                onChange={() => setGenerateYear(false)}
                className="w-4 h-4 text-blue-600"
              />
              <Label htmlFor="single">Create Single Period</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="yearly"
                name="generation"
                checked={generateYear}
                onChange={() => setGenerateYear(true)}
                className="w-4 h-4 text-blue-600"
              />
              <Label htmlFor="yearly">Generate Full Year</Label>
            </div>
          </div>

          {/* Single Period Options */}
          {!generateYear && (
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date *</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          )}

          {/* Yearly Generation Options */}
          {generateYear && (
            <div className="space-y-2">
              <Label htmlFor="year">Year *</Label>
              <Input
                id="year"
                type="number"
                min="2020"
                max="2030"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
              />
            </div>
          )}

          {/* Advanced Options */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cutoff-days">Cutoff Days Before Pay</Label>
              <Input
                id="cutoff-days"
                type="number"
                min="0"
                max="14"
                value={cutoffDays}
                onChange={(e) => setCutoffDays(parseInt(e.target.value))}
              />
              <p className="text-xs text-gray-500">
                Days before pay date for payroll cutoff
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-days">Pay Days After Period</Label>
              <Input
                id="pay-days"
                type="number"
                min="1"
                max="30"
                value={payDays}
                onChange={(e) => setPayDays(parseInt(e.target.value))}
              />
              <p className="text-xs text-gray-500">
                Days after period end for pay date
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={submitting || (!generateYear && !startDate)}
            >
              <Calendar className="h-4 w-4 mr-2" />
              {submitting ? 'Creating...' : generateYear ? `Create ${frequency} periods for ${year}` : 'Create Period'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PeriodDetailsProps {
  period: PayrollPeriod;
  onClose: () => void;
  onAction: (periodId: string, action: string, notes?: string) => Promise<void>;
  canDelete: boolean;
}

function PeriodDetailsDialog({ period, onClose, onAction, canDelete }: PeriodDetailsProps) {
  const [actionForm, setActionForm] = useState<'process' | 'complete' | 'cancel' | 'delete' | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const t = useTranslations();

  const handleAction = async (action: string) => {
    setProcessing(true);
    try {
      await onAction(period.id, action, notes.trim() || undefined);
      onClose();
    } catch (error) {
      console.error(`Error ${action}ing period:`, error);
    } finally {
      setProcessing(false);
    }
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Payroll Period Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">
                {format(parseISO(period.period_start), 'MMM d')} - {format(parseISO(period.period_end), 'MMM d, yyyy')}
              </h3>
              <p className="text-sm text-gray-600">
                Created on {format(parseISO(period.created_at), 'MMM d, yyyy')}
              </p>
            </div>
            <div className="flex gap-2">
              {getStatusBadge(period.status)}
            </div>
          </div>

          {/* Period Details */}
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Period Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Period:</span>
                    <div>{format(parseISO(period.period_start), 'MMM d')} - {format(parseISO(period.period_end), 'MMM d, yyyy')}</div>
                  </div>
                  <div>
                    <span className="font-medium">Cutoff Date:</span>
                    <div>{format(parseISO(period.cutoff_date), 'MMM d, yyyy')}</div>
                  </div>
                  <div>
                    <span className="font-medium">Pay Date:</span>
                    <div>{format(parseISO(period.pay_date), 'MMM d, yyyy')}</div>
                  </div>
                  {period.daysUntilPay !== undefined && (
                    <div>
                      <span className="font-medium">Days Until Pay:</span>
                      <div className={period.daysUntilPay > 0 ? 'text-blue-600' : 'text-green-600'}>
                        {period.daysUntilPay > 0 ? `${period.daysUntilPay} days` : 'Today/Past'}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Status Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Created By:</span>
                    <div>{period.creator?.full_name}</div>
                  </div>
                  {period.processor && (
                    <div>
                      <span className="font-medium">Processed By:</span>
                      <div>{period.processor.full_name}</div>
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Can Process:</span>
                    <div className={period.canProcess ? 'text-green-600' : 'text-gray-500'}>
                      {period.canProcess ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {period.notes && (
            <div className="space-y-2">
              <Label>Notes</Label>
              <div className="p-3 bg-gray-50 rounded-md text-sm">
                {period.notes}
              </div>
            </div>
          )}

          {/* Action Form */}
          {actionForm && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="action-notes">
                  {actionForm === 'delete' ? 'Deletion Reason *' : 'Notes (Optional)'}
                </Label>
                <Textarea
                  id="action-notes"
                  placeholder={
                    actionForm === 'delete'
                      ? 'Please explain why this period is being deleted...'
                      : 'Any additional notes...'
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setActionForm(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant={actionForm === 'delete' ? 'destructive' : 'default'}
                  onClick={() => handleAction(actionForm)}
                  disabled={processing || (actionForm === 'delete' && !notes.trim())}
                >
                  {processing ? 'Processing...' : 
                   actionForm === 'process' ? 'Start Processing' :
                   actionForm === 'complete' ? 'Mark Complete' :
                   actionForm === 'cancel' ? 'Cancel Period' :
                   'Delete Period'}
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!actionForm && (
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {period.status === 'draft' && (
                <Button
                  onClick={() => setActionForm('process')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Process
                </Button>
              )}
              {period.status === 'processing' && (
                <Button
                  onClick={() => setActionForm('complete')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete
                </Button>
              )}
              {period.status !== 'completed' && (
                <Button
                  variant="outline"
                  onClick={() => setActionForm('cancel')}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="destructive"
                  onClick={() => setActionForm('delete')}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PayrollPeriods({ onStatsUpdate }: PayrollPeriodsProps) {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);

  const { user } = useAuth();
  const t = useTranslations();

  useEffect(() => {
    loadPeriods();
  }, [statusFilter, yearFilter]);

  const loadPeriods = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (yearFilter !== 'all') {
        params.append('year', yearFilter);
      }

      const response = await fetch(`/api/payroll/periods?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPeriods(data.periods || []);
      }
    } catch (error) {
      console.error('Error loading payroll periods:', error);
      toast.error('Failed to load payroll periods');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, yearFilter]);

  const handlePeriodAction = async (periodId: string, action: string, notes?: string) => {
    try {
      const endpoint = action === 'delete' 
        ? `/api/payroll/periods/${periodId}`
        : `/api/payroll/periods/${periodId}`;
      
      const method = action === 'delete' ? 'DELETE' : 'PATCH';
      const body = action === 'delete' ? undefined : JSON.stringify({ action, notes });

      const response = await fetch(endpoint, {
        method,
        headers: action === 'delete' ? {} : {
          'Content-Type': 'application/json',
        },
        body,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} period`);
      }

      const data = await response.json();
      toast.success(data.message);
      loadPeriods();
      onStatsUpdate();
    } catch (error) {
      console.error(`Error ${action}ing period:`, error);
      const errorMessage = error instanceof Error ? error.message : `Failed to ${action} period`;
      toast.error(errorMessage);
      throw error;
    }
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

  // Get available years from periods
  const availableYears = Array.from(new Set(
    periods.map(period => new Date(period.period_start).getFullYear())
  )).sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Payroll Periods
            </CardTitle>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={loadPeriods}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Period
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="ml-2">Loading periods...</span>
            </div>
          ) : periods.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No payroll periods found.</p>
              <p className="text-sm">Click "Create Period" to create your first payroll period.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Cutoff Date</TableHead>
                  <TableHead>Pay Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {format(parseISO(period.period_start), 'MMM d')} - {format(parseISO(period.period_end), 'MMM d, yyyy')}
                        </div>
                        {period.daysUntilPay !== undefined && period.daysUntilPay >= 0 && (
                          <div className="text-sm text-blue-600">
                            Pay in {period.daysUntilPay} days
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(parseISO(period.cutoff_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(period.pay_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(period.status)}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(period.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPeriod(period)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {period.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePeriodAction(period.id, 'process')}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {period.status === 'processing' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePeriodAction(period.id, 'complete')}
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreatePeriodDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            loadPeriods();
            onStatsUpdate();
          }}
        />
      )}

      {/* Details Dialog */}
      {selectedPeriod && (
        <PeriodDetailsDialog
          period={selectedPeriod}
          onClose={() => setSelectedPeriod(null)}
          onAction={handlePeriodAction}
          canDelete={user?.role === 'admin'}
        />
      )}
    </div>
  );
}