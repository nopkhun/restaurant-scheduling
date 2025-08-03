'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Calculator,
  Users,
  Play,
  Download,
  Eye,
  RefreshCw,
  TrendingUp,
  Clock,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';

interface Employee {
  id: string;
  full_name: string;
  employee_id: string;
  hourly_rate: number;
}

interface PayrollCalculation {
  employee: {
    id: string;
    fullName: string;
    employeeId: string;
    hourlyRate: number;
  };
  period: {
    start: string;
    end: string;
  };
  hoursBreakdown: {
    totalHours: number;
    regularHours: number;
    overtimeHours: number;
    holidayHours: number;
  };
  calculation: {
    regularHours: number;
    overtimeHours: number;
    holidayHours: number;
    regularPay: number;
    overtimePay: number;
    holidayPay: number;
    grossSalary: number;
    socialSecurity: number;
    taxDeduction: number;
    salaryAdvances: number;
    otherDeductions: number;
    totalDeductions: number;
    netSalary: number;
    rates: {
      regularRate: number;
      overtimeRate: number;
      holidayRate: number;
    };
  };
}

interface PayrollSummary {
  totalEmployees: number;
  totalGrossSalary: number;
  totalNetSalary: number;
  totalDeductions: number;
  totalSocialSecurity: number;
  totalTax: number;
  totalAdvances: number;
}

interface PayrollCalculationsProps {
  onStatsUpdate: () => void;
}

