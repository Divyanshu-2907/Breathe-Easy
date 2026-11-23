import { z } from 'zod';

export const MEMBER_TYPES = [
  'child',
  'teen',
  'adult',
  'elderly',
  'sensitive',
  'outdoor-worker',
];

export const ACTIVITIES = [
  'walk',
  'cycle',
  'exercise',
  'play',
  'errands',
  'commute',
];

export const COMMUTE_MODES = [
  'walk',
  'cycle',
  'metro',
  'bus',
  'e-rickshaw',
  'auto',
  'two-wheeler',
  'car',
];

export const COOKING_TIMES = ['morning', 'midday', 'evening'];

export const COOKING_FUELS = ['lpg', 'induction', 'solid-fuel', 'mixed'];

export const PLAN_DAYS = ['today', 'tomorrow'];

export const LANGUAGES = ['en', 'hi'];

// Regex patterns
const CITY_REGEX = /^[a-zA-Z\s.\-']+$/;
const NAME_REGEX = /^[a-zA-Z\s]+$/;
const TIME_HH_MM_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const memberSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name must be at least 1 character')
      .max(30, 'Name must be at most 30 characters')
      .regex(NAME_REGEX, 'Name may only contain letters and spaces'),
    type: z.enum(MEMBER_TYPES, {
      errorMap: () => ({ message: `Type must be one of: ${MEMBER_TYPES.join(', ')}` }),
    }),
    usualOutdoorTime: z
      .string()
      .regex(TIME_HH_MM_REGEX, 'usualOutdoorTime must be in 24-hour HH:MM format (e.g. 07:00, 18:30)'),
    outdoorMinutes: z
      .number({ invalid_type_error: 'outdoorMinutes must be a number' })
      .int('outdoorMinutes must be an integer')
      .min(0, 'outdoorMinutes cannot be negative')
      .max(240, 'outdoorMinutes cannot exceed 240'),
    activity: z.enum(ACTIVITIES, {
      errorMap: () => ({ message: `Activity must be one of: ${ACTIVITIES.join(', ')}` }),
    }),
    commuteMode: z.enum(COMMUTE_MODES).optional(),
  })
  .strict();

export const householdSchema = z
  .object({
    cookingTimes: z
      .array(z.enum(COOKING_TIMES))
      .max(3, 'At most 3 cooking times allowed')
      .refine((items) => new Set(items).size === items.length, {
        message: 'cookingTimes entries must be unique',
      }),
    cookingFuel: z.enum(COOKING_FUELS, {
      errorMap: () => ({ message: `cookingFuel must be one of: ${COOKING_FUELS.join(', ')}` }),
    }),
    hasExhaust: z.boolean({ invalid_type_error: 'hasExhaust must be a boolean' }),
    hasPurifier: z.boolean({ invalid_type_error: 'hasPurifier must be a boolean' }),
  })
  .strict();

export const planRequestSchema = z
  .object({
    city: z
      .string()
      .min(2, 'City must be at least 2 characters')
      .max(60, 'City must be at most 60 characters')
      .regex(CITY_REGEX, 'City may only contain letters, spaces, hyphens, periods, and apostrophes'),
    planDay: z.enum(PLAN_DAYS, {
      errorMap: () => ({ message: 'planDay must be "today" or "tomorrow"' }),
    }),
    language: z.enum(LANGUAGES, {
      errorMap: () => ({ message: 'language must be "en" or "hi"' }),
    }),
    household: householdSchema,
    members: z
      .array(memberSchema)
      .min(1, 'At least 1 household member is required')
      .max(8, 'At most 8 household members allowed'),
  })
  .strict();

export const validatePlanRequest = (data) => planRequestSchema.parse(data);
