'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { 
  Calendar, 
  Users, 
  Clock, 
  FileText, 
  Settings, 
  Menu,
  CreditCard,
  BarChart3,
  LogOut,
  User
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useAuth } from '@/hooks/use-auth';


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user, profile, signOut, loading, getUserRole } = useAuth();
  const t = useTranslations('Navigation');

  const userRole = getUserRole();

  // Create navigation with translations
  const navigation = [
    {
      name: t('schedule'),
      href: '/dashboard/schedule',
      icon: Calendar,
      roles: ['employee', 'manager', 'hr', 'admin'],
    },
    {
      name: t('employees'),
      href: '/dashboard/employees',
      icon: Users,
      roles: ['manager', 'hr', 'admin'],
    },
    {
      name: t('timeClock'),
      href: '/dashboard/timesheet',
      icon: Clock,
      roles: ['employee', 'manager', 'hr', 'admin'],
    },
    {
      name: t('requests'),
      href: '/dashboard/requests',
      icon: FileText,
      roles: ['employee', 'manager', 'hr', 'admin'],
    },
    {
      name: t('payroll'),
      href: '/dashboard/payroll',
      icon: CreditCard,
      roles: ['hr', 'accounting', 'admin'],
    },
    {
      name: t('reports'),
      href: '/dashboard/reports',
      icon: BarChart3,
      roles: ['manager', 'hr', 'accounting', 'admin'],
    },
    {
      name: t('settings'),
      href: '/dashboard/settings',
      icon: Settings,
      roles: ['admin'],
    },
  ];

  // Filter navigation based on user role
  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(userRole)
  );

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return null; // Middleware should redirect to login
  }

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className={`space-y-1 ${mobile ? 'px-2' : ''}`}>
      {filteredNavigation.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`
              group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
              ${isActive
                ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-700'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }
              ${mobile ? 'w-full' : ''}
            `}
            onClick={() => mobile && setSidebarOpen(false)}
          >
            <Icon
              className={`
                mr-3 h-5 w-5 flex-shrink-0
                ${isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'}
              `}
            />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-white">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0 px-4 mb-5">
              <Calendar className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                RestaurantScheduler
              </span>
            </div>
            
            {/* Navigation */}
            <div className="mt-5 flex-1 px-2">
              <NavItems />
            </div>
          </div>
          
          {/* User Menu */}
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-0 h-auto">
                  <div className="flex items-center">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.user_metadata?.avatar_url} />
                      <AvatarFallback>
                        {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="ml-3 flex-1 text-left">
                      <p className="text-sm font-medium text-gray-700">
                        {(profile as Record<string, unknown>)?.full_name as string || user?.email || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{userRole}</p>
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t('profile')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    {t('profile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-2">
                  <LanguageSwitcher />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              {/* Logo */}
              <div className="flex items-center flex-shrink-0 px-4 mb-5">
                <Calendar className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">
                  RestaurantScheduler
                </span>
              </div>
              
              {/* Navigation */}
              <div className="mt-5 flex-1">
                <NavItems mobile />
              </div>
            </div>
            
            {/* User Menu */}
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
              <div className="flex items-center w-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback>
                    {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-700">
                    {(profile as Record<string, unknown>)?.full_name as string || user?.email || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{userRole}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Mobile Header */}
        <div className="md:hidden bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-3">
              <div className="flex items-center">
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                </Sheet>
                <Calendar className="ml-2 h-6 w-6 text-blue-600" />
                <span className="ml-2 text-lg font-semibold text-gray-900">
                  RestaurantScheduler
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user?.user_metadata?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t('profile')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/profile">{t('profile')}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-2">
                    <LanguageSwitcher />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    {t('signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}