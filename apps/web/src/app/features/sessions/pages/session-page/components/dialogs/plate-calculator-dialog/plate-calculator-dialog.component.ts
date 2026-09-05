import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipSelectionChange, MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { WorkoutPreferencesService } from '@shared/services/workout-preferences.service';
import {
  BAR_WEIGHT_KG,
  DEFAULT_PLATE_DENOMINATIONS_KG,
  MAX_WEIGHT_KG,
  PLATE_DENOMINATIONS_KG,
  PlateDenominationKg,
  buildLoadTable,
  loadableStepsKg,
  nextLoadableKg,
  previousLoadableKg,
  sanitizeDenominations,
  snapDownToLoadableKg,
  solvePlates,
} from '../../../utils/plate-calculator.utils';

export interface PlateCalculatorDialogData {
  initialWeightKg: number;
}

/** How a plate is drawn, at the same scale as the bar: 1 unit ≈ 3.2 mm. */
interface PlateVisual {
  /** IWF colours, which repeat one decade down (25 and 2.5 are both red)... */
  fill: string;
  /** ...so every plate carries a stroke, and diameter is what separates a 25 from a 2.5. */
  stroke: string;
  /** Real disc diameter. The four large discs are all 450 mm, so colour separates those. */
  height: number;
  /** Real disc thickness, which is why a 25 takes noticeably more sleeve than a 10. */
  width: number;
}

/*
 * Hues stay fixed rather than tracking the Material palette: a themed blue plate is a wrong plate.
 * Diameters are the IWF discs to scale - 450 mm for the large four, then the change plates falling
 * away sharply - which is what keeps the decade repeats apart: a 2.5 is the same red as a 25 and
 * 42% of its diameter.
 *
 * Thickness runs at 1.5x the diameters' scale, so the plates carry more of the picture than a
 * photograph would give them. The sleeve holding them is true to scale, so it fills sooner than a
 * real one - four 25s rather than seven - and the `+N` marker covers the rest. Thickness is true to
 * its own scale down to the 5 kg and then stops: a
 * 0.5 kg disc is 14 mm, which even at 1.5x is barely two pixels of fill inside its own stroke, and
 * two of them side by side cannot be counted. So nothing is drawn thinner than the 5 kg, and below
 * that weight the ranking passes to diameter, which has room to spare - 33 units against 71.
 */
const PLATE_VISUALS: Record<PlateDenominationKg, PlateVisual> = {
  25: { height: 140, width: 27, fill: '#c8332c', stroke: '#8c231e' },
  20: { height: 140, width: 23, fill: '#2f6fb5', stroke: '#1f4d80' },
  15: { height: 140, width: 18, fill: '#e5b700', stroke: '#a08000' },
  10: { height: 140, width: 16, fill: '#3f8f4f', stroke: '#2b6437' },
  5: { height: 71, width: 12, fill: '#ececec', stroke: '#9aa0a4' },
  2.5: { height: 59, width: 12, fill: '#c8332c', stroke: '#8c231e' },
  2: { height: 50, width: 12, fill: '#2f6fb5', stroke: '#1f4d80' },
  1.5: { height: 43, width: 12, fill: '#e5b700', stroke: '#a08000' },
  1.25: { height: 42, width: 12, fill: '#1f2124', stroke: '#5b6167' },
  1: { height: 37, width: 12, fill: '#3f8f4f', stroke: '#2b6437' },
  0.5: { height: 33, width: 12, fill: '#ececec', stroke: '#9aa0a4' },
};

/*
 * The bar, drawn to the IWF men's specification: 2200 mm long, 1310 mm of shaft between the
 * collars, 415 mm of loadable sleeve each side, 28 mm shaft and 50 mm sleeve diameters, knurl where
 * the hands and the centre go.
 *
 * Every part of the bar itself is to scale; only the plates on it are not.
 *
 * The knurl is the men's-bar pattern: a 120 mm band at the centre, then a long grip section each
 * side running from roughly 215 mm out to the collar, broken by the IWF grip mark - which is a
 * smooth ring in the knurl at 455 mm from centre, 910 mm apart, the one lifters set their hands to.
 *
 * All of it is constant, which is the point: the viewBox used to be sized to the current stack, so
 * every plate added rescaled the whole drawing - the bar grew shorter and the plates smaller as the
 * load got heavier, which is backwards. A fixed box fixes the scale, and only the stack grows.
 */
