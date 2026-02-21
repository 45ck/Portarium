/**
 * Reusable validation rules for list-query inputs.
 *
 * These compose with the existing `validate()` framework from validation.ts
 * and eliminate per-entity validation boilerplate.
 */

import { MAX_LIMIT } from './query.js';
import type { ValidationRule } from './validation.js';

/**
 * Validates `limit` and `cursor` pagination fields.
 */
export function paginationRules<
  TInput extends { limit?: number; cursor?: string },
>(): ValidationRule<TInput>[] {
  return [
    (input, violations) => {
      if (input.limit !== undefined) {
        if (!Number.isInteger(input.limit) || input.limit <= 0) {
          violations.push({ field: 'limit', message: 'limit must be a positive integer.' });
        } else if (input.limit > MAX_LIMIT) {
          violations.push({
            field: 'limit',
            message: `limit must not exceed ${MAX_LIMIT}.`,
          });
        }
      }
    },
    (input, violations) => {
      if (
        input.cursor !== undefined &&
        (typeof input.cursor !== 'string' || input.cursor.trim() === '')
      ) {
        violations.push({ field: 'cursor', message: 'cursor must be a non-empty string.' });
      }
    },
  ];
}

/**
 * Validates `sortField` against an allow-list and `sortDirection` against asc/desc.
 */
export function sortRule<TInput extends { sortField?: string; sortDirection?: string }>(
  allowedFields: readonly string[],
): ValidationRule<TInput> {
  return (input, violations) => {
    if (input.sortField !== undefined && !allowedFields.includes(input.sortField)) {
      violations.push({
        field: 'sortField',
        message: `sortField must be one of: ${allowedFields.join(', ')}.`,
      });
    }
    if (
      input.sortDirection !== undefined &&
      input.sortDirection !== 'asc' &&
      input.sortDirection !== 'desc'
    ) {
      violations.push({
        field: 'sortDirection',
        message: 'sortDirection must be "asc" or "desc".',
      });
    }
  };
}
