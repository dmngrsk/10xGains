# Database Tests

This directory contains pgTAP-based tests for the Supabase database functions and procedures.

## Running Tests

To run all database tests:

```bash
supabase test db
```

## Test Framework

Tests use the pgTAP framework which provides:
- `plan(n)` - Declares how many tests will be run
- `ok()` - Basic assertion
- `is()` - Equality assertion  
- `lives_ok()` - Tests that code executes without error
- `throws_ok()` - Tests that code throws expected errors
- `has_function()` - Tests function existence
- `function_returns()` - Tests function return types

Each test file should begin with `begin;`, declare a plan, run tests, call `finish()`, and end with `rollback;` to ensure a clean test environment. 