const SHAFT_HALF_LENGTH = 204;
const SHAFT_HEIGHT = 9;
const COLLAR_WIDTH = 10;
const COLLAR_HEIGHT = 24;
const SLEEVE_LENGTH = 128;
const SLEEVE_HEIGHT = 16;
const END_CAP_WIDTH = 4;
const END_CAP_HEIGHT = 20;
const CENTRE_KNURL_HALF = 18;
const GRIP_KNURL_START = 67;
const GRIP_MARK_CENTRE = 141;
const GRIP_MARK_WIDTH = 3;

/** Where a stack starts: the outer face of the collar. */
const STACK_START = SHAFT_HALF_LENGTH + COLLAR_WIDTH;
const BAR_HALF_LENGTH = STACK_START + SLEEVE_LENGTH;

const DRAWING_MARGIN = 8;
const HALF_WIDTH = BAR_HALF_LENGTH + DRAWING_MARGIN;
const CENTRE_Y = 80;

/*
 * 700 x 160 is 4.4:1, so at the dialog's width the drawing lands about 80 px tall - which is where
 * the stage's `h-22` (88 px) comes from. The stage height is fixed rather than `auto` because with
 * `auto` a wider viewBox renders *shorter*, and the stepper and the loading below it would move
 * every time a plate was added.
 */
const VIEWBOX_HEIGHT = 160;

/** Wide enough for "+9" at this scale. The sleeve holds four 25s, or three and this marker. */
const OVERFLOW_MARKER_WIDTH = 24;
const OVERFLOW_MARKER_HEIGHT = 28;
const OVERFLOW_MARKER_FONT_SIZE = 20;

/** One step, then a repeat, so 20 kg to 140 kg is a hold instead of 48 taps. */
const HOLD_DELAY_MS = 400;
const HOLD_REPEAT_MS = 100;

/** At most this many distinct steps are named in the uneven-rack warning before it trails off. */
const MAX_LISTED_STEPS = 3;

interface DrawnRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  fill: string;
  stroke?: string;
}

interface DrawnMarker {
  x: number;
  y: number;
  label: string;
}

interface BarDrawing {
  viewBox: string;
  title: string;
  rects: DrawnRect[];
  markers: DrawnMarker[];
}

interface PlateGroup {
  denomination: PlateDenominationKg;
  count: number;
}

