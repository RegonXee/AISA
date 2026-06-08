'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: '首页' },
  { href: '/lesson-design', label: '教学设计' },
  { href: '/essay-eval', label: '作文评价' },
  { href: '/exam-review', label: '试卷讲评' },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-dark-bg/95 backdrop-blur-sm border-b border-dark-border">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-6">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center text-white text-base font-bold">
              AISA
            </div>
            <div>
              <h1 className="text-white font-bold text-base">AISA</h1>
              <p className="text-gray-500 text-xs">Your AI Smart Assistant</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white hover:bg-dark-card'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="md:hidden border-t border-dark-border overflow-x-auto">
        <nav className="flex gap-1 px-3 py-2 min-w-max">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  isActive ? 'bg-primary/20 text-primary' : 'text-gray-400'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

