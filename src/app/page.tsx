import Link from 'next/link';
import { Calendar, Clock, Users, TrendingUp, Shield, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">RestaurantScheduler</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/en/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/en/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Streamline Your Restaurant
            <span className="text-blue-600"> Scheduling</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Comprehensive employee scheduling, time tracking, and HR management 
            designed specifically for restaurants and food service operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/en/register">Start Free Trial</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/en/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">
            Everything You Need to Manage Your Team
          </h3>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            From scheduling to payroll, we&apos;ve got all your restaurant management needs covered.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <Calendar className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>Smart Scheduling</CardTitle>
              <CardDescription>
                Drag-and-drop scheduling with conflict detection and automatic notifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Multi-branch support</li>
                <li>• Flexible shift times</li>
                <li>• Real-time updates</li>
                <li>• Mobile-friendly</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Clock className="h-10 w-10 text-green-600 mb-2" />
              <CardTitle>GPS Time Tracking</CardTitle>
              <CardDescription>
                Location-verified time clock with anti-spoofing detection.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• GPS verification</li>
                <li>• Break management</li>
                <li>• Overtime tracking</li>
                <li>• Offline support</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-10 w-10 text-purple-600 mb-2" />
              <CardTitle>Employee Self-Service</CardTitle>
              <CardDescription>
                Empower employees with shift swaps, leave requests, and salary advances.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Shift swap requests</li>
                <li>• Leave management</li>
                <li>• Salary advances</li>
                <li>• Schedule viewing</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="h-10 w-10 text-orange-600 mb-2" />
              <CardTitle>Automated Payroll</CardTitle>
              <CardDescription>
                End-to-end payroll processing with automated calculations and distribution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Automatic calculations</li>
                <li>• Google Chat integration</li>
                <li>• Advance deductions</li>
                <li>• Compliance tracking</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-10 w-10 text-red-600 mb-2" />
              <CardTitle>Role-Based Security</CardTitle>
              <CardDescription>
                Enterprise-grade security with granular permissions and data isolation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Multi-branch isolation</li>
                <li>• Role-based access</li>
                <li>• Audit logging</li>
                <li>• GDPR compliance</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Globe className="h-10 w-10 text-teal-600 mb-2" />
              <CardTitle>Multi-Location</CardTitle>
              <CardDescription>
                Manage multiple restaurant locations from a single, unified dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Centralized management</li>
                <li>• Location-specific rules</li>
                <li>• Consolidated reporting</li>
                <li>• Cross-location transfers</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-4">
            Ready to Transform Your Restaurant Operations?
          </h3>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of restaurants that trust us with their scheduling and HR needs.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/en/register">Start Your Free Trial</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-6 w-6" />
                <span className="text-lg font-bold">RestaurantScheduler</span>
              </div>
              <p className="text-gray-400">
                The complete scheduling and HR solution for restaurants.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Features</li>
                <li>Pricing</li>
                <li>Security</li>
                <li>Integrations</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>About</li>
                <li>Blog</li>
                <li>Careers</li>
                <li>Contact</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Help Center</li>
                <li>Documentation</li>
                <li>Status</li>
                <li>Community</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 RestaurantScheduler. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
