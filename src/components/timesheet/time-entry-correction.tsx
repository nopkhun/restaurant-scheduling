'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Clock, 
  Edit, 
  Send, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeEntry } from '@/types/schedule';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface TimeEntryCorrectionProps {
  entry: TimeEntry;
  onClose: () => void;
  onSubmit: (correction: CorrectionRequest) => Promise<void>;
  canApprove?: boolean;
  userRole: string;
}

interface CorrectionRequest {
  entry_id: string;
  correction_type: 'clock_in' | 'clock_out' | 'both' | 'delete';
  requested_clock_in_time?: string;
  requested_clock_out_time?: string;
  reason: string;
  supporting_evidence?: string;
}

interface PendingCorrection {
  id: string;
  entry_id: string;
  employee_id: string;
  correction_type: string;
  requested_clock_in_time?: string;
  requested_clock_out_time?: string;
  reason: string;
  supporting_evidence?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  employee?: {
    full_name: string;
    employee_id: string;
  };
  time_entry?: TimeEntry;
}

export function TimeEntryCorrectionDialog({ 
  entry, 
  onClose, 
  onSubmit, 
  canApprove = false,
  userRole 
}: TimeEntryCorrectionProps) {
  const [correctionType, setCorrectionType] = useState<CorrectionRequest['correction_type']>('clock_in');
  const [requestedClockIn, setRequestedClockIn] = useState(
    entry.clock_in_time ? format(parseISO(entry.clock_in_time), 'HH:mm') : ''
  );
  const [requestedClockOut, setRequestedClockOut] = useState(
    entry.clock_out_time ? format(parseISO(entry.clock_out_time), 'HH:mm') : ''
  );
  const [reason, setReason] = useState('');
  const [supportingEvidence, setSupportingEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const t = useTranslations();

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the correction');
      return;
    }

    if (correctionType !== 'delete' && correctionType !== 'clock_out' && !requestedClockIn) {
      toast.error('Please provide the requested clock-in time');
      return;
    }

    if (correctionType !== 'delete' && correctionType !== 'clock_in' && !requestedClockOut) {
      toast.error('Please provide the requested clock-out time');
      return;
    }

    setSubmitting(true);
    try {
      const correction: CorrectionRequest = {
        entry_id: entry.id,
        correction_type: correctionType,
        reason: reason.trim(),
        supporting_evidence: supportingEvidence.trim() || undefined,
      };

      if (correctionType === 'clock_in' || correctionType === 'both') {
        const entryDate = format(parseISO(entry.created_at), 'yyyy-MM-dd');
        correction.requested_clock_in_time = `${entryDate}T${requestedClockIn}:00.000Z`;
      }

      if (correctionType === 'clock_out' || correctionType === 'both') {
        const entryDate = format(parseISO(entry.created_at), 'yyyy-MM-dd');
        correction.requested_clock_out_time = `${entryDate}T${requestedClockOut}:00.000Z`;
      }

      await onSubmit(correction);
      toast.success('Correction request submitted successfully');
      onClose();
    } catch (error) {
      console.error('Error submitting correction:', error);
      toast.error('Failed to submit correction request');
    } finally {
      setSubmitting(false);
    }
  };

  const getCorrectionTypeDescription = () => {
    switch (correctionType) {
      case 'clock_in':
        return 'Correct the clock-in time only';
      case 'clock_out':
        return 'Correct the clock-out time only';
      case 'both':
        return 'Correct both clock-in and clock-out times';
      case 'delete':
        return 'Delete this time entry completely';
      default:
        return '';
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Request Time Entry Correction
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Entry Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Original Time Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Date:</span>
                  <div className="font-mono">{format(parseISO(entry.created_at), 'MMM d, yyyy')}</div>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <div>
                    <Badge className={entry.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {entry.is_verified ? 'Verified' : 'Pending'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Clock In:</span>
                  <div className="font-mono">
                    {entry.clock_in_time ? format(parseISO(entry.clock_in_time), 'HH:mm:ss') : 'Not clocked in'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Clock Out:</span>
                  <div className="font-mono">
                    {entry.clock_out_time ? format(parseISO(entry.clock_out_time), 'HH:mm:ss') : 'Not clocked out'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Correction Type */}
          <div className="space-y-2">
            <Label htmlFor="correction-type">Correction Type</Label>
            <Select value={correctionType} onValueChange={(value: CorrectionRequest['correction_type']) => setCorrectionType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clock_in">Clock In Time Only</SelectItem>
                <SelectItem value="clock_out">Clock Out Time Only</SelectItem>
                <SelectItem value="both">Both Clock In and Clock Out</SelectItem>
                <SelectItem value="delete">Delete Entry</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">{getCorrectionTypeDescription()}</p>
          </div>

          {/* Time Corrections */}
          {correctionType !== 'delete' && (
            <div className="grid grid-cols-2 gap-4">
              {(correctionType === 'clock_in' || correctionType === 'both') && (
                <div className="space-y-2">
                  <Label htmlFor="clock-in">Requested Clock In Time</Label>
                  <Input
                    id="clock-in"
                    type="time"
                    value={requestedClockIn}
                    onChange={(e) => setRequestedClockIn(e.target.value)}
                  />
                </div>
              )}

              {(correctionType === 'clock_out' || correctionType === 'both') && (
                <div className="space-y-2">
                  <Label htmlFor="clock-out">Requested Clock Out Time</Label>
                  <Input
                    id="clock-out"
                    type="time"
                    value={requestedClockOut}
                    onChange={(e) => setRequestedClockOut(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Correction *</Label>
            <Textarea
              id="reason"
              placeholder="Please explain why this correction is needed..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Supporting Evidence */}
          <div className="space-y-2">
            <Label htmlFor="evidence">Supporting Evidence (Optional)</Label>
            <Textarea
              id="evidence"
              placeholder="Any additional information or evidence to support this correction..."
              value={supportingEvidence}
              onChange={(e) => setSupportingEvidence(e.target.value)}
              rows={2}
            />
          </div>

          {/* Warning for deletion */}
          {correctionType === 'delete' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Warning: Delete Time Entry</p>
                  <p className="text-sm text-red-700">
                    This will permanently delete the time entry. This action cannot be undone.
                    Make sure to provide a detailed reason for deletion.
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
              disabled={submitting || !reason.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PendingCorrectionsProps {
  corrections: PendingCorrection[];
  onApprove: (correctionId: string) => Promise<void>;
  onReject: (correctionId: string, reason: string) => Promise<void>;
  loading: boolean;
  onRefresh: () => void;
}

export function PendingCorrections({ 
  corrections, 
  onApprove, 
  onReject, 
  loading,
  onRefresh 
}: PendingCorrectionsProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const t = useTranslations();

  const handleApprove = async (correctionId: string) => {
    setProcessing(correctionId);
    try {
      await onApprove(correctionId);
      toast.success('Correction approved successfully');
      onRefresh();
    } catch (error) {
      console.error('Error approving correction:', error);
      toast.error('Failed to approve correction');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!showRejectDialog || !rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setProcessing(showRejectDialog);
    try {
      await onReject(showRejectDialog, rejectionReason.trim());
      toast.success('Correction rejected');
      setShowRejectDialog(null);
      setRejectionReason('');
      onRefresh();
    } catch (error) {
      console.error('Error rejecting correction:', error);
      toast.error('Failed to reject correction');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600">Pending Review</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Pending Time Entry Corrections
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="ml-2">Loading corrections...</span>
            </div>
          ) : corrections.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No pending corrections found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {corrections.map((correction) => (
                <Card key={correction.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {correction.employee?.full_name} ({correction.employee?.employee_id})
                          </span>
                          {getStatusBadge(correction.status)}
                        </div>
                        
                        <div className="text-sm text-gray-600">
                          <div><strong>Type:</strong> {correction.correction_type.replace('_', ' ')}</div>
                          <div><strong>Date:</strong> {format(parseISO(correction.created_at), 'MMM d, yyyy HH:mm')}</div>
                          {correction.requested_clock_in_time && (
                            <div><strong>Requested Clock In:</strong> {format(parseISO(correction.requested_clock_in_time), 'HH:mm')}</div>
                          )}
                          {correction.requested_clock_out_time && (
                            <div><strong>Requested Clock Out:</strong> {format(parseISO(correction.requested_clock_out_time), 'HH:mm')}</div>
                          )}
                        </div>

                        <div className="bg-gray-50 p-3 rounded text-sm">
                          <strong>Reason:</strong> {correction.reason}
                          {correction.supporting_evidence && (
                            <div className="mt-2">
                              <strong>Evidence:</strong> {correction.supporting_evidence}
                            </div>
                          )}
                        </div>
                      </div>

                      {correction.status === 'pending' && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(correction.id)}
                            disabled={processing === correction.id}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowRejectDialog(correction.id)}
                            disabled={processing === correction.id}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={!!showRejectDialog} onOpenChange={() => setShowRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Correction Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason">Reason for Rejection</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Please explain why this correction is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowRejectDialog(null)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectionReason.trim() || processing === showRejectDialog}
              >
                <XCircle className="h-4 w-4 mr-2" />
                {processing === showRejectDialog ? 'Rejecting...' : 'Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}