interface CalculatePayrollProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CalculatePayrollDialog({ onClose, onSuccess }: CalculatePayrollProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [includeAdvances, setIncludeAdvances] = useState<boolean>(true);
  const [calculating, setCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentEmployee, setCurrentEmployee] = useState<string>('');

  const t = useTranslations();

  useEffect(() => {
    loadEmployees();
    // Set default period to current month
    const now = new Date();
    setPeriodStart(format(startOfMonth(now), 'yyyy-MM-dd'));
    setPeriodEnd(format(endOfMonth(now), 'yyyy-MM-dd'));
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/profiles?role=employee&active=true');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.profiles || []);
        // Select all employees by default
        setSelectedEmployees((data.profiles || []).map((emp: Employee) => emp.id));
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('Failed to load employees');
    }
  };

  const handleSelectAll = () => {
    setSelectedEmployees(selectedEmployees.length === employees.length ? [] : employees.map(emp => emp.id));
  };

  const handleEmployeeToggle = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleCalculate = async () => {
    if (selectedEmployees.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    if (!periodStart || !periodEnd) {
      toast.error('Please select period start and end dates');
      return;
    }

    setCalculating(true);
    setProgress(0);

    try {
      const calculations = [];
      for (let i = 0; i < selectedEmployees.length; i++) {
        const employeeId = selectedEmployees[i];
        const employee = employees.find(emp => emp.id === employeeId);
        
        setCurrentEmployee(employee?.full_name || '');
        setProgress(((i + 1) / selectedEmployees.length) * 100);

        const response = await fetch('/api/payroll/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            employeeId,
            periodStart,
            periodEnd,
            includeAdvances,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          calculations.push(data);
        } else {
          const errorData = await response.json();
          console.error(`Error calculating payroll for ${employee?.full_name}:`, errorData.error);
          toast.error(`Failed to calculate payroll for ${employee?.full_name}: ${errorData.error}`);
        }

        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (calculations.length > 0) {
        toast.success(`Successfully calculated payroll for ${calculations.length} employees`);
        onSuccess();
        onClose();
      } else {
        toast.error('No payroll calculations were successful');
      }
    } catch (error) {
      console.error('Error calculating payroll:', error);
      toast.error('Failed to calculate payroll');
    } finally {
      setCalculating(false);
      setProgress(0);
      setCurrentEmployee('');
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculate Payroll
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Period Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period-start">Period Start Date *</Label>
              <Input
                id="period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                disabled={calculating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-end">Period End Date *</Label>
              <Input
                id="period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                disabled={calculating}
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="include-advances"
                checked={includeAdvances}
                onChange={(e) => setIncludeAdvances(e.target.checked)}
                disabled={calculating}
                className="w-4 h-4 text-blue-600"
              />
              <Label htmlFor="include-advances">Include salary advances in deductions</Label>
            </div>
          </div>

          {/* Employee Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Select Employees ({selectedEmployees.length} of {employees.length})</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={calculating}
              >
                {selectedEmployees.length === employees.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedEmployees.length === employees.length}
                        onChange={handleSelectAll}
                        disabled={calculating}
                        className="w-4 h-4"
                      />
                    </TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Hourly Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(employee.id)}
                          onChange={() => handleEmployeeToggle(employee.id)}
                          disabled={calculating}
                          className="w-4 h-4"
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{employee.full_name}</div>
                          <div className="text-sm text-gray-500">({employee.employee_id})</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(employee.hourly_rate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Progress */}
          {calculating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Calculating payroll...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
              {currentEmployee && (
                <p className="text-sm text-gray-600">Processing: {currentEmployee}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose} disabled={calculating}>
              Cancel
            </Button>
            <Button 
              onClick={handleCalculate}
              disabled={calculating || selectedEmployees.length === 0 || !periodStart || !periodEnd}
            >
              <Calculator className="h-4 w-4 mr-2" />
              {calculating ? 'Calculating...' : `Calculate Payroll (${selectedEmployees.length} employees)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CalculationDetailsProps {
  calculation: PayrollCalculation;
  onClose: () => void;
}

function CalculationDetailsDialog({ calculation, onClose }: CalculationDetailsProps) {
  const t = useTranslations();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Payroll Calculation Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Employee Info */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">{calculation.employee.fullName}</h3>
              <p className="text-gray-600">Employee ID: {calculation.employee.employeeId}</p>
              <p className="text-sm text-gray-500">
                Period: {format(parseISO(calculation.period.start), 'MMM d')} - {format(parseISO(calculation.period.end), 'MMM d, yyyy')}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(calculation.calculation.netSalary)}
              </div>
              <p className="text-sm text-gray-500">Net Salary</p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Total Hours</p>
                    <p className="text-2xl font-bold">{calculation.hoursBreakdown.totalHours}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Gross Salary</p>
                    <p className="text-2xl font-bold">{formatCurrency(calculation.calculation.grossSalary)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium">Deductions</p>
                    <p className="text-2xl font-bold">{formatCurrency(calculation.calculation.totalDeductions)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hours Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Hours Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Regular Hours:</span>
                    <span className="font-mono">{calculation.hoursBreakdown.regularHours}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overtime Hours:</span>
                    <span className="font-mono">{calculation.hoursBreakdown.overtimeHours}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Holiday Hours:</span>
                    <span className="font-mono">{calculation.hoursBreakdown.holidayHours}h</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-semibold">
                    <span>Total Hours:</span>
                    <span className="font-mono">{calculation.hoursBreakdown.totalHours}h</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pay Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Regular Rate:</span>
                    <span className="font-mono">{formatCurrency(calculation.calculation.rates.regularRate)}/hr</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overtime Rate (1.5x):</span>
                    <span className="font-mono">{formatCurrency(calculation.calculation.rates.overtimeRate)}/hr</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Holiday Rate (2.0x):</span>
                    <span className="font-mono">{formatCurrency(calculation.calculation.rates.holidayRate)}/hr</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Earnings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Earnings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Regular Pay:</span>
                    <span className="font-mono">{formatCurrency(calculation.calculation.regularPay)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overtime Pay:</span>
                    <span className="font-mono">{formatCurrency(calculation.calculation.overtimePay)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Holiday Pay:</span>
                    <span className="font-mono">{formatCurrency(calculation.calculation.holidayPay)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-semibold text-green-600">
                    <span>Gross Salary:</span>
                    <span className="font-mono">{formatCurrency(calculation.calculation.grossSalary)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deductions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Deductions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Social Security (5%):</span>
                    <span className="font-mono">{formatCurrency(calculation.calculation.socialSecurity)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax Deduction:</span>
                    <span className="font-mono">{formatCurrency(calculation.calculation.taxDeduction)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Salary Advances:</span>
                    <span className="font-mono">{formatCurrency(calculation.calculation.salaryAdvances)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Other Deductions:</span>
                    <span className="font-mono">{formatCurrency(calculation.calculation.otherDeductions)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-semibold text-red-600">
                    <span>Total Deductions:</span>
                    <span className="font-mono">{formatCurrency(calculation.calculation.totalDeductions)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-bold text-lg text-green-600">
                    <span>Net Salary:</span>
                    <span className="font-mono">{formatCurrency(calculation.calculation.netSalary)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button>
              <Download className="h-4 w-4 mr-2" />
              Export Details
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PayrollCalculations({ onStatsUpdate }: PayrollCalculationsProps) {
  const [calculations, setCalculations] = useState<PayrollCalculation[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCalculateDialog, setShowCalculateDialog] = useState(false);
  const [selectedCalculation, setSelectedCalculation] = useState<PayrollCalculation | null>(null);
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');

  const { user } = useAuth();
  const t = useTranslations();

  useEffect(() => {
    // Set default period to current month
    const now = new Date();
    setPeriodStart(format(startOfMonth(now), 'yyyy-MM-dd'));
    setPeriodEnd(format(endOfMonth(now), 'yyyy-MM-dd'));
  }, []);

  useEffect(() => {
    if (periodStart && periodEnd) {
      loadCalculations();
    }
  }, [periodStart, periodEnd]);

  const loadCalculations = useCallback(async () => {
    if (!periodStart || !periodEnd) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/payroll/calculate?period_start=${periodStart}&period_end=${periodEnd}`);
      if (response.ok) {
        const data = await response.json();
        setCalculations(data.calculations || []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error loading payroll calculations:', error);
      toast.error('Failed to load payroll calculations');
    } finally {
      setLoading(false);
    }
  }, [periodStart, periodEnd]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Period Selection and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Payroll Calculations
            </CardTitle>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={loadCalculations}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={() => setShowCalculateDialog(true)}>
                <Play className="h-4 w-4 mr-2" />
                Calculate Payroll
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="period-start">Period Start Date</Label>
              <Input
                id="period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-end">Period End Date</Label>
              <Input
                id="period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Employees</p>
                  <p className="text-2xl font-bold">{summary.totalEmployees}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Gross Total</p>
                  <p className="text-xl font-bold">{formatCurrency(summary.totalGrossSalary)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium">Deductions</p>
                  <p className="text-xl font-bold">{formatCurrency(summary.totalDeductions)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Net Total</p>
                  <p className="text-xl font-bold">{formatCurrency(summary.totalNetSalary)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Calculations Table */}
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="ml-2">Loading calculations...</span>
            </div>
          ) : calculations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No payroll calculations found for this period.</p>
              <p className="text-sm">Click "Calculate Payroll" to generate calculations.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Gross Salary</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Salary</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculations.map((calc, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{calc.employee.fullName}</div>
                        <div className="text-sm text-gray-500">({calc.employee.employeeId})</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono">
                        <div>{calc.hoursBreakdown.totalHours}h total</div>
                        <div className="text-sm text-gray-500">
                          {calc.hoursBreakdown.regularHours}h + {calc.hoursBreakdown.overtimeHours}h OT
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-medium">
                        {formatCurrency(calc.calculation.grossSalary)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-red-600">
                        {formatCurrency(calc.calculation.totalDeductions)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-bold text-green-600">
                        {formatCurrency(calc.calculation.netSalary)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCalculation(calc)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
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

      {/* Calculate Dialog */}
      {showCalculateDialog && (
        <CalculatePayrollDialog
          onClose={() => setShowCalculateDialog(false)}
          onSuccess={() => {
            loadCalculations();
            onStatsUpdate();
          }}
        />
      )}

      {/* Details Dialog */}
      {selectedCalculation && (
        <CalculationDetailsDialog
          calculation={selectedCalculation}
          onClose={() => setSelectedCalculation(null)}
        />
      )}
    </div>
  );
}