/**
 * Ethiopian Calendar (የኢትዮጵያ ዘመን አቆጣጠር) utilities.
 * Ethiopian calendar has 12 months of 30 days plus 1 month of 5 or 6 days (Pagume).
 * Ethiopian New Year (1 Meskerem) corresponds to September 11 (or Sept 12 in leap years).
 */

const ETHIOPIAN_MONTHS_AM = [
  'መስከረም', // 1: Meskerem
  'ጥቅምት',  // 2: Tikimt
  'ኅዳር',    // 3: Hidar
  'ታኅሣሥ',   // 4: Tahsas
  'ጥር',     // 5: Tir
  'የካቲት',   // 6: Yakatit
  'መጋቢት',  // 7: Megabit
  'ሚያዝያ',   // 8: Miazia
  'ግንቦት',   // 9: Ginbot
  'ሰኔ',     // 10: Sene
  'ሐምሌ',    // 11: Hamle
  'ነሐሴ',    // 12: Nehase
  'ጳጉሜን',   // 13: Pagume
];

const ETHIOPIAN_MONTHS_EN = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yakatit',
  'Megabit',
  'Miazia',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume',
];

export interface EthiopianDate {
  year: number;
  month: number; // 1 - 13
  day: number;
  monthNameAm: string;
  monthNameEn: string;
}

export function gregorianToEthiopian(dateInput: Date | string | number): EthiopianDate {
  const date = new Date(dateInput);
  const jdn = gregorianToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return jdnToEthiopian(jdn);
}

function gregorianToJDN(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdnToEthiopian(jdn: number): EthiopianDate {
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year = 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;

  const validMonth = Math.min(Math.max(month, 1), 13);
  return {
    year,
    month: validMonth,
    day,
    monthNameAm: ETHIOPIAN_MONTHS_AM[validMonth - 1] || 'መስከረም',
    monthNameEn: ETHIOPIAN_MONTHS_EN[validMonth - 1] || 'Meskerem',
  };
}

export function formatBilingualDate(
  dateInput: Date | string | number,
  locale: 'en' | 'am' = 'en'
): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';

    const eth = gregorianToEthiopian(d);
    const gregFormatted = d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    if (locale === 'am') {
      return `${eth.monthNameAm} ${eth.day} ቀን ${eth.year} ዓ.ም. (${gregFormatted})`;
    }

    return `${gregFormatted} (${eth.day} ${eth.monthNameEn} ${eth.year} E.C.)`;
  } catch {
    return String(dateInput);
  }
}
