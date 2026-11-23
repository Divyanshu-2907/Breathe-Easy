import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isSensitiveGroup } from './sensitivity.js';
import { EMISSION_RANKS } from './commute.js';

// Load valid swap IDs from swaps.json
const swapsPath = fileURLToPath(
  new URL('../../data/swaps.json', import.meta.url)
);
const validSwapsData = JSON.parse(fs.readFileSync(swapsPath, 'utf8'));
const VALID_SWAP_IDS = new Set(validSwapsData.map((s) => s.id));

export const REQUIRED_DISCLAIMER =
  'Estimates from a city-level model forecast. Not medical advice.';

/**
 * Validates a plan output against safety and domain guardrails.
 *
 * Guardrail Checks from SPEC:
 * 1. Required disclaimer present ("Estimates from a city-level model forecast. Not medical advice.").
 * 2. No outdoor recommendation for sensitive members in Severe hours.
 * 3. No commute suggestion with higher emission rank than current.
 * 4. Swap ids exist in data/swaps.json.
 * 5. Exposure numbers present only with ranges (low <= value <= high).
 *
 * @param {object} plan - The generated plan object
 * @param {object} [context] - Optional context containing request or forecast
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function validatePlan(plan, context = {}) {
  const violations = [];

  if (!plan || typeof plan !== 'object') {
    return { valid: false, violations: ['Plan must be an object'] };
  }

  // 1. Required disclaimer check
  if (
    !plan.disclaimer ||
    typeof plan.disclaimer !== 'string' ||
    !plan.disclaimer.includes('Not medical advice')
  ) {
    violations.push(
      'Missing or invalid required disclaimer: "Estimates from a city-level model forecast. Not medical advice."'
    );
  }

  // 2. Members checks (sensitive outdoors in Severe, exposure ranges, commute ranks)
  if (plan.protect && Array.isArray(plan.protect.members)) {
    for (const member of plan.protect.members) {
      const isSensitive = isSensitiveGroup(member.type);

      // Check outdoor recommendation during Severe air quality
      const isSevere =
        member.recommended?.band === 'Severe' ||
        member.usual?.band === 'Severe';

      if (isSensitive && isSevere) {
        // Must NOT recommend outdoor activity during Severe hours
        const actionsStr = (member.actions || []).join(' ').toLowerCase();
        const hasOutdoorEncouragement =
          actionsStr.includes('outdoor') &&
          !actionsStr.includes('avoid') &&
          !actionsStr.includes('shift') &&
          !actionsStr.includes('indoor');

        if (hasOutdoorEncouragement) {
          violations.push(
            `Sensitive member "${member.name}" (${member.type}) was given an outdoor activity recommendation during Severe pollution conditions.`
          );
        }
      }

      // Check exposure numbers present only with valid ranges
      if (member.exposure) {
        const { percentChange, low, high } = member.exposure;
        if (
          typeof percentChange !== 'number' ||
          typeof low !== 'number' ||
          typeof high !== 'number'
        ) {
          violations.push(
            `Member "${member.name}" exposure estimates must include percentChange, low, and high numeric ranges.`
          );
        } else if (low > percentChange || percentChange > high) {
          violations.push(
            `Member "${member.name}" exposure range is invalid: must satisfy low <= percentChange <= high (got low=${low}, value=${percentChange}, high=${high}).`
          );
        }
      } else {
        violations.push(
          `Member "${member.name}" is missing required exposure estimate object.`
        );
      }
    }
  }

  // 3. Commute upgrade check: no suggestion with higher emission rank than current
  const membersContext = context.request?.members || [];
  if (plan.protect && Array.isArray(plan.protect.members)) {
    for (let i = 0; i < plan.protect.members.length; i++) {
      const memberPlan = plan.protect.members[i];
      const memberReq = membersContext.find((m) => m.name === memberPlan.name);
      const originalMode = memberReq?.commuteMode;

      if (originalMode && EMISSION_RANKS[originalMode] !== undefined) {
        const originalRank = EMISSION_RANKS[originalMode];
        const actionsText = (memberPlan.actions || []).join(' ').toLowerCase();

        // Check if any higher emission mode is suggested
        for (const [mode, rank] of Object.entries(EMISSION_RANKS)) {
          if (rank > originalRank) {
            // E.g. suggesting car/drive to a walker/transit rider
            const modeMentioned =
              actionsText.includes(`switch to ${mode}`) ||
              actionsText.includes(`drive a ${mode}`) ||
              actionsText.includes(`use a ${mode}`) ||
              actionsText.includes(`take a ${mode}`);

            if (modeMentioned) {
              violations.push(
                `Member "${memberPlan.name}" commute was upgraded from ${originalMode} (rank ${originalRank}) to higher-emission ${mode} (rank ${rank}).`
              );
            }
          }
        }
      }
    }
  }

  // 4. Swap IDs exist in data/swaps.json
  if (plan.cut && Array.isArray(plan.cut.swaps)) {
    for (const swap of plan.cut.swaps) {
      if (!swap.id || !VALID_SWAP_IDS.has(swap.id)) {
        violations.push(
          `Unknown swap ID "${swap.id}" in cut.swaps list.`
        );
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

export default validatePlan;
