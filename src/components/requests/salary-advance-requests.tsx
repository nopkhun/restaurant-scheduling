'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { 
  DollarSign, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye,
  User,
  AlertTriangle,
  Calculator,
  CreditCard,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface SalaryAdvanceRequest {
  id: string;
  employee_id: string;
  amount: number;
  max_eligible_amount: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  approved_by?: string;
  approved_at?: string;
  processed_by?: string;
  processed_at?: string;
  transaction_proof?: string;
  rejection_reason?: string;
  created_at: string;
  
  // Joined data
  employee?: {
    full_name: string;
    employee_id: string;
    hourly_rate: number;
  };
  approver?: {
    full_name: string;
  };
  processor?: {
    full_name: string;
  };
}

interface EligibilityData {
  maxAmount: number;
  currentAdvances: number;
  availableAmount: number;
  isEligible: boolean;
  hoursWorked: number;
  grossEarnings: number;
}

interface SalaryAdvanceRequestsProps {
  statusFilter: string;
  canCreate: boolean;
  canApprove: boolean;
  userRole: string;
  onStatsUpdate: () => void;
}

interface CreateAdvanceRequestProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreateAdvanceRequestDialog({ onClose, onSuccess }: CreateAdvanceRequestProps) {
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(true);

  const { user } = useAuth();
  const t = useTranslations();

  useEffect(() => {
    loadEligibility();
  }, []);

  const loadEligibility = async () => {
    try {
      setLoadingEligibility(true);
      const response = await fetch('/api/requests/salary-advances/eligibility');
      if (response.ok) {
        const data = await response.json();
        setEligibility(data.eligibility);
      }
    } catch (error) {
      console.error('Error loading eligibility:', error);
      toast.error('Failed to load eligibility information');
    } finally {
      setLoadingEligibility(false);
    }
  };

