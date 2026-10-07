import createCache from '@emotion/cache';
import { createTheme } from '@mui/material/styles';
import { arEG } from '@mui/material/locale';
import rtlPlugin from '@mui/stylis-plugin-rtl';
import { prefixer } from 'stylis';

export const rtlCache = createCache({ key: 'muirtl', stylisPlugins: [prefixer, rtlPlugin] });

export const theme = createTheme({
  direction: 'rtl',
  palette: {
    primary: { main: '#173f3b', light: '#e9f1ed', dark: '#102c29' },
    secondary: { main: '#a2793b', light: '#f5eddc' },
    background: { default: '#f7f8f4', paper: '#ffffff' },
    text: { primary: '#233731', secondary: '#6b7a73' },
    divider: '#e7ebe5',
    success: { main: '#347a57' },
    warning: { main: '#a76d20' },
  },
  typography: {
    fontFamily: '"Noto Sans Arabic", sans-serif',
    h1: { fontSize: '2.1rem', fontWeight: 700, lineHeight: 1.65 },
    h2: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.8 },
    h3: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.8 },
    body1: { fontSize: '0.9rem', lineHeight: 1.9 },
    body2: { fontSize: '0.8rem', lineHeight: 1.9 },
    button: { textTransform: 'none', fontWeight: 600, lineHeight: 1.8 },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 10, paddingBlock: 9, paddingInline: 18 } } },
    MuiCard: { defaultProps: { variant: 'outlined' }, styleOverrides: { root: { borderColor: '#e7ebe5', boxShadow: '0 2px 12px rgb(35 55 49 / 2%)' } } },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiCssBaseline: { styleOverrides: { body: { margin: 0 }, '::selection': { backgroundColor: '#e5edce' } } },
  },
}, arEG);
