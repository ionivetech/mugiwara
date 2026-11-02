export const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export function addMonths(date, months) {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
