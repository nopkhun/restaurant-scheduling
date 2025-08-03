'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { 
  ArrowUpDown, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User,
  Calendar,
  AlertTriangle,
  Eye,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface Schedule {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  employee?: {
    id: string;
    full_name: string;
    employee_id: string;
  };
  branch?: {
    name: string;
  };
}

interface ShiftSwapRequest {
  id: string;
  requester_id: string;
  requester_schedule_id: string;
  target_employee_id: string;
  target_schedule_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  
  // Joined data
  requester?: {
    full_name: string;
    employee_id: string;
  };
  target_employee?: {
    full_name: string;
    employee_id: string;
  };
  requester_schedule?: Schedule;
  target_schedule?: Schedule;
  approver?: {
    full_name: string;
  };
}

interface ShiftSwapRequestsProps {
  statusFilter: string;
  canCreate: boolean;
  canApprove: boolean;
  userRole: string;
  onStatsUpdate: () => void;
}

interface CreateSwapRequestProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreateSwapRequestDialog({ onClose, onSuccess }: CreateSwapRequestProps) {
  const [mySchedules, setMySchedules] = useState<Schedule[]>([]);
  const [targetSchedules, setTargetSchedules] = useState<Schedule[]>([]);
  const [selectedMySchedule, setSelectedMySchedule] = useState<string>('');
  const [selectedTargetSchedule, setSelectedTargetSchedule] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { user } = useAuth();
  const t = useTranslations();

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      
      // Get future schedules for the current user
      const myResponse = await fetch('/api/schedules/my-future');
      if (myResponse.ok) {
        const myData = await myResponse.json();
        setMySchedules(myData.schedules || []);
      }

