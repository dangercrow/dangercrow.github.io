// ===== Port of your Python snippet (pure JS) =====

// Simple in-memory cache (persists for the lifetime of the page)
const hpCache = new Map();

async function cachedGetHp(logUri) {
  if (hpCache.has(logUri)) return hpCache.get(logUri);

  const url = `https://dps.report/getJson?permalink=${encodeURIComponent(logUri)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${logUri}`);
  const json = await res.json();

  const targets = json?.targets;
  const healthPercents = targets?.[0]?.healthPercents;
  const last = Array.isArray(healthPercents) && healthPercents.length
    ? healthPercents[healthPercents.length - 1]
    : null;
  const value = Array.isArray(last) ? last[1] : null;

  if (typeof value !== "number") {
    throw new Error(`Could not find healthPercents[-1][1] for ${logUri}`);
  }

  hpCache.set(logUri, value);
  return value;
}

function localDateWithTimeToUnixSeconds(hour, minute) {
  const now = new Date();
  const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  return Math.floor(dt.getTime() / 1000);
}

function formatHp(v) {
  return Number(v).toFixed(2);
}

function extractSortKey(logUri) {
  const parts = String(logUri).split("-");
  return parts[2] ?? "";
}

function parseLines(text) {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTimeHHMM(s) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s).trim());
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

function initGw2Formatter() {
  const elTitle = document.getElementById("title");
  const elTime = document.getElementById("time");
  const elInput = document.getElementById("input");
  const elOutput = document.getElementById("output");
  const elParsed = document.getElementById("parsed");
  const elError = document.getElementById("error");

  const btnRun = document.getElementById("run");
  const btnCopy = document.getElementById("copy");
  const btnClearOut = document.getElementById("clearOut");
  const btnClearCache = document.getElementById("clearCache");

  if (!elTitle || !elTime || !elInput || !elOutput || !elParsed || !elError || !btnRun || !btnCopy || !btnClearOut || !btnClearCache) {
    return;
  }

  function setError(msg) {
    if (!msg) {
      elError.style.display = "none";
      elError.textContent = "";
      return;
    }
    elError.style.display = "block";
    elError.textContent = msg;
  }

  function setRunning(isRunning) {
    btnRun.disabled = isRunning;
    btnRun.textContent = isRunning ? "Running…" : "Run";
    elTitle.disabled = isRunning;
    elTime.disabled = isRunning;
    elInput.disabled = isRunning;
    btnClearCache.disabled = isRunning;
  }

  function updateParsedCount() {
    const count = parseLines(elInput.value).length;
    elParsed.textContent = `Parsed: ${count} line${count === 1 ? "" : "s"}`;
  }

  function setOutput(text) {
    elOutput.value = text || "";
    const has = Boolean(text);
    btnCopy.disabled = !has;
    btnClearOut.disabled = !has;
  }

  elInput.addEventListener("input", updateParsedCount);
  updateParsedCount();

  btnClearCache.addEventListener("click", () => {
    hpCache.clear();
    setError("");
  });

  btnClearOut.addEventListener("click", () => setOutput(""));

  btnCopy.addEventListener("click", async () => {
    const text = elOutput.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      elOutput.focus();
      elOutput.select();
      document.execCommand("copy");
    }
  });

  btnRun.addEventListener("click", async () => {
    setError("");
    setOutput("");

    const t = parseTimeHHMM(elTime.value);
    if (!t) {
      setError("Time must be HH:MM (24h), e.g. 19:00");
      return;
    }

    const logUris = parseLines(elInput.value);
    if (logUris.length === 0) {
      setError("Paste at least one log URI/permalink (one per line).\n");
      return;
    }

    setRunning(true);
    try {
      const entries = await Promise.all(
        logUris.map(async (uri) => {
          const hp = await cachedGetHp(uri);
          return { uri, hp, key: extractSortKey(uri) };
        })
      );

      entries.sort((a, b) => String(a.key).localeCompare(String(b.key)));

      const lines = entries.map(({ uri, hp }) => `\`${formatHp(hp)}\` ${uri}`);
      const ts = localDateWithTimeToUnixSeconds(t.hour, t.minute);
      const header = `${elTitle.value || "Temple of Febe CM"} <t:${ts}:F>`;

      setOutput([header, ...lines].join("\n"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGw2Formatter);
} else {
  initGw2Formatter();
}
