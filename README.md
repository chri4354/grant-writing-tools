# Text Timeline to Gantt Chart

A small browser app that converts plain-text timelines into a styled Gantt chart.

## Run

Open `/Users/niccolo/Downloads/gantt-chart/index.html` in your browser.

## Input format

Write one task per line:

`Task Name | YYYY-MM-DD | YYYY-MM-DD | Optional Group`

Example:

```text
Kickoff | 2026-03-01 | 2026-03-03 | Planning
UI Design | 2026-03-10 | 2026-03-18 | Design
Frontend Build | 2026-03-15 | 2026-03-28 | Development
Launch | 2026-04-07 | 2026-04-07 | Release
```

## Features

- Parses task lines with validation and clear errors
- Groups tasks with consistent colors
- Renders a responsive, polished SVG Gantt chart
- Exports the generated chart as an `.svg` file
