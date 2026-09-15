//src/components/layout/navConfig.ts

import {
  CheckSquare,
  HandCoins,
  Lightbulb,
  Home,
  NotebookPen,
  QrCode,
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
  { label: 'QR Codes', href: '/qr', icon: QrCode },
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Feature requests', href: '/features', icon: Lightbulb },
];
