export const measurementsSelectors = {
  content: 'measurements-content',
  chartCanvas: 'measurement-chart-canvas',
  noDataNotice: 'measurements-no-data-notice',
  estimateBlocked: 'measurements-estimate-blocked',
  logButton: 'measurements-log-button',
  chipRow: 'measurement-chip-row',
  chip: (seriesId: string) => `measurement-chip-${seriesId}`,
  logDialog: {
    date: 'log-measurement-date',
    field: (type: string) => `log-measurement-${type}`,
    save: 'log-measurement-save',
  },
  settings: {
    card: 'measurements-settings-card',
    frequency: (label: string) => `measurements-frequency-${label}`,
    height: 'measurements-height',
    method: 'measurements-method',
    variant: 'measurements-variant',
    track: (type: string) => `measurements-track-${type}`,
    save: 'measurements-settings-save',
  },
};
