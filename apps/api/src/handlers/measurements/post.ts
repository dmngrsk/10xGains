import { z } from 'zod';
import type { Context } from 'hono';
import { MEASUREMENT_TYPES } from '@txg/shared';
import type { CreateMeasurementCommand, MeasurementDto } from '@txg/shared';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { AppContext } from '../../context';
import { calendarDate, validateCommandBody } from '../../utils/validation';

const MEASUREMENT_SCHEMA = z.object({
  measured_on: calendarDate(),
  type: z.enum(MEASUREMENT_TYPES),
  value: z.number().positive('Value must be greater than zero').max(9999.999),
});

const COMMAND_SCHEMA = z.array(MEASUREMENT_SCHEMA)
  .min(1, 'At least one measurement is required')
  .max(50, 'Too many measurements in one request')
  .superRefine((rows, ctx) => {
    const seen = new Set<string>();

    for (const row of rows) {
      const key = `${row.measured_on}:${row.type}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate measurement for ${row.type} on ${row.measured_on}`,
        });
        return;
      }
      seen.add(key);
    }
  });

export async function handleCreateMeasurements(c: Context<AppContext>) {
  const { command, error: commandError } =
    await validateCommandBody<typeof COMMAND_SCHEMA, CreateMeasurementCommand[]>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const measurementRepository = c.get('measurementRepository');

  try {
    const created = await measurementRepository.createMany(command!);

    const successData = createSuccessData<MeasurementDto[]>(created);
    return c.json(successData, 201);
  } catch (error) {
    const fallbackMessage = 'Failed to create measurements';
    return handleRepositoryError(c, error as Error, handleCreateMeasurements.name, fallbackMessage);
  }
}
