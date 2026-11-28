const byId = id => document.getElementById(id);
const trust = byId('trust'), view = byId('view'), metric = byId('metric'), point = byId('point');
const metrics = {
  handover: {over60: 'Over 60 minutes', over30: 'Over 30 minutes', backtest: 'Forecast backtest'},
  clinician: {assessment: 'Initial assessment · median', assessment95: 'Initial assessment · 95th percentile',
              treatment: 'Seen for treatment · median', treatment95: 'Seen for treatment · 95th percentile'}
};
const colours = ['var(--blue)', '#b78224', '#16886a'];
let selectedRows = [], unit = '', columns = [];

function options(control, entries) {
  control.replaceChildren(...entries.map(([value, label]) => new Option(label, value)));
}

function cards(items) {
  byId('cards').replaceChildren(...items.map(([label, value]) => {
    const card = document.createElement('article');
    const title = document.createElement('span');
    const number = document.createElement('strong');
    title.textContent = label;
    number.textContent = value;
    card.append(title, number);
    return card;
  }));
}

function draw(rows, labels, suffix) {
  const svg = byId('chart');
  svg.replaceChildren();
  if (!rows.length) return;
  const add = (type, attrs, text) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', type);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
    if (text !== undefined) element.textContent = text;
    svg.append(element);
  };
  const timestamps = rows.map(r => Date.parse(r[0]));
  const span = timestamps.at(-1) - timestamps[0];
  const maximum = Math.max(1, ...rows.flatMap(r => r.slice(1)));
  const x = index => span ? 60 + (timestamps[index] - timestamps[0]) / span * 765 : 442;
  const y = value => 235 - value / maximum * 190;
  for (let tick = 0; tick <= 4; tick++) {
    const value = maximum * tick / 4;
    add('line', {x1: 60, x2: 825, y1: y(value), y2: y(value)});
    add('text', {x: 52, y: y(value) + 4, 'text-anchor': 'end'}, Math.round(value) + suffix);
  }
  labels.forEach((label, i) => {
    const coords = rows.map((row, index) => [x(index), y(row[i+1])]);
    add('polyline', {points: coords.map(pair => pair.join(',')).join(' '), stroke: colours[i], fill: 'none', 'stroke-width': 2});
    if (coords.length === 1) add('circle', {cx: coords[0][0], cy: coords[0][1], r: 4, fill: colours[i]});
    add('text', {x: 60 + i * 245, y: 21, style: 'fill:' + colours[i]}, label);
  });
  add('text', {x: 60, y: 260}, rows[0][0]);
  if (rows.length > 1) add('text', {x: 825, y: 260, 'text-anchor': 'end'}, rows.at(-1)[0]);
}

function inspect() {
  const row = selectedRows[Number(point.value)];
  const detail = row && view.value === 'handover'
    ? NHS.trusts[trust.value].days.find(day => day[0] === row[0]) : undefined;
  const denominator = detail ? ' · ' + detail[1] + ' known durations · ' + detail[4] + ' unknown' : '';
  byId('observation').textContent = row ? row[0] + ' · ' + columns.map((label, i) =>
    label + ' ' + row[i + 1].toFixed(1) + unit).join(' · ') + denominator : 'No published observations for this selection.';
}

function render() {
  const entry = NHS.trusts[trust.value], key = metric.value;
  const handover = view.value === 'handover', backtest = key === 'backtest';
  byId('heading').textContent = metrics[view.value][key];
  byId('definition').textContent = handover
    ? 'Daily ED and non-ED handovers. Delay rates use handovers with known duration.'
    : key.startsWith('assessment')
      ? 'Monthly minutes from arrival to initial assessment for eligible ambulance arrivals.'
      : 'Monthly minutes from arrival to being seen for treatment across eligible A&E attendances. Clinician role and ambulance linkage are unavailable.';
  unit = handover ? '%' : ' min';
  const days = entry.days.filter(row => row[1] > 0);
  const model = entry.backtest;
  columns = backtest ? ['Observed', '7-day baseline', 'Ridge model'] : [metrics[view.value][key]];
  selectedRows = backtest
    ? (model?.points ?? []).map(([date, ...rates]) => [date, ...rates.map(rate => rate * 100)])
    : handover ? days.map(row => [row[0], 100 * row[key === 'over30' ? 2 : 3] / row[1]])
      : Object.entries(entry.months).sort(([a], [b]) => a.localeCompare(b))
        .filter(([, values]) => key in values).map(([date, values]) => [date, values[key]]);
  const totals = entry.days.reduce((sum, row) => [sum[0] + row[1], sum[1] + row[4]], [0, 0]);
  cards(backtest && model ? [['Baseline MAE', model.baseline_mae_pp.toFixed(2) + ' pp'],
    ['Ridge MAE', model.ridge_mae_pp.toFixed(2) + ' pp'], ['Scored days', selectedRows.length]]
    : [['Published observations shown', selectedRows.length], ['Latest displayed value', selectedRows.length ?
      selectedRows.at(-1)[1].toFixed(1) + unit : '—'], ...(handover ?
        [['Known handover durations', totals[0].toLocaleString('en-GB')], ['Unknown durations', totals[1].toLocaleString('en-GB')]] : [])]);
  options(point, selectedRows.map(([date], index) => [index, date]));
  if (selectedRows.length) point.selectedIndex = selectedRows.length - 1;
  byId('point-label').hidden = !selectedRows.length;
  byId('download').disabled = !selectedRows.length;
  draw(selectedRows, columns, handover ? '%' : '');
  inspect();
  const peak = selectedRows.reduce((best, row) => !best || row[1] > best[1] ? row : best, null);
  byId('action').textContent = !peak ? 'Review source coverage for this trust.'
    : backtest ? 'Compare holdout errors before adopting the model. The lower MAE identifies which method was closer on these scored days.'
    : handover ? 'Review ' + peak[0] + ', the highest share in this series, alongside the number of known handovers. Check local arrival volume and staffed handover capacity before trialling any change.'
    : 'Review ' + peak[0] + ', the highest published value in this series. A trust could investigate shift-level arrival and staffing logs to identify possible coverage gaps.';
}

function changeView() {
  options(metric, Object.entries(metrics[view.value]));
  render();
}

if (typeof NHS === 'undefined') {
  byId('definition').textContent = 'The data snapshot is unavailable. Refresh it with build.py and reload this page.';
} else {
  options(trust, Object.entries(NHS.trusts).map(([code, entry]) => [code, entry.name]));
  trust.value = 'REM';
  view.addEventListener('change', changeView);
  trust.addEventListener('change', render);
  metric.addEventListener('change', render);
  point.addEventListener('change', inspect);
  byId('quality').textContent = 'Excluded across the North West snapshot: ' +
    NHS.unavailable_handover_rows + ' incomplete or inconsistent trust-days and ' +
    NHS.suppressed_or_empty_aeqi_rows + ' suppressed or empty quality-indicator records.';
  byId('download').addEventListener('click', () => {
    const csv = [['Date', ...columns.map(label => label + ' (' + unit.trim() + ')')], ...selectedRows]
      .map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'handoverwatch-' + trust.value + '-' + metric.value + '.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  changeView();
}
