// Token Radar's page. It reads window.RADAR (written beside dashboard/ by main.ts) and renders the
// ranked board, filters, a per-protocol detail view and the live-token set. No network: every byte it
// shows is in data.js. The arithmetic on the page is recomputed from the snapshot figures and checked
// against the number board.json carries.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('main');
  var rows = DATA.rows || [];
  var state = { q: '', category: 'all', chain: 'all', minTvl: 0, watchOnly: false, sort: 'implied', dir: -1, tab: 'board', selected: null };
  var refs = {};

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  var fullUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtFullUsd(n) { return n === null || n === undefined || !isFinite(n) ? 'n/a' : fullUsd.format(n); }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined || !isFinite(days)) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return (n === null || n === undefined || !isFinite(n) ? 'n/a' : n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') + '×'); }
  function fmtRatio(n) { return (n === null || n === undefined || !isFinite(n) ? 'n/a' : n.toFixed(3) + '×'); }
  function catOf(r) { return r.category || 'Other'; }
  function chainText(r) {
    if (!r.chains || r.chains.length === 0) return '—';
    return r.chains.length > 2 ? r.chains.slice(0, 2).join(', ') + ' +' + (r.chains.length - 2) : r.chains.join(', ');
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, String(v));
      });
    }
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }
  function append(node, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    if (typeof child === 'string' || typeof child === 'number') node.appendChild(document.createTextNode(String(child)));
    else node.appendChild(child);
  }

  var chainValues = [];
  var categoryValues = [];
  rows.forEach(function (r) {
    if (categoryValues.indexOf(catOf(r)) < 0) categoryValues.push(catOf(r));
    (r.chains || []).forEach(function (c) { if (chainValues.indexOf(c) < 0) chainValues.push(c); });
  });
  categoryValues.sort();
  chainValues.sort();

  function readHash() {
    var params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category') && (params.get('category') === 'all' || categoryValues.indexOf(params.get('category')) >= 0)) state.category = params.get('category');
    if (params.get('chain') && (params.get('chain') === 'all' || chainValues.indexOf(params.get('chain')) >= 0)) state.chain = params.get('chain');
    var min = Number(params.get('min'));
    if (isFinite(min) && min > 0) state.minTvl = min;
    state.watchOnly = params.get('watch') === '1';
    if (params.get('tab') === 'live') state.tab = 'live';
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.minTvl > 0) params.set('min', String(state.minTvl));
    if (state.watchOnly) params.set('watch', '1');
    if (state.tab === 'live') params.set('tab', 'live');
    if (state.selected) params.set('p', state.selected);
    var hash = params.toString();
    window.history.replaceState(null, '', window.location.pathname + window.location.search + (hash ? '#' + hash : ''));
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return rows.filter(function (r) {
      if (state.tab === 'board' && state.watchOnly && !r.watchlist) return false;
      if (state.category !== 'all' && catOf(r) !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.minTvl > 0 && r.tvl_usd < state.minTvl) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, r.category_family, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortValue(r, key) {
    if (key === 'rank') return r.rank;
    if (key === 'name') return r.name.toLowerCase();
    if (key === 'category') return catOf(r).toLowerCase();
    if (key === 'chains') return (r.chains && r.chains[0] ? r.chains[0] : '').toLowerCase();
    if (key === 'tvl') return r.tvl_usd;
    if (key === 'growth') return r.change_7d === null || r.change_7d === undefined ? -Infinity : r.change_7d;
    if (key === 'age') return r.age_days === null || r.age_days === undefined ? -Infinity : r.age_days;
    if (key === 'pertvl') return r.value_per_tvl;
    return r.implied_value_usd;
  }
  function sorted(list) {
    return list.slice().sort(function (a, b) {
      var av = sortValue(a, state.sort), bv = sortValue(b, state.sort);
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.rank - b.rank;
    });
  }

  function metaItem(label, value) {
    return el('div', { class: 'meta-item' }, el('dt', { text: label }), el('dd', { text: value }));
  }
  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' },
        el('span', { class: 'mark', 'aria-hidden': 'true' }),
        el('div', null,
          el('span', { class: 'eyebrow', text: 'make.fun bounty · token-radar-01' }),
          el('h1', { text: 'Token Radar' })
        )
      ),
      el('dl', { class: 'meta' },
        metaItem('Snapshot', DATA.as_of),
        metaItem('Source', DATA.source),
        metaItem('Watchlist floor', fmtUsd(DATA.floor_usd)),
        metaItem('Model', DATA.model_version)
      )
    );
  }

  function kpi(label, value, note) {
    return el('div', { class: 'kpi' },
      el('span', { class: 'kpi-label', text: label }),
      el('strong', { class: 'kpi-value num', text: value }),
      el('span', { class: 'kpi-note', text: note })
    );
  }
  function kpis() {
    return el('section', { class: 'kpis', 'aria-label': 'Snapshot figures' },
      kpi('Protocols in snapshot', String(DATA.snapshot_size), 'at or above $5M TVL'),
      kpi('Watchlist', String(DATA.watchlist_size), 'all covered by the board'),
      kpi('Rows on the board', String(DATA.board_size), DATA.early_size + ' early rows below the floor'),
      kpi('Total implied value', fmtUsd(DATA.total_implied_value_usd), 'sum of every ranked row'),
      kpi('Median age, no token', fmtAge(DATA.median_age_days), 'rows with a known listing date')
    );
  }

  function intro() {
    return el('section', { class: 'intro' },
      el('h2', { text: 'The pre-token protocols worth watching, ranked by a stated implied value.' }),
      el('p', { text: 'Every watchlist protocol is here, plus the largest pre-token protocols below the floor. A protocol records no token when its snapshot entry carries no market cap, no CoinGecko id and no symbol; the live-token set is kept apart on its own tab. Implied value is this radar\'s model, not a price and not a promise.' })
    );
  }

  function field(label, forId, control) {
    return el('div', { class: 'field' }, el('label', { for: forId, text: label }), control);
  }
  function controls() {
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); refresh(); });
    refs.search = search;

    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categoryValues.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category }); })
    );
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); refresh(); });
    refs.category = cat;

    var chain = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chainValues.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain }); })
    );
    chain.addEventListener('change', function () { state.chain = chain.value; writeHash(); refresh(); });
    refs.chain = chain;

    var min = el('input', { type: 'number', id: 'min', min: '0', step: '5', value: state.minTvl ? String(state.minTvl / 1e6) : '', placeholder: '0', 'aria-label': 'Minimum TVL in millions of dollars' });
    min.addEventListener('input', function () {
      var m = Number(min.value);
      state.minTvl = isFinite(m) && m > 0 ? Math.round(m * 1e6) : 0;
      writeHash(); refresh();
    });
    refs.min = min;

    var watch = el('input', { type: 'checkbox', id: 'watch', checked: state.watchOnly });
    watch.addEventListener('change', function () { state.watchOnly = watch.checked; writeHash(); refresh(); });
    refs.watch = watch;

    var boardTab = el('button', { type: 'button', 'aria-pressed': state.tab === 'board' ? 'true' : 'false', text: 'Pre-token board' });
    var liveTab = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token · not ranked' });
    boardTab.addEventListener('click', function () { state.tab = 'board'; writeHash(); refresh(); });
    liveTab.addEventListener('click', function () { state.tab = 'live'; writeHash(); refresh(); });
    refs.boardTab = boardTab;
    refs.liveTab = liveTab;

    refs.count = el('span', { class: 'count', 'aria-live': 'polite' });
    return el('section', { class: 'controls', 'aria-label': 'Board filters' },
      field('Search', 'q', search),
      field('Category', 'category', cat),
      field('Chain', 'chain', chain),
      field('Min TVL ($M)', 'min', min),
      el('label', { class: 'toggle', for: 'watch' }, watch, el('span', { text: 'Watchlist only' })),
      el('div', { class: 'field tabs' }, el('span', { class: 'tabs-label', text: 'View' }), el('div', { class: 'tabs-row' }, boardTab, liveTab)),
      refs.count
    );
  }

  function sortHeader(key, label) {
    var dir = el('span', { class: 'sort', 'aria-hidden': 'true' });
    var th = el('th', { scope: 'col', 'aria-sort': 'none' },
      el('button', { type: 'button', onclick: function () {
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = key === 'rank' || key === 'name' || key === 'category' || key === 'chains' ? 1 : -1; }
        refresh();
      } }, label, dir)
    );
    refs.headers = refs.headers || {};
    refs.headers[key] = { th: th, dir: dir };
    return th;
  }

  function boardTable() {
    refs.boardBody = el('tbody');
    refs.boardPanel = el('section', { class: 'panel', id: 'board-panel' },
      el('div', { class: 'panel-head' },
        el('div', null, el('h2', { text: 'Pre-token board' }), el('p', { class: 'sub', text: 'Select a row for its model arithmetic, farm plan and airdrop view.' })),
        el('span', { class: 'badge', text: 'rank 1 · strongest implied value' })
      ),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'board-table' },
          el('caption', { class: 'sr-only', text: 'Pre-token protocols ranked by implied value' }),
          el('colgroup', null,
            el('col', { class: 'w-rank' }), el('col', { class: 'w-protocol' }), el('col', { class: 'w-category' }),
            el('col', { class: 'w-chains' }), el('col', { class: 'w-tvl' }), el('col', { class: 'w-growth' }),
            el('col', { class: 'w-age' }), el('col', { class: 'w-implied' }), el('col', { class: 'w-pertvl' })
          ),
          el('thead', null, el('tr', null,
            sortHeader('rank', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('category', 'Category'),
            sortHeader('chains', 'Chains'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            sortHeader('pertvl', '$ / TVL')
          )),
          refs.boardBody
        )
      )
    );
    return refs.boardPanel;
  }

  function liveTable() {
    var body = el('tbody');
    (DATA.live || []).forEach(function (r) {
      body.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'status', text: 'trades' })),
        el('td', null, el('div', { class: 'pname' }, el('b', { text: r.name }), el('span', { class: 'sub', text: r.symbol || 'token' }))),
        el('td', { text: r.category || 'Other' }),
        el('td', { text: chainText(r) }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d !== undefined && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num sub', text: r.symbol || '—' })
      ));
    });
    refs.livePanel = el('section', { class: 'panel', id: 'live-panel', hidden: true },
      el('div', { class: 'panel-head' },
        el('div', null, el('h2', { text: 'Live token protocols' }), el('p', { class: 'sub', text: 'These protocols already trade, so their market cap is the market\'s figure, not a model. They are explicitly not ranked on the board.' })),
        el('span', { class: 'badge muted', text: 'not ranked' })
      ),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'live-table' },
          el('caption', { class: 'sr-only', text: 'Live-token protocols by market cap; not ranked' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Chains' }),
            el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }),
            el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Symbol' })
          )),
          body
        )
      )
    );
    return refs.livePanel;
  }

  function barRow(r, max) {
    var width = Math.max(2, Math.round((r.implied_value_usd / max) * 100));
    return el('div', { class: 'implied' },
      el('span', { class: 'num money', text: fmtUsd(r.implied_value_usd) }),
      el('span', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + width + '%' }))
    );
  }
  function boardRow(r, max) {
    var growthClass = r.change_7d === null || r.change_7d === undefined ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
    var raw = catOf(r);
    return el('tr', {
      'data-slug': r.slug,
      'data-selected': state.selected === r.slug ? 'true' : 'false',
      tabindex: '0',
      'aria-label': 'Open ' + r.name + ' detail, rank ' + r.rank,
      onclick: function () { openDetail(r.slug, false); },
      onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug, false); } }
    },
      el('td', { class: 'num rank', text: String(r.rank) }),
      el('td', null, el('div', { class: 'pname' }, el('b', { text: r.name }), r.watchlist ? el('span', { class: 'tag', text: 'watchlist' }) : null)),
      el('td', null, el('div', { class: 'cat-cell' }, el('b', { text: r.category_family }), raw !== r.category_family ? el('span', { class: 'sub', text: raw }) : null)),
      el('td', { text: chainText(r) }),
      el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
      el('td', { class: 'num ' + growthClass, text: fmtPct(r.change_7d) }),
      el('td', { class: 'num', text: fmtAge(r.age_days) }),
      el('td', null, barRow(r, max)),
      el('td', { class: 'num', text: fmtRatio(r.value_per_tvl) })
    );
  }

  function resetFilters() {
    state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0; state.watchOnly = false;
    if (refs.search) refs.search.value = '';
    if (refs.category) refs.category.value = 'all';
    if (refs.chain) refs.chain.value = 'all';
    if (refs.min) refs.min.value = '';
    if (refs.watch) refs.watch.checked = false;
    writeHash(); refresh();
  }

  function emptyRow() {
    return el('tr', null, el('td', { colspan: '9' },
      el('div', { class: 'empty' },
        el('h3', { text: 'No protocol matches those filters' }),
        el('p', { class: 'sub', text: 'Try a shorter search, another category or chain, or a lower TVL floor.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Reset filters', onclick: resetFilters })
      )
    ));
  }

  function updateHeaders() {
    Object.keys(refs.headers || {}).forEach(function (key) {
      var h = refs.headers[key];
      var active = state.sort === key;
      h.th.setAttribute('aria-sort', active ? (state.dir > 0 ? 'ascending' : 'descending') : 'none');
      h.dir.textContent = active ? (state.dir > 0 ? '▲' : '▼') : '';
    });
  }

  function refresh() {
    if (refs.boardTab) refs.boardTab.setAttribute('aria-pressed', state.tab === 'board' ? 'true' : 'false');
    if (refs.liveTab) refs.liveTab.setAttribute('aria-pressed', state.tab === 'live' ? 'true' : 'false');
    if (refs.boardPanel) refs.boardPanel.hidden = state.tab !== 'board';
    if (refs.livePanel) refs.livePanel.hidden = state.tab !== 'live';
    if (state.tab === 'live') {
      if (refs.count) refs.count.textContent = (DATA.live || []).length + ' live protocols, not ranked';
      return;
    }
    var list = sorted(filtered());
    var visibleMax = Math.max.apply(null, list.map(function (r) { return r.implied_value_usd; }).concat([1]));
    if (refs.count) refs.count.textContent = list.length + ' of ' + DATA.board_size + ' rows';
    if (refs.boardBody) {
      refs.boardBody.textContent = '';
      if (list.length === 0) refs.boardBody.appendChild(emptyRow());
      else list.forEach(function (r) { refs.boardBody.appendChild(boardRow(r, visibleMax)); });
    }
    updateHeaders();
  }

  function stat(label, value) {
    return el('div', { class: 'stat' }, el('span', { text: label }), el('b', { class: 'num', text: value }));
  }
  function detailRow(label, value) {
    return el('div', { class: 'math-row' }, el('span', { text: label }), el('b', { class: 'num', text: value }));
  }

  function openDetail(slug, initial) {
    var row = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].slug === slug) { row = rows[i]; break; }
    if (!row) { state.selected = null; writeHash(); return; }
    state.selected = slug;
    if (!initial) writeHash();
    var m = DATA.model;
    var growth = row.change_7d === null || row.change_7d === undefined ? 0 : Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? null : row.age_days;
    var maturity = age === null ? m.unknown_age_maturity : m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var base = Math.round(row.tvl_usd * row.category_multiple);
    var implied = Math.max(1, Math.min(m.max_value_usd, Math.round(base * growthMult * maturity)));
    var matches = implied === row.implied_value_usd;

    refs.dialog.textContent = '';
    refs.dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'eyebrow', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + ' · ' + (row.watchlist ? 'watchlist' : 'early radar') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' · ' + row.category_family + ' · ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'unnamed chain') })
      ),
      el('button', { class: 'button close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { closeDetail(); } })
    ));

    refs.dialog.appendChild(el('section', { class: 'detail-section' },
      el('div', { class: 'fig-grid' },
        stat('TVL', fmtUsd(row.tvl_usd)),
        stat('7d change', fmtPct(row.change_7d)),
        stat('Age with no token', fmtAge(row.age_days)),
        stat('Value per $1 TVL', fmtRatio(row.value_per_tvl)),
        stat('Implied value', fmtUsd(row.implied_value_usd)),
        stat('Modeled airdrop · ' + Math.round(row.airdrop.share * 100) + '%', fmtUsd(row.airdrop.value_usd)),
        stat('Value per $1 gas/fees', row.airdrop.value_per_cost.toFixed(2) + '×')
      )
    ));

    refs.dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Model arithmetic' }),
      el('p', { class: 'sub', text: 'Every figure below is computed from this row\'s snapshot record and the category table.' }),
      el('div', { class: 'math' },
        detailRow('TVL', fmtFullUsd(row.tvl_usd)),
        detailRow('× category multiple (' + row.category_family + ')', fmtMult(row.category_multiple)),
        detailRow('= base value', fmtFullUsd(base)),
        detailRow('× growth multiplier (' + fmtPct(growth) + ' clamped)', fmtMult(growthMult)),
        detailRow('× maturity multiplier (' + (age === null ? 'unknown age' : age + ' days') + ')', fmtMult(maturity)),
        detailRow('= implied value', fmtFullUsd(implied))
      ),
      el('p', { class: 'note', text: 'Page recomputes ' + fmtFullUsd(implied) + '. ' + (matches ? 'Matches the number board.json carries.' : 'Does not match board.json; the data is stale.') })
    ));

    refs.dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('p', { class: 'sub', text: 'Capital: ' + fmtFullUsd(row.airdrop.capital_usd) + ' · hold: ' + row.airdrop.hold_days + ' days · estimated gas and fees: ' + fmtFullUsd(row.airdrop.cost_usd) + '.' }),
      el('ol', { class: 'steps' }, (row.farm_plan || []).map(function (s) {
        return el('li', null,
          el('b', { text: s.text }),
          el('span', { class: 'step-meta' }, el('span', { text: 'Cost: ' + s.cost }), el('span', { text: 'Time: ' + s.time }))
        );
      }))
    ));

    refs.dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Airdrop plan view' }),
      el('div', { class: 'air-grid' },
        stat('Implied value', fmtUsd(row.implied_value_usd)),
        stat('Stated airdrop share', Math.round(row.airdrop.share * 100) + '%'),
        stat('Modeled airdrop value', fmtUsd(row.airdrop.value_usd)),
        stat('Farm cost, gas and fees', fmtFullUsd(row.airdrop.cost_usd)),
        stat('Capital at work', fmtFullUsd(row.airdrop.capital_usd)),
        stat('Value per $1 of gas/fees', row.airdrop.value_per_cost.toFixed(2) + '×')
      ),
      el('p', { class: 'note', text: 'The airdrop value is the implied value times the stated ' + Math.round(row.airdrop.share * 100) + '% early-user share, a model assumption rather than a promise or a per-wallet allocation. Cost is the plan\'s own gas and fee estimate; value per cost divides the modeled value by that cost.' })
    ));

    if (!refs.dialog.open) {
      if (typeof refs.dialog.showModal === 'function') refs.dialog.showModal();
      else refs.dialog.setAttribute('open', '');
    }
    refresh();
  }

  function closeDetail() {
    if (typeof refs.dialog.close === 'function') refs.dialog.close();
    else refs.dialog.removeAttribute('open');
    state.selected = null;
    writeHash();
    refresh();
  }

  function modelPanel() {
    var m = DATA.model;
    var catRows = (DATA.category_table || []).map(function (r) {
      return el('tr', null,
        el('td', null, el('b', { text: r.family })),
        el('td', { class: 'num', text: fmtMult(r.multiple) }),
        el('td', { class: 'sub', text: r.categories.join(', ') })
      );
    });
    catRows.push(el('tr', null, el('td', null, el('b', { text: 'Other / unknown' })), el('td', { class: 'num', text: fmtMult(m.category_default) }), el('td', { class: 'sub', text: 'null, or a category outside the table' })));
    return el('section', { class: 'panel model', 'aria-labelledby': 'model-title' },
      el('div', { class: 'panel-head' },
        el('div', null, el('h2', { id: 'model-title', text: 'The value model' }), el('p', { class: 'sub', text: 'One mechanical function scores every row; no protocol name is special-cased.' })),
        el('span', { class: 'badge', text: DATA.model_version })
      ),
      el('div', { class: 'formula' },
        el('div', null, 'implied = clamp( round( round(tvl_usd × category) × growth × maturity ), 1, ' + fmtUsd(m.max_value_usd) + ' )'),
        el('div', null, 'growth = 1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 × ' + m.growth_weight.toFixed(2)),
        el('div', null, 'maturity = ' + m.maturity_floor.toFixed(2) + ' + min(max(age_days, 0), ' + m.maturity_days + ') / ' + m.maturity_days + ' × ' + m.maturity_range.toFixed(2) + '   (unknown age = ' + m.unknown_age_maturity.toFixed(2) + ')')
      ),
      el('div', { class: 'const-grid' },
        el('div', { class: 'const' }, el('span', { text: 'Growth band' }), el('b', { class: 'num', text: m.growth_floor + '% .. ' + m.growth_cap + '%' })),
        el('div', { class: 'const' }, el('span', { text: 'Growth weight' }), el('b', { class: 'num', text: (m.growth_weight * 100).toFixed(0) + '%' })),
        el('div', { class: 'const' }, el('span', { text: 'Maturity band' }), el('b', { class: 'num', text: m.maturity_floor.toFixed(2) + ' .. ' + (m.maturity_floor + m.maturity_range).toFixed(2) })),
        el('div', { class: 'const' }, el('span', { text: 'Maturity horizon' }), el('b', { class: 'num', text: m.maturity_days + ' days' })),
        el('div', { class: 'const' }, el('span', { text: 'Unknown age' }), el('b', { class: 'num', text: m.unknown_age_maturity.toFixed(2) })),
        el('div', { class: 'const' }, el('span', { text: 'Airdrop share' }), el('b', { class: 'num', text: Math.round(m.airdrop_share * 100) + '%' })),
        el('div', { class: 'const' }, el('span', { text: 'Value ceiling' }), el('b', { class: 'num', text: fmtUsd(m.max_value_usd) }))
      ),
      el('div', { class: 'table-wrap cat-wrap' },
        el('table', { class: 'cat-table' },
          el('caption', { class: 'sub', text: 'Category multiples: the DefiLlama category decides the starting value; absent or unknown categories use the fallback.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Family' }), el('th', { scope: 'col', text: 'Multiple' }), el('th', { scope: 'col', text: 'Snapshot categories' }))),
          el('tbody', null, catRows)
        )
      ),
      el('p', { class: 'note', text: 'The board covers all ' + DATA.watchlist_size + ' watchlist slugs and adds the ' + DATA.early_size + ' largest pre-token protocols below the ' + fmtUsd(DATA.floor_usd) + ' floor. TVL, seven-day growth and the listing date come only from the sealed snapshot; the live-token tab is separated because those market caps are facts, not model output.' })
    );
  }

  refs.dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  refs.dialog.addEventListener('close', function () { state.selected = null; writeHash(); refresh(); });

  function render() {
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(intro());
    shell.appendChild(kpis());
    shell.appendChild(controls());
    shell.appendChild(boardTable());
    shell.appendChild(liveTable());
    shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.appendChild(refs.dialog);
    app.setAttribute('aria-busy', 'false');
    refresh();
    if (state.selected) openDetail(state.selected, true);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && refs.dialog && refs.dialog.open) closeDetail();
  });
})();
