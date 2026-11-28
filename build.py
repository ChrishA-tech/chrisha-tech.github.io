"""Refresh the public dashboard from pinned NHS releases."""
import csv
import hashlib
import io
import json
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen

import numpy as np
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent
SOURCES = {
    'handover': 'https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2026/04/Web-File-Timeseries-Ambulance-Collection-dpkj63.xlsx',
    'clinician': 'https://files.digital.nhs.uk/67/AB50FF/aeqi_open_data_2026_09.csv',
}
MEASURES = {'AEQI031': 'assessment', 'AEQI032': 'assessment95',
            'AEQI041': 'treatment', 'AEQI042': 'treatment95'}


def handovers(raw):
    sheet = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)['Handovers']
    rows = iter(sheet.values)
    next(rows)
    next(rows)
    dates = next(rows)
    next(rows)
    headers = next(rows)
    fields = ('Handover time known', 'Over 15 minutes', 'Over 30 minutes',
              'Over 45 minutes', 'Over 60 minutes', 'Handover time unknown', 'All handovers')
    starts = [(i, value.date().isoformat()) for i, value in enumerate(dates)
              if isinstance(value, datetime)]
    if not starts or any(headers[i:i + 7] != fields for i, _ in starts):
        raise ValueError('Unexpected NHS handover workbook layout')
    result = {}
    omitted = 0
    for row in rows:
        region, code, name = row[:3]
        if region != 'North West':
            continue
        if code in result:
            raise ValueError(f'Duplicate handover trust: {code}')
        result[code] = {'name': name, 'days': [], 'months': {}}
        for i, date in starts:
            counts = row[i:i + 7]
            if any(type(n) is not int for n in counts):
                omitted += 1
                continue
            known, m15, m30, m45, m60, unknown, total = counts
            if not (known >= m15 >= m30 >= m45 >= m60 >= 0 and unknown >= 0
                    and total == known + unknown):
                omitted += 1
                continue
            result[code]['days'].append([date, known, m30, m60, unknown, total])
    return result, omitted


def add_clinician(raw, trusts):
    suppressed = 0
    for row in csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))):
        trust = trusts.get(row['ORG_CODE'])
        key = MEASURES.get(row['MEASURE_ID'])
        if trust is None or key is None:
            continue
        if row['SUPPRESSION'].strip() or not row['MEASURE_VALUE'].strip():
            suppressed += 1
            continue
        value = float(row['MEASURE_VALUE'])
        month = datetime.strptime(row['ATTENDANCE_MONTH'], '%Y-%m').strftime('%Y-%m')
        values = trust['months'].setdefault(month, {})
        if key in values or not np.isfinite(value) or value < 0:
            raise ValueError(f'Invalid or duplicate AEQI measure: {row}')
        values[key] = value
    return suppressed


def benchmark(days):
    """Expanding-window backtest on the final 28 days, using lagged observations."""
    rates = {datetime.fromisoformat(d).toordinal(): sixty / known
             for d, known, _, sixty, _, _ in days if known}
    points = []
    training = []
    for day, actual in sorted(rates.items()):
        if not all(day - lag in rates for lag in (1, 2, 7)):
            continue
        x = [1, rates[day-1], rates[day-2], rates[day-7]]
        if day > max(rates) - 28 and len(training) >= 28:
            features, labels = map(np.asarray, zip(*training))
            penalty = np.diag([0, .05, .05, .05])
            coef = np.linalg.solve(features.T @ features + penalty, features.T @ labels)
            points.append([datetime.fromordinal(day).date().isoformat(), actual,
                           x[-1], float(np.clip(x @ coef, 0, 1))])
        training.append((x, actual))
    if not points:
        return None
    values = np.asarray([p[1:] for p in points])
    return {'points': points, 'baseline_mae_pp': float(np.mean(abs(values[:, 0]-values[:, 1]))*100),
            'ridge_mae_pp': float(np.mean(abs(values[:, 0]-values[:, 2]))*100)}


def main():
    payloads = {}
    for name, url in SOURCES.items():
        with urlopen(url, timeout=40) as response:
            payloads[name] = response.read()
    trusts, omitted = handovers(payloads['handover'])
    suppressed = add_clinician(payloads['clinician'], trusts)
    for trust in trusts.values():
        trust['backtest'] = benchmark(trust['days'])
    if not trusts['REM']['months']:
        raise ValueError('Liverpool AEQI series missing')
    output = {'trusts': trusts, 'sources': {
        name: {'url': url, 'sha256': hashlib.sha256(payloads[name]).hexdigest()}
        for name, url in SOURCES.items()},
        'unavailable_handover_rows': omitted, 'suppressed_or_empty_aeqi_rows': suppressed}
    target = ROOT / 'data' / 'observations.js'
    temp = target.with_suffix('.tmp')
    temp.write_text('const NHS = ' + json.dumps(output, separators=(',', ':'), allow_nan=False) + ';\n')
    temp.replace(target)
    print(f"{len(trusts)} trusts, {sum(len(t['days']) for t in trusts.values())} trust-days, "
          f"{sum(len(t['months']) for t in trusts.values())} trust-months")


if __name__ == '__main__':
    main()