  const handleSubmit = async () => {
    const requestedAmount = parseFloat(amount);
    
    if (!requestedAmount || requestedAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!eligibility?.isEligible) {
      toast.error('You are not eligible for salary advance at this time');
      return;
    }

    if (requestedAmount > eligibility.availableAmount) {
      toast.error(`Amount cannot exceed ${eligibility.availableAmount.toLocaleString()} THB`);
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for the advance request');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/requests/salary-advances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: requestedAmount,
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create salary advance request');
      }

      toast.success('Salary advance request submitted successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating salary advance request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create salary advance request';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
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
            <DollarSign className="h-5 w-5" />
            Request Salary Advance
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {loadingEligibility ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="ml-2">Checking eligibility...</span>
            </div>
          ) : eligibility ? (
            <>
              {/* Eligibility Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-green-600" />
                    Eligibility Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Hours Worked (Current Period):</span>
                      <div className="font-mono">{eligibility.hoursWorked} hours</div>
                    </div>
                    <div>
                      <span className="font-medium">Gross Earnings:</span>
                      <div className="font-mono">{formatCurrency(eligibility.grossEarnings)}</div>
                    </div>
                    <div>
                      <span className="font-medium">Maximum Eligible Amount:</span>
                      <div className="font-mono">{formatCurrency(eligibility.maxAmount)}</div>
                    </div>
                    <div>
                      <span className="font-medium">Available Amount:</span>
                      <div className="font-mono text-green-600">{formatCurrency(eligibility.availableAmount)}</div>
                    </div>
                  </div>
                  
                  {!eligibility.isEligible && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800">Not Eligible</span>
                      </div>
                      <p className="text-sm text-red-700 mt-1">
                        You are not currently eligible for salary advance. This may be due to insufficient work hours, existing advances, or other policy restrictions.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {eligibility.isEligible && (
                <>
                  {/* Amount Input */}
                  <div className="space-y-2">
                    <Label htmlFor="amount">Requested Amount (THB) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter amount..."
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      max={eligibility.availableAmount}
                      min="1"
                      step="100"
                    />
                    <p className="text-xs text-gray-500">
                      Maximum available: {formatCurrency(eligibility.availableAmount)}
                    </p>
                  </div>

                  {/* Reason */}
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Advance *</Label>
                    <Textarea
                      id="reason"
                      placeholder="Please explain why you need this salary advance..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Important Notice */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Important Notice</p>
                        <p className="text-sm text-blue-700">
                          This advance will be deducted from your next payroll. Processing typically takes 1-2 business days after approval.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-red-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
              <p>Failed to load eligibility information</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {eligibility?.isEligible && (
              <Button 
                onClick={handleSubmit}
                disabled={submitting || !amount || !reason.trim() || loadingEligibility}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface AdvanceDetailsProps {
  request: SalaryAdvanceRequest;
  onClose: () => void;
  canApprove: boolean;
  canProcess: boolean;
  onAction: (requestId: string, action: 'approve' | 'reject' | 'process', data?: any) => Promise<void>;
}

function AdvanceDetailsDialog({ request, onClose, canApprove, canProcess, onAction }: AdvanceDetailsProps) {
  const [actionForm, setActionForm] = useState<'approve' | 'reject' | 'process' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [transactionProof, setTransactionProof] = useState('');
  const [processing, setProcessing] = useState(false);

  const t = useTranslations();

  const handleAction = async (action: 'approve' | 'reject' | 'process') => {
    if (action === 'reject' && !actionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    if (action === 'process' && !transactionProof.trim()) {
      toast.error('Please provide transaction proof');
      return;
    }

    setProcessing(true);
    try {
      const data: any = {};
      if (action === 'reject') data.reason = actionReason.trim();
      if (action === 'process') data.transaction_proof = transactionProof.trim();
      
      await onAction(request.id, action, data);
      onClose();
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'processed':
        return <Badge className="bg-blue-100 text-blue-800">Processed</Badge>;
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
            Salary Advance Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Request Status</h3>
              <p className="text-sm text-gray-600">
                Created on {format(parseISO(request.created_at), 'MMM d, yyyy HH:mm')}
              </p>
            </div>
            <div className="flex gap-2">
              {getStatusBadge(request.status)}
            </div>
          </div>

          {/* Request Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Employee Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" />
                  Employee Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Name:</span>
                    <div>{request.employee?.full_name}</div>
                  </div>
                  <div>
                    <span className="font-medium">Employee ID:</span>
                    <div>{request.employee?.employee_id}</div>
                  </div>
                  <div>
                    <span className="font-medium">Hourly Rate:</span>
                    <div>{formatCurrency(request.employee?.hourly_rate || 0)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-green-600" />
                  Financial Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Requested Amount:</span>
                    <div className="text-lg font-mono">{formatCurrency(request.amount)}</div>
                  </div>
                  <div>
                    <span className="font-medium">Max Eligible:</span>
                    <div className="font-mono">{formatCurrency(request.max_eligible_amount)}</div>
                  </div>
                  <div>
                    <span className="font-medium">Percentage:</span>
                    <div>{((request.amount / request.max_eligible_amount) * 100).toFixed(1)}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Reason */}
          {request.reason && (
            <div className="space-y-2">
              <Label>Reason for Advance</Label>
              <div className="p-3 bg-gray-50 rounded-md text-sm">
                {request.reason}
              </div>
            </div>
          )}

          {/* Status-specific Information */}
          {request.status === 'approved' && request.approver && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">Approved</span>
              </div>
              <p className="text-sm text-green-700">
                Approved by {request.approver.full_name} on {request.approved_at ? format(parseISO(request.approved_at), 'MMM d, yyyy HH:mm') : 'N/A'}
              </p>
            </div>
          )}

          {request.status === 'processed' && request.processor && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-800">Processed</span>
              </div>
              <p className="text-sm text-blue-700">
                Processed by {request.processor.full_name} on {request.processed_at ? format(parseISO(request.processed_at), 'MMM d, yyyy HH:mm') : 'N/A'}
              </p>
              {request.transaction_proof && (
                <div className="mt-2">
                  <span className="text-sm font-medium text-blue-800">Transaction Reference:</span>
                  <p className="text-sm text-blue-700 font-mono">{request.transaction_proof}</p>
                </div>
              )}
            </div>
          )}

          {request.status === 'rejected' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-800">Rejected</span>
              </div>
              <p className="text-sm text-red-700">
                Rejected by {request.approver?.full_name} on {request.approved_at ? format(parseISO(request.approved_at), 'MMM d, yyyy HH:mm') : 'N/A'}
              </p>
              {request.rejection_reason && (
                <div className="mt-2">
                  <span className="text-sm font-medium text-red-800">Reason:</span>
                  <p className="text-sm text-red-700">{request.rejection_reason}</p>
                </div>
              )}
            </div>
          )}

          {/* Action Form */}
          {actionForm && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="action-reason">
                  {actionForm === 'approve' ? 'Approval Notes (Optional)' : 
                   actionForm === 'reject' ? 'Rejection Reason *' : 
                   'Transaction Proof *'}
                </Label>
                {actionForm === 'process' ? (
                  <Input
                    id="action-reason"
                    placeholder="Transaction reference or proof..."
                    value={transactionProof}
                    onChange={(e) => setTransactionProof(e.target.value)}
                  />
                ) : (
                  <Textarea
                    id="action-reason"
                    placeholder={
                      actionForm === 'approve' 
                        ? 'Any additional notes for approval...'
                        : 'Please explain why this advance request is being rejected...'
                    }
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    rows={3}
                  />
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setActionForm(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant={actionForm === 'approve' ? 'default' : actionForm === 'reject' ? 'destructive' : 'default'}
                  onClick={() => handleAction(actionForm)}
                  disabled={processing || (actionForm === 'reject' && !actionReason.trim()) || (actionForm === 'process' && !transactionProof.trim())}
                >
                  {processing ? 'Processing...' : 
                   actionForm === 'approve' ? 'Approve Request' : 
                   actionForm === 'reject' ? 'Reject Request' : 
                   'Mark as Processed'}
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
              {canApprove && request.status === 'pending' && (
                <>
                  <Button
                    onClick={() => setActionForm('approve')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setActionForm('reject')}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
              {canProcess && request.status === 'approved' && (
                <Button
                  onClick={() => setActionForm('process')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Mark as Processed
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SalaryAdvanceRequests({ statusFilter, canCreate, canApprove, userRole, onStatsUpdate }: SalaryAdvanceRequestsProps) {
  const [requests, setRequests] = useState<SalaryAdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SalaryAdvanceRequest | null>(null);

  const { user } = useAuth();
  const t = useTranslations();

  // HR and accounting can process payments
  const canProcess = ['hr', 'accounting', 'admin'].includes(userRole);

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/requests/salary-advances?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error loading salary advance requests:', error);
      toast.error('Failed to load salary advance requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject' | 'process', data?: any) => {
    try {
      const response = await fetch(`/api/requests/salary-advances/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          ...data,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} request`);
      }

      toast.success(`Request ${action}d successfully`);
      loadRequests();
      onStatsUpdate();
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      const errorMessage = error instanceof Error ? error.message : `Failed to ${action} request`;
      toast.error(errorMessage);
      throw error;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'processed':
        return <Badge className="bg-blue-100 text-blue-800">Processed</Badge>;
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Salary Advance Requests
            </CardTitle>
            {canCreate && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Request Advance
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="ml-2">Loading requests...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No salary advance requests found.</p>
              {canCreate && (
                <p className="text-sm">Click "Request Advance" to create your first request.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Eligible Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.employee?.full_name}</div>
                        <div className="text-sm text-gray-500">({request.employee?.employee_id})</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-medium">{formatCurrency(request.amount)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{formatCurrency(request.max_eligible_amount)}</span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(request.status)}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(request.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRequest(request)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canApprove && request.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRequestAction(request.id, 'approve')}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRequestAction(request.id, 'reject', { reason: 'Rejected by manager' })}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {canProcess && request.status === 'approved' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRequestAction(request.id, 'process', { transaction_proof: 'Processed via system' })}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <CreditCard className="h-4 w-4" />
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
        <CreateAdvanceRequestDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            loadRequests();
            onStatsUpdate();
          }}
        />
      )}

      {/* Details Dialog */}
      {selectedRequest && (
        <AdvanceDetailsDialog
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          canApprove={canApprove}
          canProcess={canProcess}
          onAction={handleRequestAction}
        />
      )}
    </div>
  );
}