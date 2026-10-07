import { Link } from 'react-router-dom';
import { Box, Card, CardActionArea, Typography } from '@mui/material';
import { navigation } from '../models/navigation';
import { useDashboard } from '../hooks/use-business';
import { useAuth } from '../context/auth-context';
import { errorMessage } from '../services/auth.service';
import { civilDate } from '../utils/business-format';
import { ServiceStatus } from '../components/ServiceStatus';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { Metrics, PageHeader, PaymentLink } from '../components/BusinessUi';
import { MemberSearch } from '../components/MemberSearch';

export function DashboardPage() {
  const query = useDashboard(), { user } = useAuth();
  const data = query.data;
  return <>
    <PageHeader title="لوحة التحكم" description="متابعة مالية النادي والوصول مباشرة إلى كشف حساب أي منتسب." actions={<PaymentLink />} />
    <MemberSearch />
    <Box component="section" aria-label="مؤشرات النادي" aria-busy={query.isFetching}>
      <Typography component="h2" variant="h2" sx={{ mb: 2 }}>نظرة على النادي</Typography>
      {query.isPending ? <LoadingState /> : query.isError ? <ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} /> : data && <>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>الاستحقاقات حتى <bdi>{civilDate(data.asOf)}</bdi> · شهر التحصيل: <bdi>{civilDate(data.collectionPeriod.from, true)}</bdi></Typography>
        <Metrics items={[
          { label: 'عدد المنتسبين', value: data.memberCount, hint: 'الملفات غير المؤرشفة، النشطة وغير النشطة.' },
          { label: 'المنتسبون الذين دفعوا', value: data.membersWhoPaid, hint: 'منتسبون غير مؤرشفين لديهم دفعة صالحة واحدة على الأقل في شهر التحصيل.' },
          { label: 'منتسبون لديهم متأخرات', value: data.membersWithArrears, hint: 'يشمل غير النشطين والمؤرشفين ممن لديهم دين مستحق.' },
          { label: 'المحصّل هذا الشهر', value: data.monthlyCollections, hint: 'جميع الدفعات الصالحة المؤرخة في شهر التحصيل، بما فيها الملفات المؤرشفة.' },
          { label: 'إجمالي المتأخرات', value: data.totalArrears, hint: 'المبالغ المتبقية المستحقة حتى اليوم؛ لا يشمل الالتزامات المستقبلية.' },
        ]} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>قد يكون المنتسب قد دفع هذا الشهر وما زالت عليه متأخرات. تعتمد الفترات على التوقيت المعتمد لدى النادي.</Typography>
      </>}
    </Box>
    <Box component="section" aria-label="الوصول السريع" sx={{ mb: 3 }}>
      <Typography component="h2" variant="h2" sx={{ mb: 2 }}>إدارة النادي</Typography>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{navigation.filter((item) => item.path !== '/' && user?.permissions.includes(item.permission)).map((item) => <Card key={item.path}>
        <CardActionArea component={Link} to={item.path} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5 }}>
          <Box sx={{ width: 46, height: 46, bgcolor: item.background, color: item.color, borderRadius: 3, display: 'grid', placeItems: 'center', flexShrink: 0 }}><item.icon /></Box>
          <Box><Typography component="h3" variant="h3">{item.label}</Typography><Typography variant="body2" color="text.secondary">{item.description}</Typography></Box>
        </CardActionArea>
      </Card>)}</div>
    </Box>
    <ServiceStatus />
  </>;
}
