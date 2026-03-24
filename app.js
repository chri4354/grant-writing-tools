const DEFAULT_INPUT = `Finalise experimental design and vignettes | 2026-07-01 | 2026-08-31 | Months 1-2
Implement discussion tasks and data capture on the PSi platform | 2026-07-01 | 2026-08-31 | Months 1-2
Pilot study and parameter tuning | 2026-07-01 | 2026-08-31 | Months 1-2
Ethics approval and pre-registration | 2026-07-01 | 2026-08-31 | Months 1-2
Recruit participants | 2026-09-01 | 2026-10-31 | Months 3-4
Run large-scale online experiment | 2026-09-01 | 2026-10-31 | Months 3-4
Collect discussion recordings, transcripts, and voting data | 2026-09-01 | 2026-10-31 | Months 3-4
Initial data quality checks and preprocessing | 2026-09-01 | 2026-10-31 | Months 3-4
Quantify decision variability across parallel groups | 2026-11-01 | 2026-12-31 | Months 5-6
Analyse pre/post vote shifts and group-level outcomes | 2026-11-01 | 2026-12-31 | Months 5-6
Establish empirical distributions of human decision variability | 2026-11-01 | 2026-12-31 | Months 5-6
Semantic and conversational analysis of transcripts (LLM embeddings, argument structure) | 2027-01-01 | 2027-02-28 | Months 7-8
Develop participant-level AI surrogate agents | 2027-01-01 | 2027-02-28 | Months 7-8
Identify conversational dimensions predictive of decision stability | 2027-01-01 | 2027-02-28 | Months 7-8
Implement generative conversation resampling framework | 2027-03-01 | 2027-04-30 | Months 9-10
Calibrate/validate model against observed human variability | 2027-03-01 | 2027-04-30 | Months 9-10
Write up manuscript | 2027-03-01 | 2027-04-30 | Months 9-10
Data release via OSF | 2027-05-01 | 2027-06-30 | Months 11-12
Deploy prototype | 2027-05-01 | 2027-06-30 | Months 11-12
Prepare documentation, and dissemination materials | 2027-05-01 | 2027-06-30 | Months 11-12`;

const COLOR_POOL = ["#cb5a3b", "#38618c", "#55715e", "#9b6b41", "#885a89", "#468373"];
/** CSS pixels at ~96dpi: A4 short edge × long edge */
const A4_SHORT_PX = 794;
const A4_LONG_PX = 1123;
/** ~300dpi export: A4 short × long */
const EXPORT_A4_SHORT = 2480;
const EXPORT_A4_LONG = 3508;

const input = document.getElementById("timelineInput");
const pageOrientation = document.getElementById("pageOrientation");
const renderButton = document.getElementById("renderButton");
const exampleButton = document.getElementById("exampleButton");
const copyButton = document.getElementById("copyButton");
const downloadButton = document.getElementById("downloadButton");
const statusMessage = document.getElementById("statusMessage");
const chartHost = document.getElementById("chartHost");

input.value = DEFAULT_INPUT;
renderChartFromInput();

renderButton.addEventListener("click", renderChartFromInput);
pageOrientation.addEventListener("change", renderChartFromInput);
exampleButton.addEventListener("click", () => {
  input.value = DEFAULT_INPUT;
  renderChartFromInput();
});
copyButton.addEventListener("click", copyImageToClipboard);
chartHost.addEventListener("click", (event) => {
  if (event.target.closest("svg")) {
    copyImageToClipboard();
  }
});
downloadButton.addEventListener("click", downloadPNG);

function parseTimeline(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("Add at least one task line.");
  }

  const tasks = lines.map((line, idx) => {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 3) {
      throw new Error(`Line ${idx + 1}: expected at least 3 fields separated by |.`);
    }

    const [name, startRaw, endRaw, groupRaw] = parts;
    if (!name) {
      throw new Error(`Line ${idx + 1}: task name is required.`);
    }

    const start = parseDate(startRaw, idx + 1, "start");
    const end = parseDate(endRaw, idx + 1, "end");
    if (end < start) {
      throw new Error(`Line ${idx + 1}: end date must be on or after start date.`);
    }

    return {
      name,
      start,
      end,
      group: groupRaw || "General"
    };
  });

  tasks.sort((a, b) => a.start - b.start);
  return tasks;
}

