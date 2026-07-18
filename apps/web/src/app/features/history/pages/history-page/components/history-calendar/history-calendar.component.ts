import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild, computed, signal } from '@angular/core';
import { addMonths, format, getDay, getDaysInMonth, parse } from 'date-fns';
import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';

interface CalendarDayVm {
  key: string; // 'yyyy-MM-dd'
  dayOfMonth: number;
  isToday: boolean;
}

interface CalendarMonthVm {
  key: string; // 'yyyy-MM'
  label: string; // 'July 2026'
  days: (CalendarDayVm | null)[]; // fixed 6x7 grid; null cells pad the month's edges
}

const WINDOW_RADIUS = 6;
const EXTEND_COUNT = 3;
const EXTEND_THRESHOLD_PX = 400;

@Component({
  selector: 'txg-history-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-calendar.component.html',
  styleUrl: './history-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryCalendarComponent implements AfterViewInit {
  @ViewChild('scroller') scroller?: ElementRef<HTMLElement>;

  @Input() set sessions(value: SessionCardViewModel[]) {
    this.sessionsSignal.set(value ?? []);
  }

  @Input() set month(value: string) {
    if (!value || value === this.monthSignal()) {
      return;
    }

    this.monthSignal.set(value);

    const range = this.monthRange();
    if (!range || !this.isWithinRange(value, range)) {
      this.monthRange.set({ start: this.addToMonth(value, -WINDOW_RADIUS), end: this.addToMonth(value, WINDOW_RADIUS) });
    }

    this.pendingScrollTarget = value;

    this.scrollToPendingTarget();
    if (this.pendingScrollTarget) {
      requestAnimationFrame(() => this.scrollToPendingTarget());
    }
  }

  @Output() monthChanged = new EventEmitter<string>();
  @Output() dayClicked = new EventEmitter<SessionCardViewModel[]>();

  readonly weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  private readonly sessionsSignal = signal<SessionCardViewModel[]>([]);
  private readonly monthSignal = signal<string>(format(new Date(), 'yyyy-MM'));
  private readonly monthRange = signal<{ start: string; end: string } | null>(null);

  private pendingScrollTarget: string | null = null;
  private extending = false;

  readonly sessionsByDay = computed(() => {
    const byDay = new Map<string, SessionCardViewModel[]>();
    for (const session of this.sessionsSignal()) {
      if (!session.sessionDate) {
        continue;
      }
      const day = format(session.sessionDate, 'yyyy-MM-dd');
      byDay.set(day, [...(byDay.get(day) ?? []), session]);
    }
    return byDay;
  });

  readonly renderedMonths = computed<CalendarMonthVm[]>(() => {
    const range = this.monthRange() ?? { start: this.monthSignal(), end: this.monthSignal() };
    const months: CalendarMonthVm[] = [];
    for (let key = range.start; key <= range.end; key = this.addToMonth(key, 1)) {
      months.push(this.buildMonth(key));
    }
    return months;
  });

  ngAfterViewInit(): void {
    this.pendingScrollTarget ??= this.monthSignal();
    if (!this.monthRange()) {
      const anchor = this.monthSignal();
      this.monthRange.set({ start: this.addToMonth(anchor, -WINDOW_RADIUS), end: this.addToMonth(anchor, WINDOW_RADIUS) });
    }
    requestAnimationFrame(() => this.scrollToPendingTarget());
  }

  onScrolled(): void {
    this.maybeExtendWindow();
    this.emitDominantMonth();
  }

  onDayClicked(dayKey: string): void {
    const daySessions = this.sessionsByDay().get(dayKey);
    if (!daySessions?.length) {
      return;
    }
    this.dayClicked.emit(daySessions);
  }

  private buildMonth(key: string): CalendarMonthVm {
    const monthStart = parse(key, 'yyyy-MM', new Date());
    const leadingBlanks = (getDay(monthStart) + 6) % 7; // Monday-first, matching the weekday header
    const daysInMonth = getDaysInMonth(monthStart);
    const todayKey = format(new Date(), 'yyyy-MM-dd');

    const days: (CalendarDayVm | null)[] = Array.from({ length: 42 }, (_, index) => {
      const dayOfMonth = index - leadingBlanks + 1;
      if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
        return null;
      }
      const dayKey = `${key}-${String(dayOfMonth).padStart(2, '0')}`;
      return { key: dayKey, dayOfMonth, isToday: dayKey === todayKey };
    });

    return { key, label: format(monthStart, 'MMMM yyyy'), days };
  }

  private scrollToPendingTarget(): void {
    const scroller = this.scroller?.nativeElement;
    if (!scroller || !this.pendingScrollTarget) {
      return;
    }

    const target = scroller.querySelector<HTMLElement>(`[data-month="${this.pendingScrollTarget}"]`);
    if (!target) {
      return;
    }

    this.pendingScrollTarget = null;
    scroller.scrollTop = target.offsetTop - this.stickyHeaderHeight();
  }

  private maybeExtendWindow(): void {
    const scroller = this.scroller?.nativeElement;
    const range = this.monthRange();
    if (!scroller || !range || this.extending) {
      return;
    }

    if (scroller.scrollTop < EXTEND_THRESHOLD_PX) {
      this.extending = true;
      const previousHeight = scroller.scrollHeight;
      this.monthRange.set({ ...range, start: this.addToMonth(range.start, -EXTEND_COUNT) });
      requestAnimationFrame(() => {
        scroller.scrollTop += scroller.scrollHeight - previousHeight;
        this.extending = false;
      });
      return;
    }

    if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < EXTEND_THRESHOLD_PX) {
      this.monthRange.set({ ...range, end: this.addToMonth(range.end, EXTEND_COUNT) });
    }
  }

  private emitDominantMonth(): void {
    const scroller = this.scroller?.nativeElement;
    if (!scroller || this.pendingScrollTarget) {
      return;
    }

    const center = scroller.scrollTop + scroller.clientHeight / 2;
    const sections = scroller.querySelectorAll<HTMLElement>('[data-month]');
    for (const section of sections) {
      if (center < section.offsetTop || center >= section.offsetTop + section.offsetHeight) {
        continue;
      }
      const dominant = section.dataset['month']!;
      if (dominant !== this.monthSignal()) {
        this.monthSignal.set(dominant);
        this.monthChanged.emit(dominant);
      }
      return;
    }
  }

  private stickyHeaderHeight(): number {
    return this.scroller?.nativeElement.querySelector<HTMLElement>('[data-weekday-header]')?.offsetHeight ?? 0;
  }

  private isWithinRange(month: string, range: { start: string; end: string }): boolean {
    return month >= range.start && month <= range.end;
  }

  private addToMonth(month: string, months: number): string {
    return format(addMonths(parse(month, 'yyyy-MM', new Date()), months), 'yyyy-MM');
  }
}
