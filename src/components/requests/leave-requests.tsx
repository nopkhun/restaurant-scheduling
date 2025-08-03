'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Calendar, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  User,
  AlertTriangle,
  CalendarDays,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { format, parseISO, differenceInDays, addDays, startOfDay } from 'date-fns';

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: 'vacation' | 'sick' | 'personal' | 'emergency';
  start_date: string;
  end_date: string;
  total_days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  
  // Joined data
  employee?: {
    full_name: string;
    employee_id: string;
  };
  approver?: {
    full_name: string;
  };
}

interface LeaveRequestsProps {
  statusFilter: string;
  canCreate: boolean;
  canApprove: boolean;
  userRole: string;
  onStatsUpdate: () => void;
}

interface CreateLeaveRequestProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreateLeaveRequestDialog({ onClose, onSuccess }: CreateLeaveRequestProps) {
  const [leaveType, setLeaveType] = useState<'vacation' | 'sick' | 'personal' | 'emergency'>('vacation');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const { user } = useAuth();
  const t = useTranslations();

  // Calculate total days when dates change
  const totalDays = startDate && endDate ? 
    Math.max(1, differenceInDays(new Date(endDate), new Date(startDate)) + 1) : 0;

  const handleSubmit = async () => {
    if (!leaveType || !startDate || !endDate || !reason.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast.error('End date must be after start date');
      return;
    }

    if (new Date(startDate) <= new Date()) {
      toast.error('Leave cannot start today or in the past');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/requests/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          total_days: totalDays,
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create leave request');
      }

      toast.success('Leave request submitted successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating leave request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create leave request';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const getLeaveTypeDescription = (type: string) => {
    switch (type) {
      case 'vacation':
        return 'Planned time off for rest and recreation';
      case 'sick':
        return 'Medical leave for illness or medical appointments';
      case 'personal':
        return 'Personal matters requiring time away from work';
      case 'emergency':
        return 'Unexpected circumstances requiring immediate time off';
      default:
        return '';
    }
  };

  // Set minimum date to tomorrow
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Request Time Off
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Leave Type */}
          <div className="space-y-2">
            <Label htmlFor="leave-type">Leave Type *</Label>
            <Select value={leaveType} onValueChange={(value: any) => setLeaveType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="sick">Sick Leave</SelectItem>
                <SelectItem value="personal">Personal Leave</SelectItem>
                <SelectItem value="emergency">Emergency Leave</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">{getLeaveTypeDescription(leaveType)}</p>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date *</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                min={tomorrow}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  // Auto-adjust end date if it's before start date
                  if (endDate && e.target.value > endDate) {
                    setEndDate(e.target.value);
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date *</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                min={startDate || tomorrow}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Total Days Display */}
          {totalDays > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  Total Days: {totalDays} {totalDays === 1 ? 'day' : 'days'}
                </span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Leave *</Label>
            <Textarea
              id="reason"
              placeholder="Please explain the reason for your leave request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Warning for sick/emergency leave */}
          {(leaveType === 'sick' || leaveType === 'emergency') && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    {leaveType === 'sick' ? 'Sick Leave Notice' : 'Emergency Leave Notice'}
                  </p>
                  <p className="text-sm text-yellow-700">
                    {leaveType === 'sick' 
                      ? 'Please provide medical documentation if required by company policy.'
                      : 'Emergency leave will be reviewed immediately. Please contact your manager directly for urgent matters.'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={submitting || !leaveType || !startDate || !endDate || !reason.trim()}
            >
              <Calendar className="h-4 w-4 mr-2" />
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface LeaveRequestDetailsProps {
  request: LeaveRequest;
  onClose: () => void;
  canApprove: boolean;
  onAction: (requestId: string, action: 'approve' | 'reject', reason?: string) => Promise<void>;
}

function LeaveRequestDetailsDialog({ request, onClose, canApprove, onAction }: LeaveRequestDetailsProps) {
  const [actionReason, setActionReason] = useState('');
  const [showActionForm, setShowActionForm] = useState<'approve' | 'reject' | null>(null);
  const [processing, setProcessing] = useState(false);

  const t = useTranslations();

  const handleAction = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !actionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setProcessing(true);
    try {
      await onAction(request.id, action, actionReason.trim() || undefined);
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
      case 'cancelled':
        return <Badge variant="outline" className="text-gray-600">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLeaveTypeBadge = (type: string) => {
    const colors = {
      vacation: 'bg-blue-100 text-blue-800',
      sick: 'bg-red-100 text-red-800',
      personal: 'bg-purple-100 text-purple-800',
      emergency: 'bg-orange-100 text-orange-800',
    };
    
    return (
      <Badge className={colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Leave Request Details
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
              {getLeaveTypeBadge(request.leave_type)}
              {getStatusBadge(request.status)}
            </div>
          </div>

          {/* Employee and Leave Details */}
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
                    <span className="font-medium">Leave Type:</span>
                    <div className="mt-1">{getLeaveTypeBadge(request.leave_type)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Leave Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-green-600" />
                  Leave Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Start Date:</span>
                    <div>{format(parseISO(request.start_date), 'EEEE, MMM d, yyyy')}</div>
                  </div>
                  <div>
                    <span className="font-medium">End Date:</span>
                    <div>{format(parseISO(request.end_date), 'EEEE, MMM d, yyyy')}</div>
                  </div>
                  <div>
                    <span className="font-medium">Total Days:</span>
                    <div className="font-mono text-lg">{request.total_days} {request.total_days === 1 ? 'day' : 'days'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Reason */}
          {request.reason && (
            <div className="space-y-2">
              <Label>Reason for Leave</Label>
              <div className="p-3 bg-gray-50 rounded-md text-sm">
                {request.reason}
              </div>
            </div>
          )}

          {/* Approval/Rejection Info */}
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
          {showActionForm && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="action-reason">
                  {showActionForm === 'approve' ? 'Approval Notes (Optional)' : 'Rejection Reason *'}
                </Label>
                <Textarea
                  id="action-reason"
                  placeholder={
                    showActionForm === 'approve' 
                      ? 'Any additional notes for approval...'
                      : 'Please explain why this leave request is being rejected...'
                  }
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowActionForm(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant={showActionForm === 'approve' ? 'default' : 'destructive'}
                  onClick={() => handleAction(showActionForm)}
                  disabled={processing || (showActionForm === 'reject' && !actionReason.trim())}
                >
                  {processing ? 'Processing...' : showActionForm === 'approve' ? 'Approve Request' : 'Reject Request'}
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!showActionForm && (
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {canApprove && request.status === 'pending' && (
                <>
                  <Button
                    onClick={() => setShowActionForm('approve')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowActionForm('reject')}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LeaveRequests({ statusFilter, canCreate, canApprove, userRole, onStatsUpdate }: LeaveRequestsProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);

  const { user } = useAuth();
  const t = useTranslations();

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

      const response = await fetch(`/api/requests/leave?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error loading leave requests:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      const response = await fetch(`/api/requests/leave/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          reason,
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
      case 'cancelled':
        return <Badge variant="outline" className="text-gray-600">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLeaveTypeBadge = (type: string) => {
    const colors = {
      vacation: 'bg-blue-100 text-blue-800',
      sick: 'bg-red-100 text-red-800',
      personal: 'bg-purple-100 text-purple-800',
      emergency: 'bg-orange-100 text-orange-800',
    };
    
    return (
      <Badge className={colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Leave Requests
            </CardTitle>
            {canCreate && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Request Leave
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
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No leave requests found.</p>
              {canCreate && (
                <p className="text-sm">Click "Request Leave" to create your first request.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
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
                      {getLeaveTypeBadge(request.leave_type)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{format(parseISO(request.start_date), 'MMM d, yyyy')}</div>
                        <div className="text-gray-500">to {format(parseISO(request.end_date), 'MMM d, yyyy')}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">{request.total_days}</span>
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
                              onClick={() => handleRequestAction(request.id, 'reject', 'Rejected by manager')}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
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
        <CreateLeaveRequestDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            loadRequests();
            onStatsUpdate();
          }}
        />
      )}

      {/* Details Dialog */}
      {selectedRequest && (
        <LeaveRequestDetailsDialog
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          canApprove={canApprove}
          onAction={handleRequestAction}
        />
      )}
    </div>
  );
}