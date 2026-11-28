# HandoverWatch NW

NHS operations analytics for North West England, with Liverpool University Hospitals selected by default.

- **Ambulance Handover Analytics** shows daily shares exceeding 30 and 60 minutes and the denominator of handovers with known durations. The source includes ED and non-ED destinations.
- **From Ambulance Arrival to First Clinician** shows monthly ambulance-only initial assessment times and time to being seen for treatment across eligible A&E attendances. The latter is a trust-level indicator across arrival modes. It cannot isolate ambulance arrivals or identify whether a doctor saw the patient.

## Run

Open `index.html` to use the included snapshot, or run `python -m http.server 8000` and open http://localhost:8000/. Select a trust, view and measure, then inspect a date or download the chart data.

To reproduce the snapshot, run `python -m pip install -r requirements.txt` and `python build.py`. The build uses pinned public releases, validates headers and count arithmetic, excludes unavailable or inconsistent rows, records source hashes and replaces the previous snapshot only after the new build succeeds.

## What the data shows

The snapshot contains 2,301 daily records across 19 North West trusts from 24 November 2025 to 29 March 2026, and 450 trust-months with at least one quality indicator in the September 2026 AEQI release. The data pipeline excluded 93 incomplete or inconsistent trust-days. Dates with zero known handover durations are omitted from rate charts. Open-data quality indicators and handovers are separate aggregates with different reporting populations and frequencies.

The next-day 60-minute delay-share backtest trains an expanding-window ridge model using 1-, 2- and 7-day lags. It scores eligible dates in the final 28 calendar days and compares them with a seven-day seasonal baseline. It uses previous days' published observations as though available at prediction time. Publication delays limit any use as a live forecast. On the Liverpool series the baseline MAE is **5.20 percentage points**, compared with **5.24** for ridge. The benchmark favours keeping the simpler baseline for this snapshot.

## Decision the dashboard supports

Inspect the peak delay day and its denominator, then check local staffing and arrival logs before attributing a bottleneck to handover capacity. If trust staff confirm that a recurring bottleneck coincides with low staffed capacity, review a time-limited adjustment with them. Compare observed periods before and after the change on like-for-like days and report both handover delays and clinician waiting times to check whether pressure shifted downstream.

A real pilot needs trust approval, linked de-identified encounter timestamps, clinician roles and actual staffing. Those inputs are necessary to evaluate ambulance arrival to first doctor, and to distinguish an operational intervention from other changes. This retrospective portfolio project makes no clinical triage or patient routing decisions and reports no measured reduction in waiting times.

## Sources and evidence

- [NHS England 2025–26 Urgent and Emergency Care daily situation reports](https://www.england.nhs.uk/statistics/statistical-work-areas/uec-sitrep/urgent-and-emergency-care-daily-situation-reports-2025-26/)
- [September 2026 provisional A&E Quality Indicators](https://digital.nhs.uk/data-and-information/publications/statistical/provisional-accident-and-emergency-quality-indicators-for-england/september-2026-by-provider)
- [AEQI measure metadata](https://files.digital.nhs.uk/2E/F6A7E1/aeqi_metadata.csv)
- [Skills and evidence matrix](docs/skills.csv) · implemented and planned competencies
