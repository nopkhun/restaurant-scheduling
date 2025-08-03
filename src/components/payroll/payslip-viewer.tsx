'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { 
  X, 
  Download, 
  FileText, 
  Calendar,
  User,
  Clock,
  DollarSign,
  TrendingUp,
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

interface PayslipViewerProps {
  payslip: {
    id: string;
    slip_number: string;
    issued_date: string;
    is_sent: boolean;
    sent_at?: string;
    data?: any;
    summary?: {
      title: string;
      subtitle: string;
      netPay: string;
      grossPay: string;
      totalDeductions: string;
      totalHours: string;
    };
  };
  onClose: () => void;
  onDownload: (format: 'html' | 'pdf') => void;
}

export function PayslipViewer({ payslip, onClose, onDownload }: PayslipViewerProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'details'>('summary');
  const t = useTranslations();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'dd/MM/yyyy');
  };

  const data = payslip.data;
  const summary = payslip.summary;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Payslip Details
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {payslip.slip_number}
              </Badge>
              {payslip.is_sent ? (
                <Badge className="bg-green-100 text-green-800">Sent</Badge>
              ) : (
                <Badge variant="outline" className="text-gray-600">Generated</Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Action Buttons */}
          <div className="flex items-center gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => onDownload('html')}
            >
              <Download className="h-4 w-4 mr-2" />
              Download HTML
            </Button>
            <Button
              variant="outline"
              onClick={() => onDownload('pdf')}
              disabled // PDF not implemented yet
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('summary')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'summary'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setActiveTab('details')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'details'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Detailed Breakdown
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* Summary Header */}
              {summary && (
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center space-y-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{summary.title}</h2>
                        <p className="text-gray-600">{summary.subtitle}</p>
                      </div>
                      <div className="text-4xl font-bold text-green-600">
                        {summary.netPay}
                      </div>
                      <p className="text-gray-500">Net Salary</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick Stats */}
              {data && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Clock className="h-8 w-8 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Hours</p>
                          <p className="text-2xl font-bold">{data.hours.totalHours.toFixed(1)}</p>
                          <p className="text-xs text-gray-500">
                            {data.hours.regularHours}h regular + {data.hours.overtimeHours}h OT
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Gross Salary</p>
                          <p className="text-2xl font-bold">{formatCurrency(data.earnings.grossSalary)}</p>
                          <p className="text-xs text-gray-500">Before deductions</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Minus className="h-8 w-8 text-red-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Deductions</p>
                          <p className="text-2xl font-bold">{formatCurrency(data.deductions.totalDeductions)}</p>
                          <p className="text-xs text-gray-500">Tax, SS, advances</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Basic Information */}
              {data && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Employee Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Full Name:</span>
                          <span className="font-medium">{data.employee.fullName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Employee ID:</span>
                          <span className="font-medium">{data.employee.employeeId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Position:</span>
                          <span className="font-medium">{data.employee.position}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Department:</span>
                          <span className="font-medium">{data.employee.department}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Pay Period Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Pay Period:</span>
                          <span className="font-medium">
                            {formatDate(data.period.periodStart)} - {formatDate(data.period.periodEnd)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Pay Date:</span>
                          <span className="font-medium">{formatDate(data.period.payDate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Issued Date:</span>
                          <span className="font-medium">{formatDate(payslip.issued_date)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Slip Number:</span>
                          <span className="font-medium font-mono">{payslip.slip_number}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {activeTab === 'details' && data && (
            <div className="space-y-6">
              {/* Hours and Earnings Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Hours and Earnings Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3">Description</th>
                          <th className="text-center p-3">Hours</th>
                          <th className="text-center p-3">Rate</th>
                          <th className="text-right p-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-3">Regular Hours</td>
                          <td className="text-center p-3">{data.hours.regularHours.toFixed(2)}</td>
                          <td className="text-center p-3">{formatCurrency(data.rates.regularRate)}</td>
                          <td className="text-right p-3 font-mono">{formatCurrency(data.earnings.regularPay)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3">Overtime Hours (1.5x)</td>
                          <td className="text-center p-3">{data.hours.overtimeHours.toFixed(2)}</td>
                          <td className="text-center p-3">{formatCurrency(data.rates.overtimeRate)}</td>
                          <td className="text-right p-3 font-mono">{formatCurrency(data.earnings.overtimePay)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3">Holiday Hours (2.0x)</td>
                          <td className="text-center p-3">{data.hours.holidayHours.toFixed(2)}</td>
                          <td className="text-center p-3">{formatCurrency(data.rates.holidayRate)}</td>
                          <td className="text-right p-3 font-mono">{formatCurrency(data.earnings.holidayPay)}</td>
                        </tr>
                        <tr className="border-b bg-gray-50 font-semibold">
                          <td className="p-3">Total</td>
                          <td className="text-center p-3">{data.hours.totalHours.toFixed(2)}</td>
                          <td className="text-center p-3">—</td>
                          <td className="text-right p-3 font-mono">{formatCurrency(data.earnings.grossSalary)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Deductions Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Deductions Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3">Description</th>
                          <th className="text-right p-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-3">Social Security (5%)</td>
                          <td className="text-right p-3 font-mono">{formatCurrency(data.deductions.socialSecurity)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3">Tax Deduction</td>
                          <td className="text-right p-3 font-mono">{formatCurrency(data.deductions.taxDeduction)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3">Salary Advances</td>
                          <td className="text-right p-3 font-mono">{formatCurrency(data.deductions.salaryAdvances)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3">Other Deductions</td>
                          <td className="text-right p-3 font-mono">{formatCurrency(data.deductions.otherDeductions)}</td>
                        </tr>
                        <tr className="border-b bg-gray-50 font-semibold">
                          <td className="p-3">Total Deductions</td>
                          <td className="text-right p-3 font-mono text-red-600">{formatCurrency(data.deductions.totalDeductions)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Final Calculation */}
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold">Gross Salary:</span>
                      <span className="font-mono font-semibold">{formatCurrency(data.earnings.grossSalary)}</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold">Total Deductions:</span>
                      <span className="font-mono font-semibold text-red-600">-{formatCurrency(data.deductions.totalDeductions)}</span>
                    </div>
                    <hr className="border-t-2" />
                    <div className="flex justify-between text-2xl">
                      <span className="font-bold">NET SALARY:</span>
                      <span className="font-mono font-bold text-green-600">{formatCurrency(data.netSalary)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              {data.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{data.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => onDownload('html')}>
              <Download className="h-4 w-4 mr-2" />
              Download Payslip
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}