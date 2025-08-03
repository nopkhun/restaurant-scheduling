'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { 
  FileText, 
  Plus, 
  Send, 
  Download, 
  Eye, 
  Trash2,
  CheckCircle,
  RefreshCw,
  Users,
  Filter,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { PayslipViewer } from './payslip-viewer';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface PayrollEntry {
  id: string;
  employee_id: string;
  gross_salary: number;
  net_salary: number;
  regular_hours: number;
  overtime_hours: number;
  holiday_hours: number;
  status: string;
  employee?: {
    full_name: string;
    employee_id: string;
    email: string;
  };
  hasPayslip?: boolean;
}

interface Payslip {
  id: string;
  slip_number: string;
  issued_date: string;
  is_sent: boolean;
  sent_at?: string;
  payroll_entry: PayrollEntry;
  employee?: {
    full_name: string;
    employee_id: string;
  };
}

interface PayslipManagementProps {
  periodId: string;
  onRefresh: () => void;
}

interface GeneratePayslipsProps {
  entries: PayrollEntry[];
  onClose: () => void;
  onSuccess: () => void;
}

function GeneratePayslipsDialog({ entries, onClose, onSuccess }: GeneratePayslipsProps) {
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [sendToEmployees, setSendToEmployees] = useState(false);
  const [generating, setGenerating] = useState(false);

  const t = useTranslations();

  useEffect(() => {
    // Select all entries without payslips by default
    const entriesWithoutPayslips = entries.filter(entry => !entry.hasPayslip);
    setSelectedEntries(entriesWithoutPayslips.map(entry => entry.id));
  }, [entries]);

  const handleSelectAll = () => {
    const entriesWithoutPayslips = entries.filter(entry => !entry.hasPayslip);
    setSelectedEntries(
      selectedEntries.length === entriesWithoutPayslips.length 
        ? [] 
        : entriesWithoutPayslips.map(entry => entry.id)
    );
  };

  const handleEntryToggle = (entryId: string) => {
    setSelectedEntries(prev => 
      prev.includes(entryId) 
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  const handleGenerate = async () => {
    if (selectedEntries.length === 0) {
      toast.error('Please select at least one payroll entry');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/payroll/payslips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payrollEntryIds: selectedEntries,
          sendToEmployees,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate payslips');
      }

      const data = await response.json();
      toast.success(data.message);
      
      if (data.errors && data.errors.length > 0) {
        toast.warning(`Some payslips had issues: ${data.errors.slice(0, 3).join(', ')}`);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error generating payslips:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate payslips';
      toast.error(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const availableEntries = entries.filter(entry => !entry.hasPayslip);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Generate Payslips
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-emails"
                checked={sendToEmployees}
                onCheckedChange={setSendToEmployees}
                disabled={generating}
              />
              <label htmlFor="send-emails" className="text-sm font-medium">
                Send payslips to employees automatically
              </label>
            </div>
          </div>

          {/* Employee Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                Select Employees ({selectedEntries.length} of {availableEntries.length})
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={generating || availableEntries.length === 0}
              >
                {selectedEntries.length === availableEntries.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            {availableEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>All payroll entries already have payslips generated.</p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedEntries.length === availableEntries.length}
                          onCheckedChange={handleSelectAll}
                          disabled={generating}
                        />
                      </TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Net Salary</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedEntries.includes(entry.id)}
                            onCheckedChange={() => handleEntryToggle(entry.id)}
                            disabled={generating}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{entry.employee?.full_name}</div>
                            <div className="text-sm text-gray-500">({entry.employee?.employee_id})</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">
                            {(entry.regular_hours + entry.overtime_hours + entry.holiday_hours).toFixed(1)}h
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-medium">
                            {formatCurrency(entry.net_salary)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={entry.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}
                          >
                            {entry.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose} disabled={generating}>
              Cancel
            </Button>
            <Button 
              onClick={handleGenerate}
              disabled={generating || selectedEntries.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              {generating ? 'Generating...' : `Generate ${selectedEntries.length} Payslips`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PayslipManagement({ periodId, onRefresh }: PayslipManagementProps) {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayslips, setSelectedPayslips] = useState<string[]>([]);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const { user } = useAuth();
  const t = useTranslations();

  useEffect(() => {
    loadData();
  }, [periodId, statusFilter]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load payroll entries for the period
      const entriesResponse = await fetch(`/api/payroll/periods/${periodId}`);
      if (entriesResponse.ok) {
        const entriesData = await entriesResponse.json();
        const entries = entriesData.entries || [];
        setPayrollEntries(entries);

        // Load existing payslips
        const payslipsResponse = await fetch(`/api/payroll/payslips?period_id=${periodId}`);
        if (payslipsResponse.ok) {
          const payslipsData = await payslipsResponse.json();
          const payslips = payslipsData.payslips || [];
          setPayslips(payslips);

          // Mark entries that have payslips
          const payslipEntryIds = new Set(payslips.map((p: Payslip) => p.payroll_entry.id));
          const entriesWithPayslipFlag = entries.map((entry: PayrollEntry) => ({
            ...entry,
            hasPayslip: payslipEntryIds.has(entry.id),
          }));
          setPayrollEntries(entriesWithPayslipFlag);
        }
      }
    } catch (error) {
      console.error('Error loading payslip data:', error);
      toast.error('Failed to load payslip data');
    } finally {
      setLoading(false);
    }
  }, [periodId, statusFilter]);

  const handlePayslipAction = async (payslipId: string, action: 'send' | 'resend' | 'mark_sent') => {
    try {
      const response = await fetch(`/api/payroll/payslips/${payslipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} payslip`);
      }

      const data = await response.json();
      toast.success(data.message);
      loadData();
      onRefresh();
    } catch (error) {
      console.error(`Error ${action}ing payslip:`, error);
      const errorMessage = error instanceof Error ? error.message : `Failed to ${action} payslip`;
      toast.error(errorMessage);
    }
  };

  const handleBulkSend = async () => {
    if (selectedPayslips.length === 0) {
      toast.error('Please select payslips to send');
      return;
    }

    try {
      const promises = selectedPayslips.map(id => handlePayslipAction(id, 'send'));
      await Promise.all(promises);
      setSelectedPayslips([]);
    } catch (error) {
      // Individual errors are handled in handlePayslipAction
    }
  };

  const handleViewPayslip = async (payslip: Payslip) => {
    try {
      const response = await fetch(`/api/payroll/payslips/${payslip.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedPayslip(data.payslip);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to load payslip details');
      }
    } catch (error) {
      console.error('Error loading payslip details:', error);
      toast.error('Failed to load payslip details');
    }
  };

  const handleDownloadPayslip = async (payslip: Payslip, format: 'html' | 'pdf' = 'html') => {
    try {
      const response = await fetch(`/api/payroll/payslips/${payslip.id}?format=${format}`);
      if (response.ok) {
        const content = await response.text();
        
        if (format === 'html') {
          const newWindow = window.open('', '_blank');
          if (newWindow) {
            newWindow.document.write(content);
            newWindow.document.close();
          }
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to download payslip');
      }
    } catch (error) {
      console.error('Error downloading payslip:', error);
      toast.error('Failed to download payslip');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (payslip: Payslip) => {
    if (payslip.is_sent) {
      return <Badge className="bg-green-100 text-green-800">Sent</Badge>;
    } else {
      return <Badge variant="outline" className="text-gray-600">Generated</Badge>;
    }
  };

  const filteredPayslips = payslips.filter(payslip => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'sent') return payslip.is_sent;
    if (statusFilter === 'unsent') return !payslip.is_sent;
    return true;
  });

  const stats = {
    total: payslips.length,
    sent: payslips.filter(p => p.is_sent).length,
    unsent: payslips.filter(p => !p.is_sent).length,
    canGenerate: payrollEntries.filter(e => !e.hasPayslip).length,
  };

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Payslips</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Sent</p>
                <p className="text-2xl font-bold">{stats.sent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Pending</p>
                <p className="text-2xl font-bold">{stats.unsent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Can Generate</p>
                <p className="text-2xl font-bold">{stats.canGenerate}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Payslip Management
            </CardTitle>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {stats.canGenerate > 0 && (
                <Button onClick={() => setShowGenerateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Payslips ({stats.canGenerate})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters and Bulk Actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="unsent">Unsent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {selectedPayslips.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {selectedPayslips.length} selected
                </span>
                <Button size="sm" onClick={handleBulkSend}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Selected
                </Button>
              </div>
            )}
          </div>

          {/* Payslips Table */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="ml-2">Loading payslips...</span>
            </div>
          ) : filteredPayslips.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No payslips found.</p>
              {stats.canGenerate > 0 && (
                <p className="text-sm">Click "Generate Payslips" to create payslips for employees.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedPayslips.length === filteredPayslips.length}
                      onCheckedChange={(checked) => {
                        setSelectedPayslips(
                          checked ? filteredPayslips.map(p => p.id) : []
                        );
                      }}
                    />
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Slip Number</TableHead>
                  <TableHead>Net Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayslips.map((payslip) => (
                  <TableRow key={payslip.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedPayslips.includes(payslip.id)}
                        onCheckedChange={(checked) => {
                          setSelectedPayslips(prev =>
                            checked 
                              ? [...prev, payslip.id]
                              : prev.filter(id => id !== payslip.id)
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payslip.employee?.full_name}</div>
                        <div className="text-sm text-gray-500">({payslip.employee?.employee_id})</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">{payslip.slip_number}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-medium">
                        {formatCurrency(payslip.payroll_entry.net_salary)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(payslip)}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(payslip.issued_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewPayslip(payslip)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadPayslip(payslip)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {!payslip.is_sent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePayslipAction(payslip.id, 'send')}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Send className="h-4 w-4" />
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

      {/* Generate Dialog */}
      {showGenerateDialog && (
        <GeneratePayslipsDialog
          entries={payrollEntries}
          onClose={() => setShowGenerateDialog(false)}
          onSuccess={() => {
            loadData();
            onRefresh();
          }}
        />
      )}

      {/* Payslip Viewer */}
      {selectedPayslip && (
        <PayslipViewer
          payslip={selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
          onDownload={(format) => handleDownloadPayslip(selectedPayslip, format)}
        />
      )}
    </div>
  );
}