import { Component, type PropsWithChildren } from 'react';
import { Box, Button, Typography } from '@mui/material';

export class AppErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <Box dir="rtl" sx={{ p: 5, textAlign: 'center' }}>
          <Typography variant="h2">تعذّر عرض الصفحة</Typography>
          <Typography sx={{ my: 2 }}>يرجى إعادة تحميل الصفحة والمحاولة مجدداً.</Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>إعادة تحميل الصفحة</Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
