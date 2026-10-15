import type { TransformFnParams } from 'class-transformer';

/** For @Transform: trims strings, leaves other types for the validators to reject. */
export function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
