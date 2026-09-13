# Frontend (@txg/web)

Angular 22 application with Angular Material Design 3 and Tailwind CSS 4.

## Feature Organization

Think in **features** when organizing files. Each feature resides in `src/app/features/` in its dedicated feature folder.

Each feature should contain a `routes.ts` file with a routing config:

```ts
export const MY_FEATURE_ROUTES: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    component: MyFeatureComponent,
    canActivate: [ /* ... */ ]
  }
];
```

Such configs are imported in `src/app/app.routes.ts` with the following syntax for lazy loading:

```ts
{
  path: 'my-feature',
  loadChildren: () => import('./my-feature/my-feature.routes').then(m => m.MY_FEATURE_ROUTES),
  canActivate: [ /* ... */ ]
},
```

Additionally, each feature folder includes a `shared/` directory for storing mutual files and an `api/` directory for services that connect to the backend, together with their associated contract models.

## Backend Access

- Use dedicated `*.service.ts` data services for backend communication in components (implement them when necessary), rather than directly using `@supabase/supabase-js`.
- API DTOs and command models come from the `@txg/shared` workspace package — import them via `import { ... } from '@txg/shared';`.

## Angular Best Practices

- **Naming**: kebab-case filenames with Angular suffixes (`.component.ts`, `.service.ts`, `.directive.ts`, `.pipe.ts`, `.spec.ts`); descriptive identifiers like `isUserLoggedIn`, `fetchData()`.
- **Style**: Single quotes, 2-space indentation, prefer `const`, template literals for interpolation; imports at the top ordered Angular core → RxJS → Angular modules → core app → shared → environment → relative.

## Charts

- Charts are Chart.js, used through `ng2-charts` (`BaseChartDirective` in the template, `provideCharts` in the component's `providers`).
- Register only the controllers, elements, and scales a chart actually needs (e.g. `LineController`, `LineElement`, `PointElement`, `LinearScale`, `TimeScale`, `Tooltip`); avoid `withDefaultRegisterables`, which defeats tree-shaking.
- A time-scaled axis needs a date adapter: `import 'chartjs-adapter-date-fns';` in the chart component.
- Derive chart colors from the Material 3 system variables (`--mat-sys-on-surface-variant`, `--mat-sys-outline-variant`, …) so charts follow the app theme instead of hardcoding light-theme colors.
- The canvas sizes itself to its container, so give that container a definite height. Inside a flex column, that means `flex-1 min-h-0` — a fixed height wastes screen space on tall viewports.

## Tailwind CSS

- Do NOT use Tailwind classes to style Angular Material components directly.
