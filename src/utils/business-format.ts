const integers = new Intl.NumberFormat('ar-MA', { numberingSystem: 'latn', maximumFractionDigits: 0 });
export const formatCount = (value: number) => integers.format(value);

// DECIMAL values remain exact, including aggregate amounts exceeding Number's safe range.
export function formatMoney(value: string): string {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return 'غير متاح';
  const [whole, fraction = ''] = value.split('.');
  const minor = fraction.padEnd(2, '0');
  return `${integers.format(BigInt(whole!))},${minor} MRU`;
}
export const isPositiveMoney = (value: string) => /^\d+(?:\.\d{1,2})?$/.test(value) && /[1-9]/.test(value);
export function civilDate(value: string, monthOnly = false): string {
  return new Intl.DateTimeFormat('ar-MA', { numberingSystem: 'latn', timeZone: 'UTC', year: 'numeric', month: 'long', ...(monthOnly ? {} : { day: 'numeric' }) }).format(new Date(`${value}T12:00:00Z`));
}
export function obligationLabel(row: { targetType: string; year: number | null; month: number | null; label: string }): string {
  return row.targetType === 'monthly' && row.year && row.month ? civilDate(`${row.year}-${String(row.month).padStart(2, '0')}-01`, true) : row.label;
}
export const categoryLabels = { monthly: 'مساهمة شهرية', event: 'مساهمة دورة', arrears: 'تسديد متأخرات', other: 'أخرى' };
export const methodLabels = { cash: 'نقداً', transfer: 'تحويل', other: 'وسيلة أخرى' };
export function normalizeInputDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) - (digit <= '٩' ? 0x0660 : 0x06f0))).replace(/[٫,]/g, '.');
}
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
