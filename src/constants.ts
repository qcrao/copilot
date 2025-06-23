// src/constants.ts
export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_MAP: { [key: string]: number } = MONTHS.reduce(
  (acc, month, index) => {
    acc[month] = index + 1;
    return acc;
  },
  {} as { [key: string]: number }
);
