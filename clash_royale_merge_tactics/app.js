const WORKER_BASE = 'https://curly-cell-5728.dangercrow-cloudflare.workers.dev';

function getMergeTactics(player) {
  const progress = player?.progress;
  if (!progress || typeof progress !== 'object') return null;

  for (const [key, value] of Object.entries(progress)) {
    if (typeof key === 'string' && key.startsWith('AutoChess_')) {
      const trophies = value?.trophies;
      if (Number.isFinite(trophies)) return trophies;
    }
  }

  return null;
}

async function fetchClanMembers({ key, clanTag }) {
  const encodedTag = encodeURIComponent(clanTag.startsWith('#') ? clanTag : ('#' + clanTag));

  const res = await fetch(`${WORKER_BASE}/clans/${encodedTag}/members`, {
    headers: { 'Authorization': 'Bearer ' + key }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
  }

  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

async function fetchPlayer({ key, playerTag }) {
  const encodedTag = encodeURIComponent(playerTag.startsWith('#') ? playerTag : ('#' + playerTag));

  const res = await fetch(`${WORKER_BASE}/players/${encodedTag}`, {
    headers: { 'Authorization': 'Bearer ' + key }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
  }

  return await res.json();
}

function applyDefaultSortMergeTacticsDesc() {
  if (typeof gridApi.applyColumnState === 'function') {
    gridApi.applyColumnState({
      state: [{ colId: 'mergeTactics', sort: 'desc' }],
      defaultState: { sort: null }
    });
  }
}

(function runSelfTests() {
  try {
    const sample = {
      progress: {
        "AutoChess_2025_Dec": { trophies: 2036 }
      }
    };
    const got = getMergeTactics(sample);
    console.assert(got === 2036, 'getMergeTactics should return trophies from AutoChess_* key');

    const none = getMergeTactics({ progress: { "Royals_2v2_202510": { trophies: 1530 } } });
    console.assert(none === null, 'getMergeTactics should return null when no AutoChess_* key is present');
  } catch (e) {
    console.warn('Self-tests failed:', e);
  }
})();

function initClashRoyaleApp() {
  const apiKeyInput = document.getElementById('apiKey');
  const clanTagInput = document.getElementById('clanTag');
  const goBtn = document.getElementById('goBtn');
  const gridDiv = document.getElementById('grid');

  if (!apiKeyInput || !clanTagInput || !goBtn || !gridDiv) return;

  let isRunning = false;
  let stopRequested = false;

  const savedKey = localStorage.getItem('clashRoyaleApiKey');
  if (savedKey) apiKeyInput.value = savedKey;

  const gridOptions = {
    columnDefs: [
      { headerName: 'Player', field: 'name', flex: 2 },
      { headerName: 'Tag', field: 'tag', flex: 1 },
      { headerName: 'Trophy Road', field: 'trophyRoad', flex: 1, valueFormatter: p => p.value ?? '—' },
      { headerName: 'Merge Tactics', field: 'mergeTactics', flex: 1, valueFormatter: p => p.value ?? '—' }
    ],
    rowData: [],
    defaultColDef: { sortable: true, filter: true, resizable: true },
    getRowId: p => p.data.tag
  };

  const gridApi = agGrid?.createGrid
    ? agGrid.createGrid(gridDiv, gridOptions)
    : (new agGrid.Grid(gridDiv, gridOptions), gridOptions.api);

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function hasActiveSort() {
    const state = (typeof gridApi.getColumnState === 'function')
      ? gridApi.getColumnState()
      : (gridApi.getColumnApi && typeof gridApi.getColumnApi().getColumnState === 'function')
        ? gridApi.getColumnApi().getColumnState()
        : null;

    return Array.isArray(state) && state.some(s => s && s.sort);
  }

  function reapplySortIfNeeded() {
    if (!hasActiveSort()) return;
    if (typeof gridApi.refreshClientSideRowModel === 'function') {
      gridApi.refreshClientSideRowModel('sort');
    } else if (typeof gridApi.onSortChanged === 'function') {
      gridApi.onSortChanged();
    }
  }

  goBtn.addEventListener('click', async () => {
    if (isRunning) {
      stopRequested = true;
      return;
    }

    const key = apiKeyInput.value.trim();
    const clanTag = clanTagInput.value.trim();

    if (!key) {
      console.error('No API key provided');
      return;
    }
    if (!clanTag) {
      console.error('No clan tag provided');
      return;
    }

    stopRequested = false;
    isRunning = true;
    goBtn.textContent = 'Stop';

    try {
      localStorage.setItem('clashRoyaleApiKey', key);

      const members = await fetchClanMembers({ key, clanTag });

      const rows = members.map(m => ({
        ...m,
        trophyRoad: null,
        mergeTactics: null
      }));

      if (gridApi.setGridOption) {
        gridApi.setGridOption('rowData', rows);
      } else {
        gridApi.setRowData(rows);
      }

      applyDefaultSortMergeTacticsDesc();

      for (const m of members) {
        if (stopRequested) break;

        try {
          localStorage.setItem('clashRoyaleApiKey', key);

          const player = await fetchPlayer({ key, playerTag: m.tag });
          const trophyRoad = Number.isFinite(player?.trophies) ? player.trophies : null;
          const mergeTactics = getMergeTactics(player);

          console.log({
            name: m.name,
            tag: m.tag,
            trophyRoad,
            mergeTactics
          });

          const node = gridApi.getRowNode(m.tag);
          if (node) {
            node.setData({
              ...node.data,
              trophyRoad,
              mergeTactics
            });
            reapplySortIfNeeded();
          }
        } catch (e) {
          console.error('Error fetching player info for', m.tag, e);
        }

        await sleep(200);
      }
    } catch (err) {
      console.error('Error fetching clan members on Go:', err);
    } finally {
      isRunning = false;
      stopRequested = false;
      goBtn.textContent = 'Go';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initClashRoyaleApp);
} else {
  initClashRoyaleApp();
}
