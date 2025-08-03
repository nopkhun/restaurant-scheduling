import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Users, Clock, BarChart3, Shield, Smartphone } from 'lucide-react';
import { LanguageSwitcher } from '@/components/ui/language-switcher';

export default function HomePage() {
  const t = useTranslations();

  const features = [
    {
      icon: Calendar,
      title: t('Schedule.title'),
      description: t('Schedule.description'),
    },
    {
      icon: Users,
      title: t('Navigation.employees'),
      description: 'Manage employee profiles, roles, and branch assignments',
    },
    {
      icon: Clock,
      title: t('Navigation.timeClock'),
      description: 'GPS-verified time tracking with location verification',
    },
    {
      icon: BarChart3,
      title: t('Navigation.reports'),
      description: 'Comprehensive analytics and reporting dashboard',
    },
    {
      icon: Shield,
      title: 'Security & Compliance',
      description: 'Role-based access control and data protection',
    },
    {
      icon: Smartphone,
      title: 'Mobile First',
      description: 'Optimized for mobile devices and tablets',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">RestaurantScheduler</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/login">{t('Auth.login')}</Link>
              </Button>
              <Button asChild>
                <Link href="/register">{t('Auth.register')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Restaurant Employee
            <span className="text-blue-600 block">{t('Schedule.title')} System</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            {t('Schedule.description')} with advanced features for multi-branch management,
            location verification, and automated payroll integration.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/register">{t('Common.create')} Account</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">{t('Auth.login')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Powerful Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <feature.icon className="h-12 w-12 text-blue-600 mb-4" />
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-blue-600 text-white">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to Streamline Your Restaurant Operations?
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            Join hundreds of restaurants already using our system
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/register">{t('Common.create')} Account {t('Common.today')}</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Calendar className="h-6 w-6" />
            <span className="text-xl font-bold">RestaurantScheduler</span>
          </div>
          <p className="text-gray-400">
            © 2025 RestaurantScheduler. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}