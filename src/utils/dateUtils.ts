// src/utils/dateUtils.ts
import { MONTHS, MONTH_MAP } from "../constants";

export class DateUtils {
  /**
   * Convert a number to its ordinal string representation (1st, 2nd, etc.)
   */
  static getDayWithSuffix(day: number): string {
    if (day > 3 && day < 21) return `${day}th`;
    switch (day % 10) {
      case 1:
        return `${day}st`;
      case 2:
        return `${day}nd`;
      case 3:
        return `${day}rd`;
      default:
        return `${day}th`;
    }
  }

  /**
   * Format a date object to Roam's date format (e.g., "November 25th, 2024")
   */
  static formatRoamDate(date: Date): string {
    return `${MONTHS[date.getMonth()]} ${this.getDayWithSuffix(
      date.getDate()
    )}, ${date.getFullYear()}`;
  }

  /**
   * Parse an English date string into a Date object
   */
  static parseEnglishDate(dateStr: string): Date {
    const [month, day, year] = dateStr.replace(",", "").split(" ");
    return new Date(
      parseInt(year),
      MONTH_MAP[month] - 1,
      parseInt(day.replace(/(st|nd|rd|th)/, ""))
    );
  }
}
