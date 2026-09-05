/*
 * Custom service worker: `ngsw-worker.js` is a build artifact and cannot be edited, so the one
 * thing it cannot do is layered on here and the Angular worker imported underneath, unchanged.
 *
 * That one thing is the notification's "Complete set" action. ngsw's only network operation is
 * `sendRequest`, a bare GET whose response is discarded, and completing a set is a PATCH carrying a
 * session action token.
 *
 * Being plain JavaScript outside the Angular build, this file cannot read `environment` or import
 * from the app; everything it needs travels in the notification's `data`.
 */

// Substituted at build time, the same way environment.ts and staticwebapp.config.json are. The
// worker previously took the API's location from the notification payload alone, which meant a
// payload that lost the field also lost any way to reach the API - or to report that it had.
const BUILD_API_URL = '__API_URL__';

const COMPLETE_SET_ACTION = 'complete-set';
const OPEN_ACTION = 'open';
const NOTIFICATION_TAG = 'active-session';
const NOTIFICATION_BADGE = '/assets/favicon/notification-badge.png';

/*
 * Every click is handled here, including opening the app. ngsw could do that part through its
 * `onActionClick` protocol, but then an action this worker does not recognise silently falls through
 * to ngsw and navigates - which looks exactly like the button doing nothing, and hides which action
 * was actually delivered. Owning the whole event keeps that observable.
 *
 * Registered before ngsw is imported so it runs first; ngsw's own handler still closes the
 * notification afterwards, which is why every path below re-shows rather than updating in place.
 */
self.addEventListener('notificationclick', event => {
  event.waitUntil(handleClick(event).catch(async error => {
    // TEMPORARY (staging diagnostic): an exception here otherwise leaves the notification closed and
    // no trace of why - the same dead end the silent guard produced.
    await self.registration.showNotification('Notification diagnostic', {
      body: `error=${error && error.message ? error.message : String(error)}`,
      tag: NOTIFICATION_TAG,
      badge: NOTIFICATION_BADGE,
      silent: true,
      requireInteraction: true,
      data: event.notification.data || {},
    });
  }));
});

importScripts('./ngsw-worker.js');

/** The build-time value where available, else whatever the notification was posted with. */
function apiBaseUrl(data) {
  const built = BUILD_API_URL.indexOf('__') === 0 ? '' : BUILD_API_URL.replace(/\/+$/, '');
  return built ? `${built}/api` : (data && data.apiBaseUrl) || '';
}

/**
 * TEMPORARY (staging diagnostic): reports to the API by requesting a URL that carries the message,
 * so it lands in request telemetry. The notification body has proven an unreliable channel - a
 * handler that never runs cannot write to it, which is indistinguishable from one that runs and
 * says nothing. An absent beacon is itself the answer.
 */
async function beacon(base, stage) {
  if (!base) {
    return;
  }

  try {
    await fetch(`${base}/health?diag=${encodeURIComponent(stage)}`, { method: 'GET' });
  } catch {
    // Reporting must never be what breaks the thing it is reporting on.
  }
}

async function handleClick(event) {
  const data = event.notification.data || {};
  const base = apiBaseUrl(data);

  await beacon(base, `click:action=${event.action === '' ? 'EMPTY' : event.action}:fields=${['apiBaseUrl', 'token', 'setId', 'sessionId'].filter(f => data[f]).join('+') || 'none'}`);

  if (event.action === COMPLETE_SET_ACTION) {
    await completeSet(data, base);
    return;
  }

  if (event.action === OPEN_ACTION) {
    await openSession(data);
    return;
  }

  // TEMPORARY (staging diagnostic): the completion request never reaches the API from Android, and
  // the leading theory is that the action id arriving here is not the one that was registered. This
  // reports what was actually delivered instead of guessing. Remove once that is settled - a body
  // tap arrives as an empty action and should open the session, not land here.
  await show(
    { title: 'Notification diagnostic', body: `action=${JSON.stringify(event.action)}` },
    data,
    !!data.setId
  );
}

async function openSession(data) {
  const url = new URL(`sessions/${data.sessionId}`, self.registration.scope).href;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  if (windows.length > 0) {
    const client = await windows[0].navigate(url);
    await (client || windows[0]).focus();
    return;
  }

  await self.clients.openWindow(url);
}

/**
 * Mirrors `session-notification.utils.ts`, which is canonical and carries the tests. A service
 * worker cannot import from the app bundle, so the duplication is unavoidable.
 */
function describeSet(nextSet) {
  const reps = `${nextSet.expected_reps} reps`;
  const description = nextSet.expected_weight ? `${reps} @ ${nextSet.expected_weight} kg` : reps;
  return {
    title: nextSet.exercise_name,
    body: `Set ${nextSet.set_number}/${nextSet.set_count} · ${description}`,
  };
}

function show(content, data, includeCompleteAction) {
  const actions = [{ action: 'open', title: 'View session' }];
  if (includeCompleteAction) {
    actions.unshift({ action: COMPLETE_SET_ACTION, title: 'Complete' });
  }

  return self.registration.showNotification(content.title, {
    body: content.body,
    tag: NOTIFICATION_TAG,
    badge: NOTIFICATION_BADGE,
    silent: true,
    requireInteraction: true,
    actions,
    data,
  });
}

async function completeSet(data, base) {
  // TEMPORARY (staging diagnostic): this guard returning silently is indistinguishable from the
  // button doing nothing, which is what it looked like on Android. Report what is actually absent.
  const missing = ['token', 'setId', 'sessionId'].filter(field => !data || !data[field]);
  if (!base) {
    missing.push('apiBaseUrl');
  }
  if (missing.length > 0) {
    await beacon(base, `guard:missing=${missing.join('+')}`);
    await show({ title: 'Notification diagnostic', body: `missing=${missing.join(',')}` }, data || {}, false);
    return;
  }

  // ngsw has already closed the notification, so this stands in while the request is on the wire.
  await show({ title: data.title, body: 'Saving…' }, data, false);

  let response;
  try {
    response = await fetch(
      `${base}/sessions/${data.sessionId}/sets/${data.setId}/complete-with-token`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token }),
      }
    );
  } catch (error) {
    // Offline, most likely. Nothing was recorded, and the token is still good, so say so and
    // leave the action in place. The reason is TEMPORARY (staging diagnostic).
    await show({ title: data.title, body: `Couldn't save - ${error && error.message ? error.message : 'tap to open'}` }, data, true);
    return;
  }

  // Spent token, finished session, or missing set: none retryable, so the notification goes away
  // rather than misleading the user. Reporting the status is TEMPORARY (staging diagnostic).
  if (!response.ok) {
    await beacon(base, `http=${response.status}`);
    await show({ title: 'Notification diagnostic', body: `http=${response.status}` }, data, false);
    return;
  }

  const body = await response.json().catch(() => null);
  const nextSet = body && body.data ? body.data.next_set : null;

  if (!nextSet) {
    await show(
      { title: 'Workout in progress', body: 'All sets done - tap to finish' },
      { ...data, setId: null, title: 'Workout in progress' },
      false
    );
    return;
  }

  const content = describeSet(nextSet);
  await show(content, { ...data, setId: nextSet.id, title: content.title }, true);
}
