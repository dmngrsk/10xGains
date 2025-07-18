/**
 * Copy API and Database Types Script
 *
 * This script copies the API and Database type definitions from the Angular project
 * to the Supabase Edge Functions shared directory before deployment.
 *
 * NOTE: This is not meant to be a final solution. A more robust approach would
 * involve generating types from a common schema or using a code generation tool.
 *
 * A better solution would be to create a shared npm package that contains all
 * type definitions, which could be imported by both the frontend and backend.
 * This would:
 * - Eliminate manual syncing
 * - Ensure type consistency
 * - Support proper versioning
 * - Enable TypeScript's full type checking
 * - Work with both Angular and Deno environments
 */

const fs = require("fs");
const path = require("path");

// Paths
const API_SOURCE_FILE = path.join(__dirname, "../supabase/functions/api/models/api.types.ts");
const DB_SOURCE_FILE = path.join(__dirname, "../supabase/functions/api/models/database.types.ts");
const API_TARGET_FILE = path.join(__dirname, "../src/app/shared/api/api.types.ts");
const DB_TARGET_FILE = path.join(__dirname, "../src/app/shared/db/database.types.ts");

// Function to copy and transform a file
function copyTypeFile(sourceFile, targetFile, type, transformContent = null) {
  console.log(`Reading from: ${sourceFile}`);
  let sourceContent = fs.readFileSync(sourceFile, "utf8");

  // Apply any transformations if provided
  if (transformContent && typeof transformContent === 'function') {
    sourceContent = transformContent(sourceContent);
  }

  // Add comment at the top
  const targetContent = `/**
 * !!! IMPORTANT: AUTO-GENERATED FILE !!!
 *
 * This file is automatically generated from ${sourceFile.split('..')[1]}
 * Do not edit this file directly. Make changes to the source file instead.
 *
 * NOTE: This type copying approach is not meant to be a final solution.
 * A more robust approach would involve generating types from a common schema
 * or using a dedicated code generation tool.
 *
 * Recommended improvement: Create a shared npm package containing all type
 * definitions that can be imported by both Angular and Deno environments.
 * This would ensure type consistency and eliminate manual syncing.
 *
 * Last updated: ${new Date().toISOString()}
 */

${sourceContent}`;

  // Write to target file
  console.log(`Writing to: ${targetFile}`);
  fs.writeFileSync(targetFile, targetContent);
  console.log(`${type} types successfully copied!`);
}

// Copy Database types
copyTypeFile(DB_SOURCE_FILE, DB_TARGET_FILE, "Database");

// Copy API types with import path transformation
copyTypeFile(API_SOURCE_FILE, API_TARGET_FILE, "API", (content) => {
  // Update the import path to point to the correct database types file
  return content.replace(
    `import type { Database } from './database.types.ts';`,
    `import type { Database } from '../db/database.types';`,
  );
});

console.log("All types successfully synchronized!");
