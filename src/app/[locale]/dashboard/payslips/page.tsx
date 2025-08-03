'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { 
  FileText, 
  Download, 
  Eye, 
  Calendar,
  DollarSign,
  Filter,
  RefreshCw,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { PayslipViewer } from '@/components/payroll/payslip-viewer';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface Payslip {
  id: string;
  slip_number: string;
  issued_date: string;
  is_sent: boolean;
  sent_at?: string;
  created_at: string;
  payroll_entry: {
    gross_salary: number;
    net_salary: number;
    regular_hours: number;
    overtime_hours: number;
    holiday_hours: number;
  };
  payroll_period: {
    period_start: string;
    period_end: string;
    pay_date: string;
  };
  data?: any;
  summary?: {
    title: string;
    subtitle: string;
    netPay: string;
    grossPay: string;
    totalDeductions: string;
    totalHours: string;
  };
}

export default function PayslipsPage() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [searchTerm, setSearchTerm] = useState('');

  const { user } = useAuth();
  const t = useTranslations();

  useEffect(() => {
    loadPayslips();
  }, [yearFilter]);

  const loadPayslips = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (yearFilter !== 'all') {
        params.append('year', yearFilter);
      }

      const response = await fetch(`/api/payroll/payslips?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPayslips(data.payslips || []);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to load payslips');
      }
    } catch (error) {
      console.error('Error loading payslips:', error);
      toast.error('Failed to load payslips');
    } finally {
      setLoading(false);
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
          // Open in new window for HTML
          const newWindow = window.open('', '_blank');
          if (newWindow) {
            newWindow.document.write(content);
            newWindow.document.close();
          }
        } else {
          // Download PDF (when implemented)
          const blob = new Blob([content], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `payslip-${payslip.slip_number}.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
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

  // Filter payslips based on search term
  const filteredPayslips = payslips.filter(payslip => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      payslip.slip_number.toLowerCase().includes(searchLower) ||
      format(parseISO(payslip.payroll_period.period_start), 'MMM yyyy').toLowerCase().includes(searchLower)
    );
  });

  // Get available years from payslips
  const availableYears = Array.from(new Set(
    payslips.map(payslip => new Date(payslip.issued_date).getFullYear())
  )).sort((a, b) => b - a);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Payslips</h1>
          <p className="text-gray-600">View and download your salary payslips</p>
        </div>
      </div>

      {/* Summary Cards */}
      {payslips.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total Payslips</p>
                  <p className="text-2xl font-bold">{payslips.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">This Year</p>
                  <p className="text-2xl font-bold">
                    {payslips.filter(p => new Date(p.issued_date).getFullYear() === new Date().getFullYear()).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Latest Pay</p>
                  <p className="text-xl font-bold">
                    {payslips.length > 0 ? formatCurrency(payslips[0].payroll_entry.net_salary) : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium">Last Period</p>
                  <p className="text-sm font-bold">
                    {payslips.length > 0 ? format(parseISO(payslips[0].payroll_period.period_end), 'MMM yyyy') : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Payslips History
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={loadPayslips}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search payslips..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-32">
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
              {searchTerm && <p className="text-sm">Try adjusting your search criteria.</p>}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slip Number</TableHead>
                  <TableHead>Pay Period</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Gross Salary</TableHead>
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
                      <span className="font-mono font-medium">{payslip.slip_number}</span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {format(parseISO(payslip.payroll_period.period_start), 'MMM d')} - {format(parseISO(payslip.payroll_period.period_end), 'MMM d, yyyy')}
                        </div>
                        <div className="text-sm text-gray-500">
                          Pay: {format(parseISO(payslip.payroll_period.pay_date), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">
                        <div>{(payslip.payroll_entry.regular_hours + payslip.payroll_entry.overtime_hours + payslip.payroll_entry.holiday_hours).toFixed(1)}h</div>
                        <div className="text-gray-500">
                          ({payslip.payroll_entry.regular_hours}h + {payslip.payroll_entry.overtime_hours}h OT)
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">{formatCurrency(payslip.payroll_entry.gross_salary)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-bold text-green-600">
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
                          onClick={() => handleDownloadPayslip(payslip, 'html')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payslip Viewer Modal */}
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