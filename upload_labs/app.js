function F(x, N) {
  const y = N - x;
  return (1 + 0.1 * y) * (1 + 0.04 * x) ** 2;
}

function derivativeRootsInRange(N) {
  const a = 0.00048;
  const b = 0.0128 - 0.00032 * N;
  const c = 0.02 - 0.008 * N;

  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];

  const s = Math.sqrt(disc);
  const r1 = (-b + s) / (2 * a);
  const r2 = (-b - s) / (2 * a);

  const roots = [];
  if (0 <= r1 && r1 <= N) roots.push(r1);
  if (0 <= r2 && r2 <= N) roots.push(r2);
  return roots;
}

function optimalAllocation(N) {
  const roots = derivativeRootsInRange(N);

  const candidates = new Set([0, N]);
  for (const r of roots) {
    candidates.add(Math.floor(r));
    candidates.add(Math.ceil(r));
  }

  let bestX = 0;
  let bestV = -Infinity;

  for (const x of candidates) {
    if (x < 0 || x > N) continue;
    const v = F(x, N);
    if (v > bestV) {
      bestV = v;
      bestX = x;
    }
  }

  return { x: bestX, y: N - bestX, value: bestV, roots };
}

function initUploadLabs() {
  const out = document.getElementById('out');
  const tblBody = document.querySelector('#tbl tbody');
  const input = document.getElementById('N');

  if (!out || !tblBody || !input) return;

  function run() {
    const N0 = Number.parseInt(input.value, 10);

    if (!Number.isFinite(N0) || N0 <= 0) {
      out.textContent = "Please enter an integer N > 0.";
      tblBody.innerHTML = "";
      return;
    }

    const cur = optimalAllocation(N0);
    out.innerHTML =
      `<div class="mono">` +
      `N = ${N0}<br>` +
      `Critical point roots in [0,N] (real): ${cur.roots.length ? cur.roots.map(r => r.toFixed(6)).join(", ") : "(none)"}<br><br>` +
      `Optimal integer allocation:<br>` +
      ` - Speed (x):  ${cur.x}<br>` +
      ` - Damage (y): ${cur.y}<br><br>` +
      `F(x,N) = ${cur.value.toFixed(6)}` +
      `</div>`;

    const K = 10;

    let prev = optimalAllocation(Math.max(1, N0 - 1));

    const rows = [];
    for (let i = 0; i < K; i++) {
      const N = N0 + i;
      const r = optimalAllocation(N);

      const xChanged = r.x !== prev.x;
      const yChanged = r.y !== prev.y;
      const vChanged = Math.abs(r.value - prev.value) > 1e-12;

      const xCell = `<td class="mono cell${xChanged ? ' chg' : ''}">${r.x}</td>`;
      const yCell = `<td class="mono cell${yChanged ? ' chg' : ''}">${r.y}</td>`;
      const vText = r.value.toFixed(6);
      const vCell = `<td class="mono">${vText}</td>`;

      rows.push(
        `<tr>` +
        `<td class="mono">${N}</td>` +
        xCell +
        yCell +
        vCell +
        `</tr>`
      );

      prev = r;
    }
    tblBody.innerHTML = rows.join('');
  }

  input.addEventListener('input', run);
  input.addEventListener('change', run);

  run();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUploadLabs);
} else {
  initUploadLabs();
}
