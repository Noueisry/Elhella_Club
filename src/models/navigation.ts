import type { SvgIconComponent } from '@mui/icons-material';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import PeopleOutlined from '@mui/icons-material/PeopleOutlined';
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import ManageAccountsOutlined from '@mui/icons-material/ManageAccountsOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';

export interface NavigationItem {
  path: string;
  label: string;
  description: string;
  icon: SvgIconComponent;
  color: string;
  background: string;
  permission: string;
}

export const navigation: NavigationItem[] = [
  { path: '/', permission: 'dashboard.read', label: 'لوحة التحكم', description: 'نظرة شاملة على مالية النادي', icon: DashboardOutlined, color: '#173f3b', background: '#edf3ef' },
  { path: '/members', permission: 'members.read', label: 'المنتسبون', description: 'ملفات المنتسبين وكشوف حساباتهم', icon: PeopleOutlined, color: '#34735a', background: '#edf5ee' },
  { path: '/payments', permission: 'payments.read', label: 'الدفعات', description: 'تسجيل المبالغ المدفوعة ومتابعتها', icon: AccountBalanceWalletOutlined, color: '#46738e', background: '#edf3f7' },
  { path: '/events', permission: 'events.manage', label: 'الدورات', description: 'الدورات والمسابقات ومساهمات المشاركين', icon: EmojiEventsOutlined, color: '#9a7540', background: '#f8f2e8' },
  { path: '/arrears', permission: 'arrears.read', label: 'المتأخرات', description: 'المبالغ المتبقية وتفاصيل استحقاقها', icon: HistoryOutlined, color: '#ad7258', background: '#fbf0eb' },
  { path: '/reports', permission: 'reports.read', label: 'التقارير', description: 'التقارير المالية وكشوف الحساب', icon: AssessmentOutlined, color: '#7b6997', background: '#f3eff8' },
  { path: '/users', permission: 'users.manage', label: 'المستخدمون', description: 'الحسابات والصلاحيات', icon: ManageAccountsOutlined, color: '#34735a', background: '#edf5ee' },
  { path: '/settings', permission: 'settings.manage', label: 'إعدادات النادي', description: 'هوية النادي والتعريفات والإيصالات', icon: SettingsOutlined, color: '#9a7540', background: '#f8f2e8' },
];

