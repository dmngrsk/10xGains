import { MatSnackBar } from "@angular/material/snack-bar";
import { catchError, EMPTY, MonoTypeOperatorFunction, pipe } from "rxjs";

export function catchAndDisplayError<T>(action: string, snackBar: MatSnackBar): MonoTypeOperatorFunction<T> {
  return pipe(
    catchError(err => {
      snackBar.open(`${action}: ${err.message || 'Unknown error'}`, 'Close', { duration: 4000 });
      return EMPTY;
    })
  );
}