      // Get available schedules from other employees for swapping
      const targetResponse = await fetch('/api/schedules/available-for-swap');
      if (targetResponse.ok) {
        const targetData = await targetResponse.json();
        setTargetSchedules(targetData.schedules || []);
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
      toast.error('Failed to load available schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedMySchedule || !selectedTargetSchedule || !reason.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (selectedMySchedule === selectedTargetSchedule) {
      toast.error('Cannot swap with the same schedule');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/requests/shift-swaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requester_schedule_id: selectedMySchedule,
          target_schedule_id: selectedTargetSchedule,
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create swap request');
      }

      toast.success('Shift swap request submitted successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating swap request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create swap request';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const formatScheduleOption = (schedule: Schedule) => {
    return `${format(parseISO(schedule.shift_date), 'MMM d, yyyy')} • ${schedule.start_time} - ${schedule.end_time} ${schedule.employee ? `• ${schedule.employee.full_name}` : ''}`;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Request Shift Swap
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="ml-2">Loading schedules...</span>
            </div>
          ) : (
            <>
              {/* My Schedule */}
              <div className="space-y-2">
                <Label htmlFor="my-schedule">My Schedule to Swap *</Label>
                <Select value={selectedMySchedule} onValueChange={setSelectedMySchedule}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your schedule to swap" />
                  </SelectTrigger>
                  <SelectContent>
                    {mySchedules.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {formatScheduleOption(schedule)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mySchedules.length === 0 && (
                  <p className="text-sm text-gray-500">No future schedules available for swapping</p>
                )}
              </div>

              {/* Target Schedule */}
              <div className="space-y-2">
                <Label htmlFor="target-schedule">Schedule to Swap With *</Label>
                <Select value={selectedTargetSchedule} onValueChange={setSelectedTargetSchedule}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select schedule to swap with" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetSchedules.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {formatScheduleOption(schedule)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targetSchedules.length === 0 && (
                  <p className="text-sm text-gray-500">No available schedules from other employees</p>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Swap *</Label>
                <Textarea
                  id="reason"
                  placeholder="Please explain why you need this shift swap..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Info */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Swap Request Process</p>
                    <p className="text-sm text-blue-700">
                      1. The target employee will be notified and must accept the swap<br/>
                      2. A manager must approve the final swap<br/>
                      3. Once approved, the schedules will be automatically updated
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={submitting || !selectedMySchedule || !selectedTargetSchedule || !reason.trim()}
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SwapRequestDetailsProps {
  request: ShiftSwapRequest;
  onClose: () => void;
  canApprove: boolean;
  onAction: (requestId: string, action: 'approve' | 'reject', reason?: string) => Promise<void>;
}

function SwapRequestDetailsDialog({ request, onClose, canApprove, onAction }: SwapRequestDetailsProps) {
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Shift Swap Request Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Info */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Request Status</h3>
              <p className="text-sm text-gray-600">
                Created on {format(parseISO(request.created_at), 'MMM d, yyyy HH:mm')}
              </p>
            </div>
            {getStatusBadge(request.status)}
          </div>

          {/* Swap Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Requester's Schedule */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" />
                  Requester's Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Employee:</span>
                    <div>{request.requester?.full_name} ({request.requester?.employee_id})</div>
                  </div>
                  {request.requester_schedule && (
                    <>
                      <div>
                        <span className="font-medium">Date:</span>
                        <div>{format(parseISO(request.requester_schedule.shift_date), 'EEEE, MMM d, yyyy')}</div>
                      </div>
                      <div>
                        <span className="font-medium">Time:</span>
                        <div className="font-mono">
                          {request.requester_schedule.start_time} - {request.requester_schedule.end_time}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Location:</span>
                        <div>{request.requester_schedule.branch?.name || 'N/A'}</div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Target Schedule */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-green-600" />
                  Target Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Employee:</span>
                    <div>{request.target_employee?.full_name} ({request.target_employee?.employee_id})</div>
                  </div>
                  {request.target_schedule && (
                    <>
                      <div>
                        <span className="font-medium">Date:</span>
                        <div>{format(parseISO(request.target_schedule.shift_date), 'EEEE, MMM d, yyyy')}</div>
                      </div>
                      <div>
                        <span className="font-medium">Time:</span>
                        <div className="font-mono">
                          {request.target_schedule.start_time} - {request.target_schedule.end_time}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Location:</span>
                        <div>{request.target_schedule.branch?.name || 'N/A'}</div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Reason */}
          {request.reason && (
            <div className="space-y-2">
              <Label>Reason for Swap</Label>
              <div className="p-3 bg-gray-50 rounded-md text-sm">
                {request.reason}
              </div>
            </div>
          )}

          {/* Approval Info */}
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
                      : 'Please explain why this request is being rejected...'
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

export function ShiftSwapRequests({ statusFilter, canCreate, canApprove, userRole, onStatsUpdate }: ShiftSwapRequestsProps) {
  const [requests, setRequests] = useState<ShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ShiftSwapRequest | null>(null);

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

      const response = await fetch(`/api/requests/shift-swaps?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error loading shift swap requests:', error);
      toast.error('Failed to load shift swap requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      const response = await fetch(`/api/requests/shift-swaps/${requestId}`, {
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              Shift Swap Requests
            </CardTitle>
            {canCreate && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Request Shift Swap
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
              <ArrowUpDown className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No shift swap requests found.</p>
              {canCreate && (
                <p className="text-sm">Click "Request Shift Swap" to create your first request.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requester</TableHead>
                  <TableHead>Target Employee</TableHead>
                  <TableHead>Dates</TableHead>
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
                        <div className="font-medium">{request.requester?.full_name}</div>
                        <div className="text-sm text-gray-500">({request.requester?.employee_id})</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.target_employee?.full_name}</div>
                        <div className="text-sm text-gray-500">({request.target_employee?.employee_id})</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {request.requester_schedule && (
                          <div>
                            <strong>From:</strong> {format(parseISO(request.requester_schedule.shift_date), 'MMM d')} 
                            ({request.requester_schedule.start_time} - {request.requester_schedule.end_time})
                          </div>
                        )}
                        {request.target_schedule && (
                          <div>
                            <strong>To:</strong> {format(parseISO(request.target_schedule.shift_date), 'MMM d')} 
                            ({request.target_schedule.start_time} - {request.target_schedule.end_time})
                          </div>
                        )}
                      </div>
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
        <CreateSwapRequestDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            loadRequests();
            onStatsUpdate();
          }}
        />
      )}

      {/* Details Dialog */}
      {selectedRequest && (
        <SwapRequestDetailsDialog
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          canApprove={canApprove}
          onAction={handleRequestAction}
        />
      )}
    </div>
  );
}