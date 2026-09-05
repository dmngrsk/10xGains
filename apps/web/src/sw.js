/*
 * Custom service worker.
 *
 * `ngsw-worker.js` is a build artifact and cannot be edited, so anything the app needs beyond it is
 * layered on here and the Angular worker is imported underneath. Everything ngsw does - caching,
 * updates, and the `onActionClick` protocol behind the notification's "Open" action - is unchanged.
 *
 * The one addition is the notification's "Complete set" action, which ngsw cannot perform: its only
 * network operation is `sendRequest`, a bare GET with no headers whose response is discarded, and
 * completing a set is a PATCH carrying a session action token.
 *
 * This file is plain JavaScript outside the Angular build, so it has no access to `environment` and
 * no imports from the app. Everything it needs - the API base URL, the token, the set to complete -
 * travels in the notification's `data`, written by the page when the notification is shown.
 */

const COMPLETE_SET_ACTION = 'complete-set';
const NOTIFICATION_TAG = 'active-session';
const NOTIFICATION_ICON = '/assets/favicon/web-app-manifest-192x192.png';

/*
 * Registered before ngsw is imported, so it runs first. ngsw's own handler still runs afterwards and
 * unconditionally closes the notification, which is why every path below re-shows rather than trying
 * to update the notification in place.
 */
self.addEventListener('notificationclick', event => {
  if (event.action !== COMPLETE_SET_ACTION) {
    return;
  }

  event.waitUntil(completeSet(event.notification.data));
});

importScripts('./ngsw-worker.js');

/**
 * Mirrors `formatSetDescription` and `buildSessionNotificationContent` in the app
 * (`features/sessions/pages/session-page/utils/session-notification.utils.ts`), which are the
 * canonical versions and carry the tests. The duplication is unavoidable: a service worker cannot
 * import from the application bundle.
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
  const actions = [{ action: 'open', title: 'Open' }];
  if (includeCompleteAction) {
    actions.unshift({ action: COMPLETE_SET_ACTION, title: 'Complete set' });
  }

  return self.registration.showNotification(content.title, {
    body: content.body,
    tag: NOTIFICATION_TAG,
    icon: NOTIFICATION_ICON,
    silent: true,
    requireInteraction: true,
    actions,
    data,
  });
}

async function completeSet(data) {
  if (!data || !data.apiBaseUrl || !data.token || !data.setId || !data.sessionId) {
    return;
  }

  // ngsw has already closed the notification by now, so something has to stand in for it while the
  // request is on the wire - otherwise the shade is simply empty for as long as the round trip takes.
  await show({ title: data.title, body: 'Saving…' }, data, false);

  let response;
  try {
    response = await fetch(
      `${data.apiBaseUrl}/sessions/${data.sessionId}/sets/${data.setId}/complete-with-token`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token }),
      }
    );
  } catch {
    // Offline, most likely. The set is not recorded, so the notification has to say so rather than
    // move on; the token is still good, so opening the app is enough to recover.
    await show({ title: data.title, body: "Couldn't save - tap to open" }, data, true);
    return;
  }

  // The token is spent, the session is finished, or the set is gone. None of these are retryable and
  // all of them mean this notification is stale, so it goes away rather than misleading the user.
  if (!response.ok) {
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
