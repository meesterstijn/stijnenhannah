import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";

// Nederlandse weergave van scores en datums.

const oneDecimal = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("nl-NL");

export const formatInt = (value: number) => integer.format(value);
export const formatMean = (value: number) => oneDecimal.format(value);
export const formatPercent = (value: number) => `${oneDecimal.format(value)}%`;

export const formatDate = (ymd: string) =>
  format(parseISO(ymd), "d MMM yyyy", { locale: nl });
export const formatDateShort = (ymd: string) =>
  format(parseISO(ymd), "d MMM", { locale: nl });
export const formatDateLong = (ymd: string) =>
  format(parseISO(ymd), "EEEE d MMMM yyyy", { locale: nl });
export const formatMonth = (ym: string) =>
  format(parseISO(`${ym}-01`), "MMM yyyy", { locale: nl });

export const todayYmd = () => format(new Date(), "yyyy-MM-dd");
