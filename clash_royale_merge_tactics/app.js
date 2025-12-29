const WORKER_BASE = 'https://odd-mud-6ea5.dangercrow-cloudflare.workers.dev';

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

function normalizeTag(tag) {
  if (!tag) return '';
  const trimmed = tag.trim();
  return trimmed.startsWith('#') ? trimmed : ('#' + trimmed);
}

function buildAuthHeaders(key) {
  return key ? { Authorization: 'Bearer ' + key } : {};
}

async function fetchClanMembers({ key, clanTag }) {
  const encodedTag = encodeURIComponent(normalizeTag(clanTag));

  const res = await fetch(`${WORKER_BASE}/clans/${encodedTag}/members`, {
    headers: buildAuthHeaders(key)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
  }

  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

async function fetchPlayersBatch({ key, playerTags }) {
  const encodedTags = playerTags
    .map(tag => encodeURIComponent(normalizeTag(tag)))
    .join(',');

  const res = await fetch(`${WORKER_BASE}/players?tags=${encodedTags}`, {
    headers: buildAuthHeaders(key)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
  }

  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

function applyDefaultSortMergeTacticsDesc(gridApi) {
  if (!gridApi) return;
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
    if (isRunning) return;

    const key = apiKeyInput.value.trim();
    const clanTag = clanTagInput.value.trim();

    if (!clanTag) {
      console.error('No clan tag provided');
      return;
    }

    isRunning = true;
    goBtn.textContent = 'Loading...';
    goBtn.disabled = true;

    try {
      if (key) {
        localStorage.setItem('clashRoyaleApiKey', key);
      } else {
        localStorage.removeItem('clashRoyaleApiKey');
      }

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

      applyDefaultSortMergeTacticsDesc(gridApi);

      const tags = members.map(m => m.tag);
      const batchSize = 50;

      for (let i = 0; i < tags.length; i += batchSize) {
        try {
          if (key) {
            localStorage.setItem('clashRoyaleApiKey', key);
          }

          const batch = tags.slice(i, i + batchSize);
          const players = await fetchPlayersBatch({ key, playerTags: batch });

          for (const player of players) {
            const tag = player?.tag;
            const trophyRoad = Number.isFinite(player?.trophyRoad)
              ? player.trophyRoad
              : Number.isFinite(player?.trophies)
                ? player.trophies
                : null;
            const mergeTactics = Number.isFinite(player?.mergeTactics)
              ? player.mergeTactics
              : getMergeTactics(player);

            console.log({
              name: player?.name,
              tag,
              trophyRoad,
              mergeTactics
            });

            const node = gridApi.getRowNode(tag);
            if (node) {
              node.setData({
                ...node.data,
                trophyRoad,
                mergeTactics
              });
              reapplySortIfNeeded();
            }
          }
        } catch (e) {
          console.error('Error fetching player info batch', e);
        }

        await sleep(200);
      }
    } catch (err) {
      console.error('Error fetching clan members on Go:', err);
    } finally {
      isRunning = false;
      goBtn.textContent = 'Go';
      goBtn.disabled = false;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initClashRoyaleApp);
} else {
  initClashRoyaleApp();
}
