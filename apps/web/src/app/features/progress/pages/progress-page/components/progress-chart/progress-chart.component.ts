import 'chartjs-adapter-date-fns';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import {
  Chart,
  ChartData,
  ChartOptions,
  Interaction,
  InteractionItem,
  InteractionModeFunction,
  LineController,
  LineElement,
  LinearScale,
  Plugin,
  PointElement,
  TimeScale,
  Tooltip,
} from 'chart.js';
import { startOfDay } from 'date-fns';
import { BaseChartDirective, provideCharts } from 'ng2-charts';
import { ExerciseSeriesViewModel } from '@features/progress/models/progress-page.viewmodel';

const FALLBACK_SERIES_COLOR = '#49454f';

declare module 'chart.js' {
  interface InteractionModeMap {
    dayX: InteractionModeFunction;
  }
}

const dayXInteractionMode: InteractionModeFunction = (chart, event, options, useFinalPosition) => {
  const nearest = Interaction.modes.nearest(chart, event, { ...options, axis: 'x', intersect: false }, useFinalPosition);
  if (nearest.length === 0) {
    return nearest;
  }

  const dayOf = (datasetIndex: number, index: number) => (chart.data.datasets[datasetIndex].data[index] as { x: number }).x;

  const targetDay = dayOf(nearest[0].datasetIndex, nearest[0].index);
  const items: InteractionItem[] = [];
  for (const meta of chart.getSortedVisibleDatasetMetas()) {
    meta.data.forEach((element, index) => {
      if (dayOf(meta.index, index) === targetDay) {
        items.push({ element, datasetIndex: meta.index, index });
      }
    });
  }
  return items;
};

Interaction.modes.dayX = dayXInteractionMode;

// Expose the Chart registry so E2E tests can introspect the live chart via
// `Chart.getChart(canvas)` (see the PROG-07 day-activation scenario).
if (typeof window !== 'undefined') {
  (window as unknown as { Chart?: typeof Chart }).Chart ??= Chart;
}

interface ProgressChartDataPoint {
  x: number;
  y: number;
  repsLabel: string;
  planName: string;
}

@Component({
  selector: 'txg-progress-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  providers: [
    provideCharts({ registerables: [LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip] }),
  ],
  templateUrl: './progress-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressChartComponent implements OnChanges {
  @Input() series: ExerciseSeriesViewModel[] = [];
  @Input() showPlanName = false;

  chartData: ChartData<'line', ProgressChartDataPoint[]> = { datasets: [] };
  chartOptions: ChartOptions<'line'> = {};
  readonly chartPlugins: Plugin<'line'>[] = [this.createSelectedDayLinePlugin()];

  private selectedDayLineColor = FALLBACK_SERIES_COLOR;

  ngOnChanges(): void {
    this.chartData = {
      datasets: this.series.map(s => {
        const color = this.getThemeColor(s.colorToken, FALLBACK_SERIES_COLOR);

        return {
          label: s.exerciseName,
          data: s.points.map(p => ({
            x: startOfDay(new Date(p.date)).getTime(),
            y: p.weight,
            repsLabel: p.repsLabel,
            planName: p.planName,
          })),
          borderColor: color,
          backgroundColor: color,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          tension: 0.2,
        };
      }),
    };
    this.chartOptions = this.buildOptions();
  }

  private buildOptions(): ChartOptions<'line'> {
    const textColor = this.getThemeColor('--mat-sys-on-surface-variant', '#49454f');
    const gridColor = this.getThemeColor('--mat-sys-outline-variant', '#cac4d0');
    this.selectedDayLineColor = textColor;

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'dayX', intersect: false },
      scales: {
        x: {
          type: 'time',
          time: { tooltipFormat: 'PP' },
          ticks: { color: textColor },
          grid: { color: gridColor },
        },
        y: {
          title: { display: true, text: 'Weight (kg)', color: textColor },
          ticks: { color: textColor },
          grid: { color: gridColor },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => {
              const point = context.raw as ProgressChartDataPoint;
              const reps = point.repsLabel ? ` – ${point.repsLabel}` : '';
              const lines = [`${context.dataset.label}: ${point.y} kg${reps}`];
              if (this.showPlanName) {
                lines.push(point.planName);
              }
              return lines;
            },
          },
        },
      },
    };
  }

  private createSelectedDayLinePlugin(): Plugin<'line'> {
    return {
      id: 'txgSelectedDayLine',
      afterDatasetsDraw: chart => {
        const active = chart.tooltip?.getActiveElements() ?? [];
        if (active.length === 0) {
          return;
        }

        const { top, bottom } = chart.chartArea;
        const ctx = chart.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = this.selectedDayLineColor;
        ctx.moveTo(active[0].element.x, top);
        ctx.lineTo(active[0].element.x, bottom);
        ctx.stroke();
        ctx.restore();
      },
    };
  }

  private getThemeColor(token: string, fallback: string): string {
    if (typeof document === 'undefined') {
      return fallback;
    }
    const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    return value || fallback;
  }
}
