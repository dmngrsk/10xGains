import 'chartjs-adapter-date-fns';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, afterNextRender, signal } from '@angular/core';
import {
  Chart,
  ChartData,
  ChartOptions,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  ScriptableContext,
  TimeScale,
  Tooltip,
} from 'chart.js';
import { BaseChartDirective, provideCharts } from 'ng2-charts';
import type { MeasurementUnit } from '@features/measurements/models/measurement-catalog';
import { MeasurementSeriesViewModel } from '@features/measurements/models/measurements.viewmodel';
import { getThemeColor } from '@shared/utils/charts/theme-color';
import { calendarDateToLocalDate } from '@shared/utils/dates/calendar-date';

const FALLBACK_SERIES_COLOR = '#49454f';
const FALLBACK_SURFACE_COLOR = '#fef7ff';

if (typeof window !== 'undefined') {
  (window as unknown as { Chart?: typeof Chart }).Chart ??= Chart;
}

interface MeasurementChartPoint {
  x: number;
  y: number;
  unit: MeasurementUnit;
  precision: number;
  carriedForward: boolean;
  estimated: boolean;
}

@Component({
  selector: 'txg-measurement-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  providers: [
    provideCharts({ registerables: [LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip] }),
  ],
  templateUrl: './measurement-chart.component.html',
  styles: [`:host { display: block; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeasurementChartComponent implements OnChanges {
  @Input() series: MeasurementSeriesViewModel[] = [];

  chartData: ChartData<'line', MeasurementChartPoint[]> = { datasets: [] };
  chartOptions: ChartOptions<'line'> = {};

  readonly rendered = signal(false);

  constructor() {
    afterNextRender(() => this.rendered.set(true));
  }

  ngOnChanges(): void {
    const surfaceColor = getThemeColor('--mat-sys-surface', FALLBACK_SURFACE_COLOR);
    const units = this.visibleUnits();

    this.chartData = { datasets: this.series.map(s => this.toDataset(s, units, surfaceColor)) };

    this.chartOptions = this.buildOptions(units);
  }

  private toDataset(
    s: MeasurementSeriesViewModel,
    units: MeasurementUnit[],
    surfaceColor: string
  ) {
    const color = getThemeColor(s.colorToken, FALLBACK_SERIES_COLOR);
    const yAxisID = units.indexOf(s.unit) === 1 ? 'y1' : 'y';
    const estimated = s.kind === 'ESTIMATED';

    const fillColor = (context: ScriptableContext<'line'>) =>
      (context.raw as MeasurementChartPoint | undefined)?.carriedForward ? surfaceColor : color;

    const base = {
      label: s.label,
      yAxisID,
      borderColor: color,
      backgroundColor: color,
      pointBackgroundColor: fillColor,
      pointHoverBackgroundColor: fillColor,
      pointBorderColor: color,
      pointHoverBorderColor: color,
      pointBorderWidth: 2,
      pointHoverBorderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
      borderDash: estimated ? [5, 4] : [],
      tension: 0.2,
    };

    return {
      ...base,
      data: s.points.map(p => ({
        x: calendarDateToLocalDate(p.date).getTime(),
        y: p.value,
        unit: s.unit,
        precision: s.precision,
        carriedForward: p.carriedForward,
        estimated,
      })),
    };
  }

  private visibleUnits(): MeasurementUnit[] {
    const units: MeasurementUnit[] = [];

    for (const s of this.series) {
      if (!units.includes(s.unit)) {
        units.push(s.unit);
      }
    }

    return units.slice(0, 2);
  }

  private buildOptions(units: MeasurementUnit[]): ChartOptions<'line'> {
    const textColor = getThemeColor('--mat-sys-on-surface-variant', '#49454f');
    const gridColor = getThemeColor('--mat-sys-outline-variant', '#cac4d0');

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: {
          type: 'time',
          time: { tooltipFormat: 'PP' },
          ticks: { color: textColor, maxRotation: 0, autoSkipPadding: 12 },
          grid: { color: gridColor },
        },
        y: {
          position: 'left',
          title: { display: !!units[0], text: units[0] ?? '', color: textColor },
          ticks: { color: textColor },
          grid: { color: gridColor },
        },
        y1: {
          position: 'right',
          display: units.length > 1,
          title: { display: units.length > 1, text: units[1] ?? '', color: textColor },
          ticks: { color: textColor },
          grid: { drawOnChartArea: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => {
              const point = context.raw as MeasurementChartPoint;
              const value = point.y.toFixed(point.precision);
              const suffix = point.carriedForward ? ' (carried forward)' : '';
              return `${context.dataset.label}: ${value} ${point.unit}${suffix}`;
            },
          },
        },
      },
    };
  }
}
