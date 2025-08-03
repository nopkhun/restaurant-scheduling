'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Clock, 
  MapPin, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Edit, 
  RefreshCw,
  Calendar,
  Timer,
  FileEdit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TimeEntry } from '@/types/schedule';
import { formatLocation } from '@/lib/location/utils';
import { format, parseISO } from 'date-fns';
import { TimeEntryCorrectionDialog } from './time-entry-correction';
import { toast } from 'sonner';

interface TimeEntryListProps {
  entries: TimeEntry[];
  loading: boolean;
  onRefresh: () => void;
  canEdit: boolean;
  userRole: string;
}

interface TimeEntryDetailsProps {
  entry: TimeEntry;
  onClose: () => void;
}

function TimeEntryDetails({ entry, onClose }: TimeEntryDetailsProps) {
  const t = useTranslations();

  const calculateDuration = () => {
    if (!entry.clock_in_time || !entry.clock_out_time) return 'Incomplete';
    
    const start = new Date(entry.clock_in_time);
    const end = new Date(entry.clock_out_time);
    const duration = end.getTime() - start.getTime();
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Time Entry Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Entry Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-semibold text-gray-900">Entry Status</h3>
              <p className="text-sm text-gray-600">
                {format(parseISO(entry.created_at), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <Badge className={entry.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
              {entry.is_verified ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Pending Verification
                </>
              )}
            </Badge>
          </div>

          {/* Time Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Timer className="h-4 w-4 text-green-600" />
                  Clock In
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time:</span>
                    <span className="font-mono">
                      {entry.clock_in_time ? format(parseISO(entry.clock_in_time), 'HH:mm:ss') : 'N/A'}
                    </span>
                  </div>
                  {entry.clock_in_location && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Location:</span>
                      <span className="font-mono text-xs">
                        {formatLocation(entry.clock_in_location, entry.clock_in_accuracy)}
                      </span>
                    </div>
                  )}
                  {entry.clock_in_accuracy && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Accuracy:</span>
                      <span>±{Math.round(entry.clock_in_accuracy)}m</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Timer className="h-4 w-4 text-red-600" />
                  Clock Out
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time:</span>
                    <span className="font-mono">
                      {entry.clock_out_time ? format(parseISO(entry.clock_out_time), 'HH:mm:ss') : 'Not clocked out'}
                    </span>
                  </div>
                  {entry.clock_out_location && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Location:</span>
                      <span className="font-mono text-xs">
                        {formatLocation(entry.clock_out_location, entry.clock_out_accuracy)}
                      </span>
                    </div>
                  )}
                  {entry.clock_out_accuracy && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Accuracy:</span>
                      <span>±{Math.round(entry.clock_out_accuracy)}m</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Duration and Hours */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-blue-900">Duration</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{calculateDuration()}</p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                <span className="font-semibold text-purple-900">Total Hours</span>
              </div>
              <p className="text-2xl font-bold text-purple-900">
                {entry.total_hours ? `${entry.total_hours}h` : 'Calculating...'}
              </p>
            </div>
          </div>

          {/* Map Location (if available) */}
          {(entry.clock_in_location || entry.clock_out_location) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {entry.clock_in_location && (
                    <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                      <span className="text-sm font-medium text-green-800">Clock In Location</span>
                      <span className="text-xs font-mono text-green-700">
                        {formatLocation(entry.clock_in_location, entry.clock_in_accuracy)}
                      </span>
                    </div>
                  )}
                  {entry.clock_out_location && (
                    <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                      <span className="text-sm font-medium text-red-800">Clock Out Location</span>
                      <span className="text-xs font-mono text-red-700">
                        {formatLocation(entry.clock_out_location, entry.clock_out_accuracy)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TimeEntryList({ entries, loading, onRefresh, canEdit, userRole }: TimeEntryListProps) {
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [correctionEntry, setCorrectionEntry] = useState<TimeEntry | null>(null);
  const t = useTranslations();

  const formatTime = (timeString: string | undefined) => {
    if (!timeString) return '--:--';
    return format(parseISO(timeString), 'HH:mm');
  };

  const calculateDuration = (entry: TimeEntry) => {
    if (!entry.clock_in_time || !entry.clock_out_time) return '--';
    
    const start = new Date(entry.clock_in_time);
    const end = new Date(entry.clock_out_time);
    const duration = end.getTime() - start.getTime();
    
    const hours = duration / (1000 * 60 * 60);
    return `${hours.toFixed(1)}h`;
  };

  const handleCorrectionSubmit = async (correction: any) => {
    try {
      const response = await fetch('/api/timesheet/corrections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(correction),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit correction');
      }

      toast.success('Time entry correction submitted successfully');
      onRefresh();
    } catch (error) {
      console.error('Error submitting correction:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit correction';
      toast.error(errorMessage);
      throw error;
    }
  };

  const getStatusBadge = (entry: TimeEntry) => {
    if (!entry.clock_out_time) {
      return (
        <Badge variant="outline" className="text-blue-600">
          <Timer className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }
    
    if (entry.is_verified) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="text-yellow-600">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Pending
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
              Time Entries
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="ml-2">Loading time entries...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No time entries found for today.</p>
              <p className="text-sm">Clock in to start tracking your time.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {format(parseISO(entry.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatTime(entry.clock_in_time)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatTime(entry.clock_out_time)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {calculateDuration(entry)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(entry)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEntry(entry)}
                        >
                          View Details
                        </Button>
                        {canEdit && !entry.is_verified && (
                          <Button
                            variant="ghost"
                            size="sm"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {!entry.is_verified && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCorrectionEntry(entry)}
                            title="Request correction"
                          >
                            <FileEdit className="h-4 w-4" />
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

      {/* Details Dialog */}
      {selectedEntry && (
        <TimeEntryDetails
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      {/* Correction Dialog */}
      {correctionEntry && (
        <TimeEntryCorrectionDialog
          entry={correctionEntry}
          onClose={() => setCorrectionEntry(null)}
          onSubmit={handleCorrectionSubmit}
          userRole={userRole}
        />
      )}
    </div>
  );
}