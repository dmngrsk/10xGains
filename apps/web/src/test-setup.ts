import '@analogjs/vitest-angular/setup-zone';

import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Stands in for env.js, which only a browser loads. environment.ts throws without it, so every
// spec that reaches it transitively fails to collect.
(window as unknown as { __TXG_ENV__: unknown }).__TXG_ENV__ = {
  name: 'development',
  apiUrl: 'http://localhost:7071',
  supabaseUrl: 'http://localhost:54321',
  supabasePublishableKey: 'sb_publishable_test',
};

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
