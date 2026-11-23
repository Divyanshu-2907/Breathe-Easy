import { Router } from 'express';
import { validatePlanRequest } from '../validation/schemas.js';
import { geocodeCity } from '../services/geocode.js';
import { fetchAirQuality } from '../services/airQuality.js';
import { buildPlan } from '../rules/planBuilder.js';
import { validatePlan } from '../rules/guardrails.js';
import { AppError } from '../errors.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    // 1. Strict input validation with Zod
    const validatedRequest = validatePlanRequest(req.body);

    // 2. Geocoding
    const location = await geocodeCity(validatedRequest.city);

    // 3. Air Quality Forecast
    const airQuality = await fetchAirQuality(location.lat, location.lon, {
      timezone: location.timezone,
    });

    // 4. Build deterministic rule-based household plan
    const plan = buildPlan({
      location,
      airQuality,
      request: validatedRequest,
    });

    // 5. Guardrail validation
    const guardrailResult = validatePlan(plan, {
      request: validatedRequest,
      airQuality,
    });

    if (!guardrailResult.valid) {
      throw new AppError(
        `Plan failed safety guardrails: ${guardrailResult.violations.join('; ')}`,
        500,
        'GUARDRAIL_VIOLATION'
      );
    }

    return res.status(200).json(plan);
  } catch (err) {
    next(err);
  }
});

export default router;
