import { z } from 'zod';

/**
 * Schema for repetition rules in OmniFocus tasks.
 * Supports daily, weekly, monthly, and yearly frequencies with various options.
 *
 * Examples:
 * - Daily: { frequency: 'daily' }
 * - Every 2 days: { frequency: 'daily', interval: 2 }
 * - Weekly on Mon/Wed/Fri: { frequency: 'weekly', daysOfWeek: [1, 3, 5] }
 * - Monthly on 15th: { frequency: 'monthly', dayOfMonth: 15 }
 * - Monthly on first Monday: { frequency: 'monthly', weekdayOfMonth: { week: 1, day: 1 } }
 * - Yearly in January: { frequency: 'yearly', month: 1 }
 */
export const repetitionRuleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).describe("How often the task repeats"),
  interval: z.number().min(1).optional().describe("Repeat every N periods (default: 1)"),
  daysOfWeek: z.array(z.number().min(0).max(6)).min(1).optional().describe("Days of week to repeat on (0=Sunday, 6=Saturday). Only for weekly frequency. Must contain at least one day."),
  dayOfMonth: z.number().min(1).max(31).optional().describe("Day of month to repeat on. Only for monthly frequency. Mutually exclusive with weekdayOfMonth."),
  weekdayOfMonth: z.object({
    week: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(-1)]).describe("Week of month: 1=first, 2=second, 3=third, 4=fourth, 5=fifth, -1=last. Note: week 5 may not exist in all months (e.g., 5th Monday) - OmniFocus skips months without that occurrence."),
    day: z.number().min(0).max(6).describe("Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday")
  }).optional().describe("Weekday-of-month pattern (e.g., first Monday, last Friday). Only for monthly frequency. Mutually exclusive with dayOfMonth."),
  month: z.number().min(1).max(12).optional().describe("Month to repeat in. Only for yearly frequency."),
  repeatFrom: z.enum(['due', 'completion']).optional().describe("Repeat from due date or completion date (default: due)")
}).refine(
  data => !(data.dayOfMonth && data.weekdayOfMonth),
  { message: "Cannot specify both dayOfMonth and weekdayOfMonth" }
).refine(
  data => !data.weekdayOfMonth || data.frequency === 'monthly',
  { message: "weekdayOfMonth can only be used with monthly frequency" }
).refine(
  data => !data.dayOfMonth || data.frequency === 'monthly',
  { message: "dayOfMonth can only be used with monthly frequency" }
).refine(
  data => !data.daysOfWeek || data.frequency === 'weekly',
  { message: "daysOfWeek can only be used with weekly frequency" }
).refine(
  data => !data.month || data.frequency === 'yearly',
  { message: "month can only be used with yearly frequency" }
);

/** TypeScript type inferred from the repetition rule schema */
export type RepetitionRule = z.infer<typeof repetitionRuleSchema>;
