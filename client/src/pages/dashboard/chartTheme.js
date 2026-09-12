// Chart palette validated for colour-vision deficiency and contrast in
// both modes (dataviz validator, adjacent pairs, light surface #ffffff /
// dark surface #0f172a). Series colours are assigned in this fixed order
// — never cycled — so the same concept keeps the same hue on every chart.
export const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500'],
};

// Fixed meaning → slot mapping shared by every chart on the dashboard.
export function seriesColors(mode) {
  const s = SERIES[mode === 'dark' ? 'dark' : 'light'];
  return {
    present: s[0],
    leave: s[1],
    halfDay: s[2],
    accent: s[3],
    primary: s[0],
  };
}

export function chartChrome(mode) {
  const dark = mode === 'dark';
  return {
    grid: dark ? '#1e293b' : '#e2e8f0',
    axis: dark ? '#334155' : '#cbd5e1',
    tick: dark ? '#94a3b8' : '#64748b',
    tooltipBg: dark ? '#0f172a' : '#ffffff',
    tooltipBorder: dark ? '#334155' : '#e2e8f0',
    tooltipText: dark ? '#f1f5f9' : '#0f172a',
    cursor: dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.05)',
  };
}

export function tooltipStyle(mode) {
  const c = chartChrome(mode);
  return {
    contentStyle: {
      background: c.tooltipBg,
      border: `1px solid ${c.tooltipBorder}`,
      borderRadius: 10,
      boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
      fontSize: 12,
      color: c.tooltipText,
      padding: '8px 10px',
    },
    labelStyle: { color: c.tooltipText, fontWeight: 600, marginBottom: 4 },
    itemStyle: { color: c.tooltipText, padding: 0 },
    cursor: { fill: c.cursor },
  };
}
