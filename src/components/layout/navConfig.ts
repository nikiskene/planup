//src/components/layout/navConfig.ts

import {
  CheckSquare,
  HandCoins,
  Home,
  NotebookPen,
  Settings,
  ShoppingCart,
  Users,
} from 'lucide-react';
import type { NavItem } from './navTypes';

export const HOME_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/inbox', icon: Home },
  { label: 'Shopping List', href: '/shopping', icon: ShoppingCart },
];

export const WORK_NAV_ITEMS: NavItem[] = [
  { label: 'Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Opportunities', href: '/crm/deals', icon: HandCoins },
  { label: 'Notes', href: '/notes', icon: NotebookPen },
  { label: 'Leads', href: '/crm/contacts', icon: Users },
  { label: 'Settings', href: '/settings', icon: Settings },
];
