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

- **Type safety**: Define data models using interfaces; avoid `any` and maintain strict typing.
- **Standalone components**: Use standalone components; do not introduce NgModules.
- **Signals**: Use Angular's signals system for reactive state management and rendering performance.
- **Dependency injection**: Use the `inject` function instead of constructor injection.
- **Control flow**: Use `@if`, `@for`, and `@switch` instead of `*ngIf`, `*ngFor`, etc.; use trackBy/`track` for list rendering.
- **Change detection**: Implement OnPush change detection for performance critical components.
- **Templates**: Use the `async` pipe for observables; avoid direct DOM manipulation; use `NgOptimizedImage` for images; use deferrable views for non-essential components.
- **Immutability**: Apply immutability principles and pure functions wherever possible, especially within services and state management.
- **Composition**: Favor component composition over inheritance.
- **Lazy loading**: Enable lazy loading for features to optimize initial load times.
- **Accessibility**: Use semantic HTML and relevant ARIA attributes.
- **Security**: Prevent XSS by relying on Angular's built-in sanitization; avoid `innerHTML`.
- **Naming**: kebab-case filenames with Angular suffixes (`.component.ts`, `.service.ts`, `.directive.ts`, `.pipe.ts`, `.spec.ts`); descriptive identifiers like `isUserLoggedIn`, `fetchData()`.
- **Style**: Single quotes, 2-space indentation, prefer `const`, template literals for interpolation; imports at the top ordered Angular core → RxJS → Angular modules → core app → shared → environment → relative.
- **Error handling**: Robust error handling in services and components; validation through Angular's form validation system or custom validators.
- **Performance**: Pure pipes for computationally heavy operations; optimize for Core Web Vitals (LCP, INP, CLS).

## Angular Material

- Import necessary Material modules in components that use a given control.
- Use theme mixins to customize component styles instead of overriding CSS.
- Leverage the CDK (Component Development Kit) for custom component behaviors.
- Use Material's form field components with reactive forms for consistent validation UX.
- Implement accessibility attributes and ARIA labels for interactive components; use Material's built-in a11y features like focus indicators and keyboard navigation.
- Use the Material 3 design system updates where available; leverage the Angular Material theming system and typography hierarchy.

## Charts

- Charts are Chart.js, used through `ng2-charts` (`BaseChartDirective` in the template, `provideCharts` in the component's `providers`).
- Register only the controllers, elements, and scales a chart actually needs (e.g. `LineController`, `LineElement`, `PointElement`, `LinearScale`, `TimeScale`, `Tooltip`); avoid `withDefaultRegisterables`, which defeats tree-shaking.
- A time-scaled axis needs a date adapter: `import 'chartjs-adapter-date-fns';` in the chart component.
- Derive chart colors from the Material 3 system variables (`--mat-sys-on-surface-variant`, `--mat-sys-outline-variant`, …) so charts follow the app theme instead of hardcoding light-theme colors.
- The canvas sizes itself to its container, so give that container a definite height. Inside a flex column, that means `flex-1 min-h-0` — a fixed height wastes screen space on tall viewports.

## Tailwind CSS

- Use the `@layer` directive to organize styles into components, utilities, and base layers.
- Use arbitrary values with square brackets (e.g., `w-[123px]`) for precise one-off designs.
- Leverage the `@apply` directive in component classes to reuse utility combinations; use component extraction for repeated UI patterns instead of copying utility classes.
- Use the Tailwind configuration file for customizing theme, plugins, and variants; access theme values via the `theme()` function in CSS.
- Use responsive variants (`sm:`, `md:`, `lg:`), state variants (`hover:`, `focus:`, `active:`), and the `dark:` variant where appropriate.
- Do NOT use Tailwind classes to style Angular Material components directly.
