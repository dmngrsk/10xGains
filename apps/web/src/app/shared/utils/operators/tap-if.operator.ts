import { MonoTypeOperatorFunction } from 'rxjs';
import { tap } from 'rxjs/operators';

export function tapIf<T>(predicate: (value: T) => boolean, fn: (x: T) => void): MonoTypeOperatorFunction<T> {
  return input$ =>
    input$.pipe(
      tap(x => {
        if (predicate(x)) {
          fn(x);
        }
      })
    );
}
