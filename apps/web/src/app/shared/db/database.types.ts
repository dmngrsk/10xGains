/**
 * Compatibility shim: the generated Supabase database types now live in
 * the @txg/shared workspace package (packages/shared). Import from
 * '@txg/shared' directly in new code; this re-export keeps existing
 * '@shared/db/database.types' imports working until they are migrated.
 */
export * from '@txg/shared';