function parseDate(value, line, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Line ${line}: ${label} date must be YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Line ${line}: ${label} date is invalid.`);
  }
  return date;
}

function getPageLayout() {
  const landscape = pageOrientation.value === "landscape";
  if (landscape) {
    return {
      pageWidth: A4_LONG_PX,
      pageHeight: A4_SHORT_PX,
      exportWidth: EXPORT_A4_LONG,
      exportHeight: EXPORT_A4_SHORT,
      orientationLabel: "landscape"
    };
  }
  return {
    pageWidth: A4_SHORT_PX,
    pageHeight: A4_LONG_PX,
    exportWidth: EXPORT_A4_SHORT,
    exportHeight: EXPORT_A4_LONG,
    orientationLabel: "portrait"
  };
}

function renderChartFromInput() {
  try {
    const tasks = parseTimeline(input.value);
    const svg = buildGanttSVG(tasks, getPageLayout());
    chartHost.replaceChildren(svg);
    setStatus(`Click the chart (or Copy Image) to copy.`);
  } catch (err) {
    setStatus(err.message, true);
  }
}

function buildGanttSVG(tasks, layout) {
  const { pageWidth, pageHeight } = layout;
  const dayMs = 24 * 60 * 60 * 1000;
  const labelWidth = 390;
  const topPad = 92;
  const bottomPad = 28;
  const rightPad = 20;
  const usableHeight = pageHeight - topPad - bottomPad;
  const rowHeight = Math.max(36, Math.floor(usableHeight / tasks.length));

  const minDate = floorDate(new Date(Math.min(...tasks.map((t) => t.start.getTime()))));
  const maxDate = floorDate(new Date(Math.max(...tasks.map((t) => t.end.getTime()))));
  const spanMs = Math.max(dayMs, maxDate - minDate + dayMs);

  const width = pageWidth;
  const height = Math.min(pageHeight, topPad + tasks.length * rowHeight + bottomPad);
  const timelineWidth = width - labelWidth - rightPad;

  const groupColor = new Map();
  tasks.forEach((task) => {
    if (!groupColor.has(task.group)) {
      groupColor.set(task.group, COLOR_POOL[groupColor.size % COLOR_POOL.length]);
    }
  });

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Generated Gantt chart");

  const defs = document.createElementNS(ns, "defs");
  const bgGrad = document.createElementNS(ns, "linearGradient");
  bgGrad.setAttribute("id", "bg");
  bgGrad.setAttribute("x1", "0%");
  bgGrad.setAttribute("x2", "100%");
  bgGrad.setAttribute("y1", "0%");
  bgGrad.setAttribute("y2", "0%");
  bgGrad.innerHTML = '<stop offset="0%" stop-color="#fffdf8" /><stop offset="100%" stop-color="#f8f5ef" />';
  defs.appendChild(bgGrad);
  svg.appendChild(defs);

  appendRect(svg, 0, 0, width, height, "url(#bg)");

  const ticks = buildMonthTicks(minDate, maxDate);
  const tickSpacing = timelineWidth / Math.max(1, ticks.length - 1);
  const compactMonthLabels = tickSpacing < 56;
  ticks.forEach((tick) => {
    const x = dateToX(tick, minDate, spanMs, labelWidth, timelineWidth);
    const isQuarter = tick.getMonth() % 3 === 0;
    appendLine(svg, x, topPad - 16, x, height - bottomPad + 6, isQuarter ? "#d0c2af" : "#ece4d8", isQuarter ? 1.5 : 1);
    appendText(svg, x + 2, 42, formatMonth(tick, compactMonthLabels), "#6f675d", 12, "start", 600);
  });

  appendRect(svg, 0, topPad - 16, width, 1, "#d7c9b7");

  tasks.forEach((task, index) => {
    const y = topPad + index * rowHeight;
    if (index % 2 === 0) {
      appendRect(svg, 0, y - 18, width, rowHeight, "rgba(245, 239, 231, 0.46)");
    }

    appendText(svg, 14, y + 1, truncateText(task.name, 52), "#2c2822", 13, "start", 600);
    appendText(svg, 14, y + 18, task.group, "#7a7268", 11, "start", 500);

    const barX = dateToX(task.start, minDate, spanMs, labelWidth, timelineWidth) + 2;
    const barEndX = dateToX(addDays(task.end, 1), minDate, spanMs, labelWidth, timelineWidth) - 2;
    const barW = Math.max(8, barEndX - barX);
    const barY = y - 11;
    const color = groupColor.get(task.group);

    appendRoundedRect(svg, barX, barY, barW, 20, 6, color, 0.92);

    if (barW > 150) {
      const dateLabel = `${formatShortDate(task.start)} - ${formatShortDate(task.end)}`;
      appendText(svg, barX + 7, barY + 14, dateLabel, "#fff", 10, "start", 600);
    }
  });

  appendText(svg, 14, 32, "Project Gantt Chart", "#1f1d1a", 20, "start", 700);

  return svg;
}

function appendRect(parent, x, y, w, h, fill) {
  const ns = "http://www.w3.org/2000/svg";
  const rect = document.createElementNS(ns, "rect");
  rect.setAttribute("x", x);
  rect.setAttribute("y", y);
  rect.setAttribute("width", w);
  rect.setAttribute("height", h);
  rect.setAttribute("fill", fill);
  parent.appendChild(rect);
  return rect;
}

function appendRoundedRect(parent, x, y, w, h, r, fill, opacity) {
  const rect = appendRect(parent, x, y, w, h, fill);
  rect.setAttribute("rx", r);
  rect.setAttribute("opacity", opacity);
  return rect;
}

function appendLine(parent, x1, y1, x2, y2, color, width) {
  const ns = "http://www.w3.org/2000/svg";
  const line = document.createElementNS(ns, "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", width);
  parent.appendChild(line);
  return line;
}

function appendText(parent, x, y, content, color, size, anchor = "start", weight = 400) {
  const ns = "http://www.w3.org/2000/svg";
  const text = document.createElementNS(ns, "text");
  text.setAttribute("x", x);
  text.setAttribute("y", y);
  text.setAttribute("fill", color);
  text.setAttribute("font-size", size);
  text.setAttribute("font-family", "Avenir Next, Segoe UI, sans-serif");
  text.setAttribute("font-weight", weight);
  text.setAttribute("text-anchor", anchor);
  text.textContent = content;
  parent.appendChild(text);
  return text;
}

function floorDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, count) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
}

function dateToX(date, minDate, spanMs, labelWidth, timelineWidth) {
  const min = minDate.getTime();
  const max = min + spanMs;
  const t = Math.min(Math.max(date.getTime(), min), max);
  return labelWidth + ((t - min) / spanMs) * timelineWidth;
}

function buildMonthTicks(minDate, maxDate) {
  const ticks = [];
  const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (cursor <= maxDate) {
    ticks.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ticks;
}

function formatMonth(date, compact = false) {
  if (compact) {
    return date.toLocaleDateString(undefined, { month: "short" });
  }
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function truncateText(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 1)}...`;
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

async function downloadPNG() {
  const svg = chartHost.querySelector("svg");
  if (!svg) {
    setStatus("Nothing to download yet.", true);
    return;
  }

  const { exportWidth, exportHeight, orientationLabel } = getPageLayout();
  const serializer = new XMLSerializer();
  const content = serializer.serializeToString(svg);
  const svgBlob = new Blob([content], { type: "image/svg+xml;charset=utf-8" });

  try {
    const pngBlob = await svgToPngBlob(svgBlob, exportWidth, exportHeight);
    const url = URL.createObjectURL(pngBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gantt-chart-a4-${orientationLabel}-300dpi.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`High-resolution PNG downloaded (A4 ${orientationLabel}, 300 DPI).`);
  } catch (error) {
    setStatus("Could not export PNG.", true);
  }
}

async function copyImageToClipboard() {
  const svg = chartHost.querySelector("svg");
  if (!svg) {
    setStatus("Render a chart before copying.", true);
    return;
  }

  if (!navigator.clipboard || !window.ClipboardItem) {
    setStatus("Clipboard image copy is not supported in this browser.", true);
    return;
  }

  const serializer = new XMLSerializer();
  const content = serializer.serializeToString(svg);
  const svgBlob = new Blob([content], { type: "image/svg+xml;charset=utf-8" });

  try {
    const { pageWidth, pageHeight } = getPageLayout();
    const pngBlob = await svgToPngBlob(svgBlob, pageWidth * 2, pageHeight * 2);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
    setStatus("Chart copied to clipboard.");
  } catch (error) {
    setStatus("Copy failed. Open via localhost (not file://) if clipboard permissions are blocked.", true);
  }
}

async function svgToPngBlob(svgBlob, width, height) {
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context unavailable.");
    }

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Could not export PNG."));
          return;
        }
        resolve(blob);
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load SVG image."));
    image.src = url;
  });
}
