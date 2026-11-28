"""Check the bundled observations without contacting NHS endpoints."""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main():
    snapshot = (ROOT / 'data/observations.js').read_text().strip()
    assert snapshot.startswith('const NHS = ') and snapshot.endswith(';')
    data = json.loads(snapshot.removeprefix('const NHS = ').removesuffix(';'))
    for source in data['sources'].values():
        assert source['url'].startswith('https://')
        assert re.fullmatch('[a-f0-9]{64}', source['sha256'])
    trusts = data['trusts']
    assert len(trusts) == 19
    assert sum(len(trust['days']) for trust in trusts.values()) == 2301
    assert sum(len(trust['months']) for trust in trusts.values()) == 450
    for trust in trusts.values():
        dates = [row[0] for row in trust['days']]
        assert dates == sorted(set(dates))
        for _, known, over30, over60, unknown, total in trust['days']:
            assert known >= over30 >= over60 >= 0 and unknown >= 0
            assert total == known + unknown
        for measures in trust['months'].values():
            assert all(value >= 0 for value in measures.values())
    liverpool = trusts['REM']
    model = liverpool['backtest']
    assert model['baseline_mae_pp'] < model['ridge_mae_pp']
    assert set(liverpool['months']['2026-09']) == {'assessment', 'assessment95', 'treatment', 'treatment95'}
    with (ROOT / 'docs/skills.csv').open(newline='') as file:
        skills = list(csv.DictReader(file))
    assert len(skills) == len({row['id'] for row in skills}) == 330
    assert all((ROOT / row['evidence'].split('#')[0]).is_file()
               for row in skills if row['status'] == 'Implemented')
    print('Snapshot, data invariants, Liverpool benchmark and skills evidence passed.')


if __name__ == '__main__':
    main()