@Component({
  selector: 'txg-plate-calculator-dialog',
  standalone: true,
  imports: [MatButtonModule, MatChipsModule, MatDialogModule, MatIconModule],
  templateUrl: './plate-calculator-dialog.component.html',
  styleUrl: './plate-calculator-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlateCalculatorDialogComponent implements OnDestroy {
  private readonly preferences = inject(WorkoutPreferencesService);
  private readonly data = inject<PlateCalculatorDialogData>(MAT_DIALOG_DATA);

  private holdTimeout?: ReturnType<typeof setTimeout>;
  private holdInterval?: ReturnType<typeof setInterval>;

  readonly barWeightKg = BAR_WEIGHT_KG;
  readonly markerFontSize = OVERFLOW_MARKER_FONT_SIZE;
  readonly denominations = PLATE_DENOMINATIONS_KG;

  readonly available = signal<PlateDenominationKg[]>(sanitizeDenominations(this.preferences.plateInventory()));
  readonly isLadderExpanded = signal(false);

  readonly table = computed(() => buildLoadTable(this.available()));

  /**
   * The weight the session prescribes is shown as prescribed, not snapped to something the rack can
   * build. A progression on a 1 kg increment reaches 101 kg, and opening on "100 kg" with a correct
   * loading under it would be the calculator quietly answering a different question - the same
   * hazard a typed weight is protected from. If it cannot be built, the shortfall line says so.
   */
  readonly weightKg = signal(this.clamp(this.data.initialWeightKg));

  readonly solution = computed(() => solvePlates(this.weightKg(), this.table()));

  readonly loading = computed(() => groupPlates(this.solution().perSide));

  readonly shortfallKg = computed(() => this.solution().remainderKg);
  readonly closestLoadableKg = computed(() => round(this.weightKg() - this.shortfallKg()));

  readonly canDecrement = computed(() => this.weightKg() > BAR_WEIGHT_KG);
  readonly canIncrement = computed(() => nextLoadableKg(this.weightKg(), this.table()) !== this.weightKg());

  /**
   * How far a press moves, which is not constant: the buttons walk the loadable weights, so the gap
   * changes with the rack and with where the user is standing on it. Deliberately not the weight the
   * press lands on - that number is one press away and about to be shown in full size below.
   */
  readonly stepHint = computed(() => {
    const step = round(nextLoadableKg(this.weightKg(), this.table()) - this.weightKg());
    return step > 0 ? `Steps by ${step} kg from here` : 'Nothing heavier can be loaded from this rack';
  });

  /** More than one distinct gap means the stepper jumps by different amounts; say so. */
  readonly unevenSteps = computed(() => loadableStepsKg(this.table()));

  readonly unevenMessage = computed(() => {
    const steps = this.unevenSteps();
    if (steps.length < 2) {
      return null;
    }

    const listed = steps.slice(0, MAX_LISTED_STEPS);
    const spelled = `${listed.slice(0, -1).join(', ')} and ${listed[listed.length - 1]}`;
    const tail = steps.length > MAX_LISTED_STEPS ? ' kg, among others.' : ' kg.';
    return `Uneven rack — loadable weights step by ${spelled}${tail}`;
  });

  /**
   * A chip is visible when it is one of the default five *or* currently selected, so a 25 kg plate
   * in the rack never sits behind the disclosure while the drawing shows it on the bar. Deselecting
   * it is also what puts the row back to five.
   */
  readonly visibleDenominations = computed(() => {
    const available = this.available();
    return this.isLadderExpanded()
      ? [...PLATE_DENOMINATIONS_KG].sort(ascending)
      : PLATE_DENOMINATIONS_KG
        .filter(kg => (DEFAULT_PLATE_DENOMINATIONS_KG as readonly number[]).includes(kg) || available.includes(kg))
        .sort(ascending);
  });

  readonly drawing = computed(() => this.draw(this.solution().perSide));

  isAvailable(denomination: PlateDenominationKg): boolean {
    return this.available().includes(denomination);
  }

  onDenominationToggled(denomination: PlateDenominationKg, event: MatChipSelectionChange): void {
    if (!event.isUserInput) {
      return;
    }

    const available = this.available();

    if (!event.selected) {
      // An empty rack has no answer to give, so the last chip refuses to come off.
      if (available.length === 1) {
        event.source.selected = true;
        return;
      }
      this.applyAvailable(available.filter(kg => kg !== denomination));
      return;
    }

    this.applyAvailable(PLATE_DENOMINATIONS_KG.filter(kg => kg === denomination || available.includes(kg)));
  }

  onLadderToggled(): void {
    this.isLadderExpanded.update(expanded => !expanded);
  }

  onStepPressed(direction: 1 | -1): void {
    this.clearHold();
    this.step(direction);

    this.holdTimeout = setTimeout(() => {
      this.holdInterval = setInterval(() => this.step(direction), HOLD_REPEAT_MS);
    }, HOLD_DELAY_MS);
  }

  onStepReleased(): void {
    this.clearHold();
  }

  onWeightFocused(input: HTMLInputElement): void {
    input.select();
  }

  /**
   * A typed weight is solved as given rather than snapped: if the rack cannot build it, the
   * shortfall line says so. Moving a number the user typed is how you end up under a bar that is
   * not the weight on the screen.
   */
  onWeightCommitted(input: HTMLInputElement): void {
    const parsed = Number.parseFloat(input.value.replace(',', '.'));

    if (!Number.isFinite(parsed)) {
      this.resetWeightInput(input);
      return;
    }

    this.weightKg.set(this.clamp(parsed));
    this.resetWeightInput(input);
  }

  /**
   * The CDK dispatches overlay keyboard events from a `keydown` listener on `body`, so an Escape
   * that is allowed to bubble reverts the field and closes the dialog in the same keystroke - which
   * makes the revert unreachable. Escape in the field means "undo what I typed", nothing more.
   */
  onWeightReverted(input: HTMLInputElement, event: Event): void {
    event.stopPropagation();
    this.resetWeightInput(input);
    input.blur();
  }

  onWeightSubmitted(input: HTMLInputElement): void {
    this.onWeightCommitted(input);
    input.blur();
  }

  onWeightStepped(direction: 1 | -1, event: Event): void {
    event.preventDefault();
    this.step(direction);
  }

  ngOnDestroy(): void {
    // A dialog closed mid-hold must not leave an interval running behind it.
    this.clearHold();
  }

  private step(direction: 1 | -1): void {
    const table = this.table();
    const before = this.weightKg();
    const after = direction > 0 ? nextLoadableKg(before, table) : previousLoadableKg(before, table);

    // A held button that runs into the bar or the cap stops repeating: it is disabled at that
    // point, so its pointerup never arrives and the interval would otherwise outlive the press.
    if (after === before) {
      this.clearHold();
      return;
    }

    this.weightKg.set(after);
  }

  private applyAvailable(next: PlateDenominationKg[]): void {
    this.available.set(next);
    this.preferences.setPlateInventory(next);
    this.weightKg.update(weight => snapDownToLoadableKg(weight, this.table()));
  }

  private resetWeightInput(input: HTMLInputElement): void {
    input.value = String(this.weightKg());
  }

  private clamp(kg: number): number {
    return Math.min(MAX_WEIGHT_KG, Math.max(BAR_WEIGHT_KG, round(kg)));
  }

  private clearHold(): void {
    clearTimeout(this.holdTimeout);
    clearInterval(this.holdInterval);
    this.holdTimeout = undefined;
    this.holdInterval = undefined;
  }

  /**
   * The bar and what is on it. Plates load outward from the collar, mirrored, and the sleeve is
   * drawn its full length whether or not the stack fills it - a real one is too.
   */
  private draw(perSide: PlateDenominationKg[]): BarDrawing {
    const { drawn, hidden } = fitToSleeve(perSide);

    const rects: DrawnRect[] = [
      // Sleeves, from the collars out to the end caps.
      sleeve(HALF_WIDTH + STACK_START),
      sleeve(HALF_WIDTH - STACK_START - SLEEVE_LENGTH),
      // The shaft, with the knurl the hands and the chest go on.
      rect(HALF_WIDTH - SHAFT_HALF_LENGTH, CENTRE_Y - SHAFT_HEIGHT / 2, SHAFT_HALF_LENGTH * 2,
        SHAFT_HEIGHT, 0, 'var(--mat-sys-outline)'),
      knurl(HALF_WIDTH - CENTRE_KNURL_HALF, CENTRE_KNURL_HALF * 2),
      knurl(HALF_WIDTH + GRIP_KNURL_START, SHAFT_HALF_LENGTH - GRIP_KNURL_START),
      knurl(HALF_WIDTH - SHAFT_HALF_LENGTH, SHAFT_HALF_LENGTH - GRIP_KNURL_START),
      // The grip marks: smooth rings in the knurl, not lines drawn on it.
      gripMark(HALF_WIDTH + GRIP_MARK_CENTRE),
      gripMark(HALF_WIDTH - GRIP_MARK_CENTRE - GRIP_MARK_WIDTH),
      // The inside stops each stack loads against.
      collar(HALF_WIDTH + SHAFT_HALF_LENGTH),
      collar(HALF_WIDTH - STACK_START),
    ];

    let rightX = HALF_WIDTH + STACK_START;
    let leftX = HALF_WIDTH - STACK_START;

    for (const denomination of drawn) {
      const plate = PLATE_VISUALS[denomination];
      rects.push(plateRect(rightX, plate));
      rects.push(plateRect(leftX - plate.width, plate));
      rightX += plate.width;
      leftX -= plate.width;
    }

    const markers: DrawnMarker[] = [];
    if (hidden > 0) {
      for (const markerX of [rightX, leftX - OVERFLOW_MARKER_WIDTH]) {
        rects.push(rect(markerX, CENTRE_Y - OVERFLOW_MARKER_HEIGHT / 2, OVERFLOW_MARKER_WIDTH,
          OVERFLOW_MARKER_HEIGHT, 4, 'var(--mat-sys-outline-variant)'));
        markers.push({ x: markerX + OVERFLOW_MARKER_WIDTH / 2, y: CENTRE_Y + 7, label: `+${hidden}` });
      }
    }

    rects.push(endCap(HALF_WIDTH + BAR_HALF_LENGTH - END_CAP_WIDTH));
    rects.push(endCap(HALF_WIDTH - BAR_HALF_LENGTH));

    return {
      viewBox: `0 0 ${HALF_WIDTH * 2} ${VIEWBOX_HEIGHT}`,
      title: this.describe(perSide),
      rects,
      markers,
    };
  }

  /** The drawing is the primary output of this dialog, so it has to survive a screen reader. */
  private describe(perSide: PlateDenominationKg[]): string {
    if (perSide.length === 0) {
      return `A ${BAR_WEIGHT_KG} kilogram bar with no plates.`;
    }

    const parts = groupPlates(perSide).map(group => group.count > 1
      ? `${group.count} plates of ${group.denomination} kg`
      : `one ${group.denomination} kg plate`);

    return `A ${BAR_WEIGHT_KG} kilogram bar loaded with ${parts.join(', ')} per side.`;
  }
}

function groupPlates(perSide: readonly PlateDenominationKg[]): PlateGroup[] {
  const groups: PlateGroup[] = [];

  for (const denomination of perSide) {
    const last = groups[groups.length - 1];
    if (last?.denomination === denomination) {
      last.count++;
      continue;
    }
    groups.push({ denomination, count: 1 });
  }

  return groups;
}

function rect(x: number, y: number, width: number, height: number, rx: number, fill: string): DrawnRect {
  return { x, y, width, height, rx, fill };
}

function sleeve(x: number): DrawnRect {
  return rect(x, CENTRE_Y - SLEEVE_HEIGHT / 2, SLEEVE_LENGTH, SLEEVE_HEIGHT, 0, 'var(--mat-sys-outline)');
}

function collar(x: number): DrawnRect {
  return rect(x, CENTRE_Y - COLLAR_HEIGHT / 2, COLLAR_WIDTH, COLLAR_HEIGHT, 2, 'var(--mat-sys-on-surface-variant)');
}

function knurl(x: number, width: number): DrawnRect {
  return rect(x, CENTRE_Y - SHAFT_HEIGHT / 2, width, SHAFT_HEIGHT, 0, 'var(--mat-sys-on-surface-variant)');
}

function gripMark(x: number): DrawnRect {
  return rect(x, CENTRE_Y - SHAFT_HEIGHT / 2, GRIP_MARK_WIDTH, SHAFT_HEIGHT, 0, 'var(--mat-sys-outline)');
}

function endCap(x: number): DrawnRect {
  return rect(x, CENTRE_Y - END_CAP_HEIGHT / 2, END_CAP_WIDTH, END_CAP_HEIGHT, 2, 'var(--mat-sys-on-surface-variant)');
}

function plateRect(x: number, plate: PlateVisual): DrawnRect {
  return {
    x,
    y: CENTRE_Y - plate.height / 2,
    width: plate.width,
    height: plate.height,
    rx: 2,
    fill: plate.fill,
    stroke: plate.stroke,
  };
}

/**
 * As many plates as the sleeve actually holds, which is seven 25s or a dozen change plates - the
 * same limit the real bar has. Anything left over is counted into the `+N` marker, and the marker
 * needs sleeve of its own, so the stack is re-fitted around it.
 */
function fitToSleeve(perSide: readonly PlateDenominationKg[]): { drawn: PlateDenominationKg[]; hidden: number } {
  const fit = (capacity: number) => {
    let used = 0;
    let count = 0;
    for (const denomination of perSide) {
      const width = PLATE_VISUALS[denomination].width;
      if (used + width > capacity) break;
      used += width;
      count++;
    }
    return count;
  };

  const fitted = fit(SLEEVE_LENGTH);
  if (fitted === perSide.length) {
    return { drawn: [...perSide], hidden: 0 };
  }

  const withMarker = fit(SLEEVE_LENGTH - OVERFLOW_MARKER_WIDTH);
  return { drawn: perSide.slice(0, withMarker), hidden: perSide.length - withMarker };
}

function ascending(a: number, b: number): number {
  return a - b;
}

function round(kg: number): number {
  return Math.round(kg * 100) / 100;
}
