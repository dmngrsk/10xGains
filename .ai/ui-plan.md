# UI Architecture for 10xGains

## 1. Overview of UI Structure

The UI is built with a mobile‑first approach using Angular 19, Tailwind CSS 4, and Angular Material. It provides two primary layouts:

- **MainLayout**: Displays the bottom navigation bar only on the Home Dashboard.
- **FullScreenLayout**: Shows a top app bar with a back button on Plans, Plan Editor, Active Session, History, Progress, and Settings.

Global services (AuthGuard, HttpInterceptor, shared state services) manage authentication, error handling, and data caching.

## 2. List of Views

### 2.1 Login View
- **Route**: `/login`
- **Main Goal**: Allow users to authenticate.
- **Key Info**: Email input, Password input, Submit button, Link to Register.
- **Key Components**: `ReactiveForm` with validation (Zod), `MatInput`, `MatButton`, `AuthGuard` redirect logic.
- **UX/Accessibility/Security**: Inline error messages, password show/hide, CSRF and HTTPS enforced.

### 2.2 Register View
- **Route**: `/register`
- **Main Goal**: Enable new user sign‑up.
- **Key Info**: Email input, Password input, Confirm password, Submit button.
- **Key Components**: `ReactiveForm`, `MatInput`, `MatButton`, client‑side validation.
- **UX/Accessibility/Security**: Real‑time validation, feedback snackbars for server errors, secure password requirements.

### 2.3 Home Dashboard
- **Route**: `/home`
- **Main Goal**: Display the next pending or in‐progress session and two recent historical sessions.
- **Key Info**: Three `MatCard` tiles:
  1. Next session (date, list of exercises formatted as `Exercise | NxM min–max kg`).
  2. Last session summary or “No training sessions found.”
  3. Second‐last session summary or placeholder.
- **Key Components**: `MatCard`, `Flex/Grid` (Tailwind), Skeleton loaders for loading state, inline CTA for empty state.
- **UX/Accessibility/Security**: High contrast text, swipe or tap navigations.

### 2.4 Plans List
- **Route**: `/plans`
- **Main Goal**: List all user training plans with infinite scroll.
- **Key Info**: Plan title, creation date, description preview.
- **Key Components**: `cdk-virtual-scroll-viewport` or `IntersectionObserver`, `MatCard` for items, Skeleton loader, `MatButton` to add a new plan.
- **UX/Accessibility/Security**: Announce loading state, predictable scroll, RLS ensures user sees only own plans.

### 2.5 Plan Editor
- **Route**: `/plans/:planId/edit`
- **Main Goal**: Create or modify a training plan, reorder days and exercises.
- **Key Info**: Plan metadata (name, description), list of days (`MatExpansionPanel`), within each day list of exercises.
- **Key Components**: `MatAccordion`, `MatExpansionPanel`, `CDK DragDrop` for reorder, `MatDialog` for add/edit day/exercise, `MatAutocomplete` with “Add new exercise” option, real‑time PATCH calls.
- **UX/Accessibility/Security**: Drag‐and‐drop, focus management on dialogs, error snackbar on server failures.

### 2.6 Active Session View
- **Route**: `/sessions/:sessionId`
- **Main Goal**: Track an ongoing workout session.
- **Key Info**: Fixed order list of exercises; for each exercise a row of set bubbles showing expected sets; “+” icon next to last bubble to add new sets via dialog.
- **Key Components**: `MatButton` for bubbles, `MatDialog` to add set (pre‑filled weight/reps), real‑time PATCH to update set status.
- **UX/Accessibility/Security**: Clear visual feedback for completed/failed sets, confirmation snackbars, offline warning if network drops.

### 2.7 History View
- **Route**: `/history`
- **Main Goal**: Browse past workout sessions with filters and pagination.
- **Key Info**: Chronological list of sessions (date, status), swipe or icon to open filter panel, pagination controls.
- **Key Components**: `MatDrawer` for filters (`debounceTime(100ms)` + `switchMap`), `MatPaginator`, list items with Skeleton loader.
- **UX/Accessibility/Security**: Secure RLS filter parameters.

### 2.8 Progress Stub View
- **Route**: `/progress`
- **Main Goal**: Placeholder for future analytics (“Coming soon…”).
- **Key Info**: Static message and illustration.
- **Key Components**: `MatCard`, Tailwind styling.
- **UX/Accessibility/Security**: Informative alt text for illustrations.

### 2.9 Settings View
- **Route**: `/settings`
- **Main Goal**: Allow profile editing and logout.
- **Key Info**: Email (read‐only or editable), First name, Save button, Logout button.
- **Key Components**: `ReactiveForm`, `MatInput`, `MatButton`, `HttpInterceptor` auto token refresh.
- **UX/Accessibility/Security**: Confirm dialog on logout, inline validation, HTTPS.

## 3. User Journey Map

1. **Onboarding**: `/register` ➔ successful signup ➔ redirect to `/home`.
2. **Authentication**: `/login` ➔ successful login ➔ `/home`.
3. **Overview**: `/home` (view next session or history snapshot).
4. **Plan Management**:
   - Tap Plans ➔ `/plans` ➔ tap “+” ➔ open `MatDialog` ➔ create plan ➔ navigate to `/plans/:planId/edit`.
   - In editor: add days/exercises, reorder, save ➔ snackbar confirmation.
5. **Workout Tracking**:
   - From Home or Plans, tap session ➔ `/sessions/:sessionId` ➔ mark sets complete or add sets ➔ auto‑save and PATCH calls.
6. **History & Filter**:
   - Tap History ➔ `/history` ➔ open filter panel, apply filters, page results.
7. **Settings**:
   - Tap Settings ➔ `/settings` ➔ update profile ➔ logout.

## 4. Layout and Navigation Structure

- **BottomNavigation**: Visible only on `/home`, five tabs: Home, Plans, History, Progress, Settings.
- **FullScreenLayout**: For all other routes, show a top `MatToolbar` with a back button that returns to `/home` (or other previous tab, depending on UI context).
- **Router Setup**: Angular Router with AuthGuard on protected routes (Home, Plans, Session, History, Progress, Settings).
- **HttpInterceptor**: Injects Supabase JWT, handles 401 by redirecting to `/login`, and globally catches errors to show snackbars.

## 5. Key Components

- **BottomNavigationComponent**: Manages mobile tab bar, responsive, accessible.
- **SkeletonLoaderComponent**: Generic placeholder for list and card loading states.
- **SessionCardComponent**: Renders a single session tile for Home.
- **PlanListItemComponent**: Displays plan info in the Plans list.
- **PlanEditorAccordionComponent**: Wraps `MatAccordion` and DnD logic.
- **ExerciseSelectorComponent**: `MatAutocomplete` with remote search and “Add new exercise” option.
- **FilterDrawerComponent**: Wraps `MatDrawer`, filter form with debounce.
- **PaginatorComponent**: Wraps `MatPaginator` for unified styling.
- **AuthGuard & HttpInterceptor**: Enforce security and error handling.
- **DialogService**: Centralized service to open confirmation and form dialogs.

This architecture ensures each user story from the PRD is mapped to a concrete view and set of components, aligns with the API endpoints, and prioritizes a seamless, accessible, and secure mobile‑first experience.
