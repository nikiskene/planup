//src/components/layout/navConfig.ts

import {
  BellRing,
  FileText,
  Gauge,
  HandCoins,
  NotebookPen,
  Settings,
  Users,
} from 'lucide-react';

import type { NavItem } from './navTypes';

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Radar',
    href: '/inbox',
    icon: Gauge,
  },
  {
    label: 'Follow-ups',
    href: '/tasks',
    icon: BellRing,
  },
  {
    label: 'People',
    href: '/crm/contacts',
    icon: Users,
  },
  {
    label: 'Opportunities',
    href: '/crm/deals',
    icon: HandCoins,
  },
  {
    label: 'Notes',
    href: '/notes',
    icon: NotebookPen,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  {
    label: 'Companies',
    href: '/crm/companies',
    icon: FileText,
  },
  {
    label: 'Interactions',
    href: '/crm/interactions',
    icon: FileText,
  },
];