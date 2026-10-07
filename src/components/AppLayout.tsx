import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Alert, Box, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Snackbar, Typography, useMediaQuery, useTheme } from '@mui/material';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import { navigation } from '../models/navigation';
import { formatBusinessDate } from '../utils/format';
import { ClubMark } from './ClubMark';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import LockResetOutlined from '@mui/icons-material/LockResetOutlined';
import { useAuth } from '../context/auth-context';
import { errorMessage } from '../services/auth.service';
import { homeFor } from '../models/auth';
import { useClubIdentity } from '../hooks/use-business';

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountError, setAccountError] = useState(''), [signingOut, setSigningOut] = useState(false);
  const auth = useAuth();
  const club = useClubIdentity();
  const allowedNavigation = navigation.filter((item) => auth.user?.permissions.includes(item.permission));
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const location = useLocation();
  const current = navigation.find((item) => item.path === location.pathname || (item.path !== '/' && location.pathname.startsWith(`${item.path}/`)));
  const closeMenu = () => setMenuOpen(false);
  useEffect(() => {
    const forbidden = () => setAccountError('ليس لديك صلاحية لتنفيذ هذا الإجراء.');
    window.addEventListener('smd:forbidden', forbidden);
    return () => window.removeEventListener('smd:forbidden', forbidden);
  }, []);
  async function signOut() {
    setSigningOut(true);
    try { await auth.logout(); }
    catch (failure) { setAccountError(errorMessage(failure)); }
    finally { setSigningOut(false); }
  }

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <a className="skip-link" href="#main-content">الانتقال إلى المحتوى</a>
      <Drawer
        // Emotion inverses les ancrages physiques : cet ancrage est rendu à droite en RTL.
        anchor="left"
        variant={desktop ? 'permanent' : 'temporary'}
        open={desktop || menuOpen}
        onClose={closeMenu}
        slotProps={{ paper: {
          dir: 'rtl',
          id: 'navigation-drawer',
          sx: { width: 264, bgcolor: '#173f3b', color: '#edf4ef', border: 0, insetInlineStart: 0, insetInlineEnd: 'auto' },
        } }}
      >
        <Box component="nav" aria-label="القائمة الرئيسية" sx={{ height: '100%', display: 'flex', flexDirection: 'column', px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pt: 3.5, pb: 3 }}>
            <ClubMark />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', overflowWrap: 'anywhere' }}>{club.data?.clubName ?? 'إدارة النادي'}</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: '#a9c4b9' }}>متابعة المنتسبين والمساهمات</Typography>
            </Box>
            {!desktop && <IconButton aria-label="إغلاق القائمة" onClick={closeMenu} sx={{ color: '#edf4ef' }}><CloseOutlined /></IconButton>}
          </Box>
          <Divider sx={{ borderColor: '#ffffff14' }} />
          <Typography variant="body2" sx={{ color: '#89a99b', mt: 3, mb: 1.5, px: 1.5, fontSize: '0.7rem' }}>مساحة الإدارة</Typography>
          <List disablePadding sx={{ display: 'grid', gap: 0.75 }}>
            {allowedNavigation.map((item) => (
              <ListItemButton
                key={item.path}
                component={NavLink}
                to={item.path}
                end={item.path === '/'}
                onClick={closeMenu}
                sx={{ borderRadius: 2, minHeight: 48, px: 1.5, '&.active': { bgcolor: '#ffffff12', color: '#e6bd77' }, '&:hover': { bgcolor: '#ffffff0b' } }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><item.icon sx={{ fontSize: 21 }} /></ListItemIcon>
                <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: '0.83rem', fontWeight: 500 } } }} />
              </ListItemButton>
            ))}
          </List>
          <Box sx={{ mt: 'auto', pt: 4, pb: 3 }}>
            <Typography sx={{ fontSize: '0.8rem', mb: 0.5 }}>{auth.user?.fullName}</Typography>
            <Typography sx={{ fontSize: '0.7rem', mb: 2, color: '#a9c4b9' }}>{auth.user?.role === 'admin' ? 'مدير النادي' : 'أمين الصندوق'}</Typography>
            <Box sx={{ bgcolor: '#ffffff08', border: '1px solid #ffffff0c', borderRadius: 2.5, p: 2 }}>
              <ShieldOutlined sx={{ color: '#e6bd77', fontSize: 23, mb: 0.8 }} />
              <Typography sx={{ fontSize: '0.79rem', fontWeight: 600 }}>كل مساهمة، في مكانها</Typography>
              <Typography sx={{ fontSize: '0.68rem', lineHeight: 1.9, color: '#a5bdb2', mt: 0.7 }}>متابعة واضحة للمنتسبين والدفعات والوضعية المالية للنادي.</Typography>
            </Box>
            <Typography sx={{ mt: 2.5, textAlign: 'center', color: '#789d8d', fontSize: '0.65rem', overflowWrap: 'anywhere' }}>{club.data?.clubName ?? 'إدارة النادي'}</Typography>
          </Box>
        </Box>
      </Drawer>

      <div className="app-content">
        <Box component="header" sx={{ bgcolor: '#ffffffb8', borderBottom: '1px solid', borderColor: 'divider', px: { xs: 2, md: 4.5 }, py: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          {!desktop && <IconButton aria-label="فتح القائمة" onClick={() => setMenuOpen(true)}><MenuOutlined /></IconButton>}
          <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>{current?.label ?? 'نادي الرماية'}</Typography>
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1, color: 'text.secondary' }}>
            <CalendarTodayOutlined sx={{ fontSize: 16 }} />
            <Typography variant="body2"><bdi>{formatBusinessDate(undefined, club.data?.businessTimezone)}</bdi></Typography>
          </Box>
          <IconButton component={Link} to="/account/password" aria-label="تغيير كلمة المرور"><LockResetOutlined /></IconButton>
          <IconButton aria-label="تسجيل الخروج" disabled={signingOut} onClick={() => { void signOut(); }}><LogoutOutlined /></IconButton>
        </Box>
        <main id="main-content" tabIndex={-1} className="px-4 py-6 sm:px-7 lg:px-10 lg:py-8">
          <div className="mx-auto w-full max-w-[1320px]"><Outlet /></div>
        </main>
        <Box component="footer" sx={{ px: 4, pb: 3, display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', color: 'text.secondary' }}>
          <Typography sx={{ fontSize: '0.68rem', overflowWrap: 'anywhere' }}>{club.data?.clubName ?? 'إدارة النادي'} · إدارة المنتسبين والمساهمات</Typography>
          <Typography component={Link} to={auth.user ? homeFor(auth.user) : '/login'} sx={{ fontSize: '0.68rem', color: 'inherit', textDecoration: 'none' }}>العودة إلى الصفحة الرئيسية</Typography>
        </Box>
      </div>
      <Snackbar open={Boolean(accountError)} autoHideDuration={6000} onClose={() => setAccountError('')}><Alert severity="error" onClose={() => setAccountError('')}>{accountError}</Alert></Snackbar>
    </Box>
  );
}
