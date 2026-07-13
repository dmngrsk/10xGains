import 'chartjs-adapter-date-fns';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { ChartData, ChartOptions, LineController, LineElement, LinearScale, PointElement, TimeScale, Tooltip } from 'chart.js';
import { BaseChartDirective, provideCharts } from 'ng2-charts';
import { ExerciseSeriesViewModel } from '@features/progress/models/progress-page.viewmodel';

const FALLBACK_SERIES_COLOR = '#49454f';

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

  ngOnChanges(): void {
    this.chartData = {
      datasets: this.series.map(s => {
        const color = this.getThemeColor(s.colorToken, FALLBACK_SERIES_COLOR);

        return {
          label: s.exerciseName,
          data: s.points.map(p => ({
            x: new Date(p.date).getTime(),
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

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
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

  private getThemeColor(token: string, fallback: string): string {
    if (typeof document === 'undefined') {
      return fallback;
    }
    const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    return value || fallback;
  }
}
