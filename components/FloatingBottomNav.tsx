"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Briefcase, CheckCircle } from 'lucide-react';

export default function FloatingBottomNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const navItems = [
    {
      icon: User,
      label: 'Profile',
      href: '/profile',
      isActive: pathname === '/profile'
    },
    {
      icon: Briefcase,
      label: 'Jobs',
      href: '/',
      isActive: pathname === '/'
    },
    {
      icon: CheckCircle,
      label: 'Applied',
      href: '/applied-jobs',
      isActive: pathname === '/applied-jobs'
    }
  ];

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[1100]">
      <div className="bg-white/90 backdrop-blur-md rounded-3xl px-2 py-2 shadow-lg border border-gray-200/50">
        <div className="flex items-center gap-8">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-full transition-all duration-300 ${
                  item.isActive
                    ? 'scale-110'
                    : 'text-gray-500'
                }`}
              >
                <IconComponent size={20} className="stroke-current" />
                <span className={`text-xs font-medium ${item.isActive ? 'font-semibold' : ''}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}