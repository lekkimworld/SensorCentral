/**
 * Helper to convert an object (string: string) into a type of 
 * known values.
 */
export type ObjectValues<T> = T[keyof T];
