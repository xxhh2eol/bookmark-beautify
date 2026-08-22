// ===== 状态 =====
const state = {
  filterType: 'all',
  filterKey: 'all',
  search: '',
  sort: 'default'
};

let allBookmarks = [];
let folderTree = [];
let domains = [];
const settings = { hideDomainIcons: false, hideContentIcons: false };
let hiddenFolderIds = new Set();
let rootFolderIds = new Set();
let barFolderId = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const DEFAULT_FOLDER_NAMES = new Set(['收藏夹栏', '书签栏', 'Bookmarks bar', '其他书签', 'Other bookmarks', '移动设备书签', 'Mobile bookmarks', '零散']);
let draggedBookmarkId = null;
let draggedFolderId = null;

// ===== 简单 eTLD+1 聚合 =====
const suffixSet = new Set([
  'com.cn','net.cn','org.cn','gov.cn','com.hk','co.uk','com.tw','co.jp',
  'com.au','co.kr','com.br','com.mx','co.in','org.uk','net.uk','ac.cn'
]);

function aggregateDomain(host) {
  let h = host.replace(/^www\./i, '');
  const parts = h.split('.');
  if (parts.length <= 2) return h;
  const last3 = parts.slice(-3).join('.');
  if (suffixSet.has(last3)) return last3;
  return parts.slice(-2).join('.');
}

function colorFor(text) {
  let hash = 0;
  const s = text.toLowerCase();
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash) + s.charCodeAt(i);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 54%)`;
}

function folderColor(name) {
  let hash = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash) + s.charCodeAt(i);
  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsl(${hue}, 45%, 96%)`,
    border: `hsl(${hue}, 40%, 80%)`,
    text: `hsl(${hue}, 40%, 45%)`
  };
}

function faviconUrl(url) {
  try {
    const u = new URL(url);
    return `${chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL('/_favicon/?pageUrl=' + encodeURIComponent(url) + '&size=32') : 'https://www.google.com/s2/favicons?domain=' + u.hostname + '&sz=32'}`;
  } catch {
    return '';
  }
}

function bindFaviconFallback(container) {
  container.querySelectorAll('img.favicon-img').forEach(img => {
    img.addEventListener('error', () => {
      const letter = img.dataset.letter || '?';
      const color = img.dataset.color || '#64748b';
      const span = document.createElement('span');
      span.className = 'domain-icon';
      span.style.background = color;
      span.textContent = letter;
      img.replaceWith(span);
    });
  });
}

// ===== 从 chrome.bookmarks 构建数据 =====
function collectBookmarks(nodes, parentPath) {
  const items = [];
  const folders = [];

  function walk(list, path) {
    for (const node of list) {
      if (node.url) {
        let host = '';
        try {
          host = new URL(node.url).hostname || '';
        } catch {
          host = '';
        }
        if (!host) continue;
        items.push({
          id: node.id,
          title: node.title || host,
          url: node.url,
          host,
          domain: aggregateDomain(host),
          folderId: node.parentId || '',
          folderPath: path,
          dateAdded: node.dateAdded || 0
        });
      } else if (node.children && node.children.length) {
        folders.push({
          id: node.id,
          title: node.title || '未命名',
          parentId: node.parentId || '',
          children: node.children
        });
        walk(node.children, path ? `${path} / ${node.title}` : (node.title || ''));
      }
    }
  }

  walk(nodes, parentPath);
  return { items, folders };
}

function computeDomainGroups(bookmarks) {
  const map = new Map();
  for (const b of bookmarks) {
    if (!map.has(b.domain)) {
      map.set(b.domain, { domain: b.domain, count: 0, color: colorFor(b.domain) });
    }
    const g = map.get(b.domain);
    g.count++;
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
}

function buildFolderTree(nodes) {
  return nodes
    .filter(n => !n.url)
    .map(n => {
      const children = buildFolderTree(n.children || []);
      return {
        id: n.id,
        title: n.title || '未命名',
        children
      };
    });
}

function buildDisplayFolderTree(roots) {
  const bar = roots.find(n => n.title === '收藏夹栏' || n.title === '书签栏' || n.title === 'Bookmarks bar');
  const others = roots.filter(n => !n.url && n !== bar);
  const loose = { id: '__loose__', title: '零散', emoji: '📄', children: [] };
  const barChildren = bar ? buildFolderTree(bar.children || []) : [];
  const otherNodes = others.map(n => ({
    id: n.id,
    title: n.title || '未命名',
    children: buildFolderTree(n.children || [])
  }));
  return [loose, ...barChildren, ...otherNodes];
}

async function loadChromeBookmarks() {
  await loadSettings();
  if (!window.chrome || !chrome.bookmarks || typeof chrome.bookmarks.getTree !== 'function') {
    document.body.innerHTML = '<div class="empty-state"><span class="domain-name" style="font-size:14px">请作为 Chrome 扩展加载本页</span></div>';
    return;
  }

  const tree = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
  const roots = tree && tree[0] && tree[0].children ? tree[0].children : [];
  const { items, folders } = collectBookmarks(roots, '');
  allBookmarks = items;
  rootFolderIds = new Set(roots.filter(n => !n.url).map(n => n.id));
    barFolderId = roots.find(n => n.title === '收藏夹栏' || n.title === '书签栏' || n.title === 'Bookmarks bar')?.id || null;
    folderTree = buildDisplayFolderTree(roots);
  domains = computeDomainGroups(allBookmarks);
  renderDomains();
  renderFolders();
  renderContent();
}

async function loadSettings() {
  if (!chrome.storage || !chrome.storage.local) return;
  const data = await new Promise(resolve => chrome.storage.local.get(['hideDomainIcons', 'hideContentIcons', 'hiddenFolders'], resolve));
  settings.hideDomainIcons = !!data.hideDomainIcons;
  settings.hideContentIcons = !!data.hideContentIcons;
  $('#hideDomainIcons').checked = settings.hideDomainIcons;
  $('#hideContentIcons').checked = settings.hideContentIcons;
  document.documentElement.classList.toggle('hide-domain-icons', settings.hideDomainIcons);
  document.documentElement.classList.toggle('hide-content-icons', settings.hideContentIcons);
  hiddenFolderIds = new Set(data.hiddenFolders || []);
}


function hideContextMenu() {
  const menu = $('#contextMenu');
  if (menu) menu.hidden = true;
}

function openContextMenu(x, y, items) {
  const menu = $('#contextMenu');
  menu.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'context-item' + (item.danger ? ' danger' : '');
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      menu.hidden = true;
      item.run();
    });
    menu.appendChild(btn);
  });
  menu.hidden = false;
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - 190)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - items.length * 32 - 12)) + 'px';
}

document.addEventListener('click', hideContextMenu);
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('#contextMenu')) hideContextMenu();
});

let modalOnOk = null;
let undoStack = [];
let undoToastTimer = null;

function showInputModal(title, value, onOk) {
  modalOnOk = onOk;
  $('#appModalTitle').textContent = title;
  const input = $('#appModalInput');
  input.hidden = false;
  input.value = value || '';
  $('#appModal').hidden = false;
  input.focus();
  input.select();
}

function showConfirmModal(title, message, onOk) {
  modalOnOk = onOk;
  $('#appModalTitle').textContent = title + '\n' + message;
  const input = $('#appModalInput');
  input.hidden = true;
  input.value = '';
  $('#appModal').hidden = false;
}

function hideModal() {
  $('#appModal').hidden = true;
  modalOnOk = null;
}

function showUndoToast(text) {
  clearTimeout(undoToastTimer);
  $('#undoText').textContent = text;
  $('#undoToast').hidden = false;
  undoToastTimer = setTimeout(() => { $('#undoToast').hidden = true; }, 6000);
}

function pushUndo(item) {
  undoStack.push(item);
  showUndoToast('已删除，可撤销');
}

async function createTreeFromSnapshot(snapshot, parentId, index) {
  if (!snapshot) return;
  if (snapshot.url) {
    await new Promise(resolve => chrome.bookmarks.create({
      parentId, index, title: snapshot.title || '', url: snapshot.url
    }, resolve));
    return;
  }
  const created = await new Promise(resolve => chrome.bookmarks.create({
    parentId, index, title: snapshot.title || '未命名'
  }, resolve));
  let childIndex = 0;
  for (const child of (snapshot.children || [])) {
    await createTreeFromSnapshot(child, created.id, childIndex++);
  }
}

async function restoreWantedFolder(snapshot, parentId, index, mapping) {
  if (!snapshot) return;
  if (snapshot.url) {
    await new Promise(resolve => chrome.bookmarks.move(snapshot.id, { parentId, index }, resolve));
    return;
  }
  const created = await new Promise(resolve => chrome.bookmarks.create({
    parentId, index, title: snapshot.title || '未命名'
  }, resolve));
  mapping.set(snapshot.id, created.id);
  let childIndex = 0;
  for (const child of (snapshot.children || [])) {
    await restoreWantedFolder(child, created.id, childIndex++, mapping);
  }
}

async function saveHiddenFolders() {
  if (chrome.storage && chrome.storage.local) {
    await new Promise(resolve => chrome.storage.local.set({ hiddenFolders: [...hiddenFolderIds] }, resolve));
  }
}

async function renameBookmark(id, currentTitle) {
  const title = prompt('请输入新的收藏标题：', currentTitle);
  if (!title || !title.trim()) return;
  await new Promise(resolve => chrome.bookmarks.update(id, { title: title.trim() }, resolve));
  await loadChromeBookmarks();
}

async function renameFolder(id, currentTitle) {
  const title = prompt('请输入新的文件夹名称：', currentTitle);
  if (!title || !title.trim()) return;
  await new Promise(resolve => chrome.bookmarks.update(id, { title: title.trim() }, resolve));
  await loadChromeBookmarks();
}

async function deleteBookmark(id) {
  if (!confirm('确定删除这个收藏网址吗？')) return;
  await new Promise(resolve => chrome.bookmarks.remove(id, resolve));
  await loadChromeBookmarks();
}

async function getFolderParentId(id) {
  if (!chrome.bookmarks || !chrome.bookmarks.get) return '';
  const nodes = await new Promise(resolve => chrome.bookmarks.get(id, resolve));
  return nodes && nodes[0] ? nodes[0].parentId : '';
}

async function deleteFolderRelease(id) {
  const parentId = await getFolderParentId(id);
  const ids = collectFolderIds(id);
  const toMove = allBookmarks.filter(b => ids.includes(b.folderId));
  for (const b of toMove) {
    if (parentId) {
      await new Promise(resolve => chrome.bookmarks.move(b.id, { parentId }, resolve));
    }
  }
  await new Promise(resolve => chrome.bookmarks.removeTree(id, resolve));
    ids.forEach(x => hiddenFolderIds.delete(x));
    await saveHiddenFolders();
  await loadChromeBookmarks();
}

async function deleteFolderWithContent(id) {
  if (!confirm('确定连同内部所有网址一起删除这个文件夹吗？')) return;
    const ids = collectFolderIds(id);
  await new Promise(resolve => chrome.bookmarks.removeTree(id, resolve));
    ids.forEach(x => hiddenFolderIds.delete(x));
    await saveHiddenFolders();
  await loadChromeBookmarks();
}

async function toggleFolderHidden(id) {
  if (hiddenFolderIds.has(id)) hiddenFolderIds.delete(id);
  else hiddenFolderIds.add(id);
  await saveHiddenFolders();
  renderFolders();
  renderContent();
}

// 新版弹窗版改名 / 删除
function renameBookmarkModal(id, currentTitle) {
  showInputModal('修改网址标题', currentTitle, async (title) => {
    if (!title || !title.trim()) return;
    await new Promise(resolve => chrome.bookmarks.update(id, { title: title.trim() }, resolve));
    await loadChromeBookmarks();
  });
}

async function pinBookmark(id) {
    const nodes = await new Promise(resolve => chrome.bookmarks.get(id, resolve));
    const node = nodes && nodes[0];
    if (!node) return;
    await new Promise(resolve => chrome.bookmarks.move(id, { parentId: node.parentId, index: 0 }, resolve));
    await loadChromeBookmarks();
  }

  function renameFolderModal(id, currentTitle) {
  showInputModal('修改文件夹名称', currentTitle, async (title) => {
    if (!title || !title.trim()) return;
    await new Promise(resolve => chrome.bookmarks.update(id, { title: title.trim() }, resolve));
    await loadChromeBookmarks();
  });
}

async function addFolder() {
  if (!barFolderId) return;
  const created = await new Promise(resolve => chrome.bookmarks.create({ parentId: barFolderId, title: '新建文件夹' }, resolve));
  await loadChromeBookmarks();
  renameFolderModal(created.id, '新建文件夹');
}

function deleteBookmarkModal(id) {
  showConfirmModal('删除网址', '确定删除这个收藏网址吗？', async () => {
    const nodes = await new Promise(resolve => chrome.bookmarks.get(id, resolve));
    const node = nodes && nodes[0];
    await new Promise(resolve => chrome.bookmarks.remove(id, resolve));
    if (node) pushUndo({ kind: 'url', node });
    await loadChromeBookmarks();
  });
}

function deleteFolderReleaseModal(id) {
  showConfirmModal('删除文件夹', '释放内部网址并删除文件夹？', async () => {
    const subtree = await new Promise(resolve => chrome.bookmarks.getSubTree(id, resolve));
    const snapshot = subtree && subtree[0];
    const parentId = await getFolderParentId(id);
    const ids = collectFolderIds(id);
    const toMove = allBookmarks.filter(b => ids.includes(b.folderId));
    for (const b of toMove) {
      if (parentId) {
        await new Promise(resolve => chrome.bookmarks.move(b.id, { parentId }, resolve));
      }
    }
    await new Promise(resolve => chrome.bookmarks.removeTree(id, resolve));
    ids.forEach(x => hiddenFolderIds.delete(x));
    await saveHiddenFolders();
    if (snapshot) pushUndo({ kind: 'release', snapshot, hiddenIds: [...ids] });
    await loadChromeBookmarks();
  });
}

function deleteFolderWithContentModal(id) {
  showConfirmModal('删除文件夹', '确定连同内部所有网址一起删除这个文件夹吗？', async () => {
    const subtree = await new Promise(resolve => chrome.bookmarks.getSubTree(id, resolve));
    const snapshot = subtree && subtree[0];
    const ids = collectFolderIds(id);
    await new Promise(resolve => chrome.bookmarks.removeTree(id, resolve));
    ids.forEach(x => hiddenFolderIds.delete(x));
    await saveHiddenFolders();
    if (snapshot) pushUndo({ kind: 'folder', snapshot, hiddenIds: [...ids] });
    await loadChromeBookmarks();
  });
}

async function performUndo() {
  const item = undoStack.pop();
  if (!item) return;
  try {
    if (item.kind === 'url' && item.node) {
      await new Promise(resolve => chrome.bookmarks.create({
        parentId: item.node.parentId,
        index: item.node.index,
        title: item.node.title || '',
        url: item.node.url
      }, resolve));
    } else if (item.kind === 'folder' && item.snapshot) {
      await createTreeFromSnapshot(item.snapshot, item.snapshot.parentId || '0', item.snapshot.index || 0);
    } else if (item.kind === 'release' && item.snapshot) {
      const mapping = new Map();
      await restoreWantedFolder(item.snapshot, item.snapshot.parentId || '0', item.snapshot.index || 0, mapping);
      (item.hiddenIds || []).forEach(id => hiddenFolderIds.add(id));
      await saveHiddenFolders();
    }
    await loadChromeBookmarks();
    $('#undoToast').hidden = true;
  } catch (err) {
    console.error(err);
  }
}
// ===== 渲染 =====
function folderById(id) {
  let found = null;
  (function walk(list) {
    for (const f of list) {
      if (f.id === id) { found = f; return; }
      if (f.children.length) walk(f.children);
    }
  })(folderTree);
  return found;
}

function collectFolderIds(folderId) {
  const ids = [];
  const walk = (f) => {
    ids.push(f.id);
    f.children.forEach(walk);
  };
  const root = folderById(folderId);
  if (root) walk(root);
  return ids;
}

function isMatch(b, filter) {
  const q = state.search.trim().toLowerCase();
  if (filter.type === 'domain' && b.domain !== filter.key) return false;
  if (filter.type === 'folder') {
    if (filter.key === '__loose__') {
        if (!rootFolderIds.has(b.folderId)) return false;
      } else {
        const ids = collectFolderIds(filter.key);
    if (!ids.includes(b.folderId)) return false;
      }
  }
  if (q) {
    const hay = [b.title, b.url, b.host, b.domain, b.folderPath].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function sorted(list) {
  const arr = [...list];
  switch (state.sort) {
    case 'name': arr.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN')); break;
    case 'name-desc': arr.sort((a, b) => b.title.localeCompare(a.title, 'zh-CN')); break;
    case 'recent': arr.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0)); break;
  }
  return arr;
}

function updateBookmarkColumns() {
  const list = $('#bookmarkList');
  if (!list) return;
  const minColWidth = 180;
  const gap = 6;
  const width = list.clientWidth || 600;
  let cols = Math.floor((width + gap) / (minColWidth + gap));
  cols = Math.max(1, Math.min(5, cols));
  list.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
}

function bindBookmarkDrag(list) {
  list.querySelectorAll('.bookmark-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedBookmarkId = item.dataset.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.id);
    });

    item.addEventListener('dragend', () => {
      draggedBookmarkId = null;
      list.querySelectorAll('.bookmark-item').forEach(el => el.classList.remove('dragging', 'drag-over', 'drag-before', 'drag-after'));
    });

    item.addEventListener('dragover', (e) => {
      if (!draggedBookmarkId || draggedBookmarkId === item.dataset.id) return;
      e.preventDefault();
      item.classList.remove('drag-before', 'drag-after');
      item.classList.add('drag-over');
      const rect = item.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width / 2) item.classList.add('drag-before');
      else item.classList.add('drag-after');
    });

    item.addEventListener('dragleave', () => item.classList.remove('drag-over', 'drag-before', 'drag-after'));

    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      item.classList.remove('drag-over', 'drag-before', 'drag-after');
      const sourceId = draggedBookmarkId || e.dataTransfer.getData('text/plain');
      const targetId = item.dataset.id;
      if (!sourceId || sourceId === targetId) return;
      const source = allBookmarks.find(b => b.id === sourceId);
      const target = allBookmarks.find(b => b.id === targetId);
      if (!source || !target || source.folderId !== target.folderId) return;

      const siblings = allBookmarks.filter(b => b.folderId === source.folderId);
      const targetIndex = siblings.findIndex(b => b.id === targetId);
      if (targetIndex < 0) return;

      try {
        if (chrome.bookmarks && chrome.bookmarks.move) {
          await new Promise(resolve => chrome.bookmarks.move(sourceId, { parentId: source.folderId, index: targetIndex }, resolve));
          await loadChromeBookmarks();
        }
      } catch (err) {
        console.error(err);
      }
    });
  });
}

function renderDomains() {
  const list = $('#domainList');
  if (!domains.length) {
    list.innerHTML = '<div class="empty-state">暂无收藏网址</div>';
    return;
  }
  list.innerHTML = domains.map(g => {
    const active = state.filterType === 'domain' && state.filterKey === g.domain;
    return `<div class="domain-item ${active ? 'active' : ''}" data-domain="${g.domain}">
      <img class="domain-icon favicon-img" src="${faviconUrl('https://' + g.domain + '/')}" alt="" draggable="false" data-letter="${g.domain[0].toUpperCase()}" data-color="${g.color}">
      <span class="domain-info">
        <span class="domain-name">${g.domain}</span>
      </span>
      <span class="domain-count">${g.count}</span>
    </div>`;
  }).join('');
    bindFaviconFallback(list);

  $$('#domainList .domain-item').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.domain;
      if (state.filterType === 'domain' && state.filterKey === key) {
        state.filterType = 'all';
        state.filterKey = 'all';
      } else {
        state.filterType = 'domain';
        state.filterKey = key;
      }
      renderDomains();
      renderFolders();
      renderContent();
    });
  });
}

function renderFolders() {
  const counts = new Map();
  allBookmarks.forEach(b => counts.set(b.folderId, (counts.get(b.folderId) || 0) + 1));

  const renderTree = (items, deep) => items.map(f => {
    const direct = counts.get(f.id) || 0;
    const allInFolder = f.id === '__loose__'
        ? allBookmarks.filter(b => rootFolderIds.has(b.folderId)).length
        : direct + f.children.reduce((sum, c) => sum + allCountOf(c, counts), 0);
    const expanded = deep < 1;
    const active = state.filterType === 'folder' && state.filterKey === f.id;
    return `<li class="tree-item">
      <div class="tree-row ${active ? 'active' : ''} ${expanded ? 'expanded' : ''} ${hiddenFolderIds.has(f.id) ? 'hidden-folder' : ''}" data-folder="${f.id}" draggable="${f.id === '__loose__' ? 'false' : 'true'}" style="--folder-bg:${DEFAULT_FOLDER_NAMES.has(f.title) ? 'transparent' : folderColor(f.title).bg}; --folder-border:${DEFAULT_FOLDER_NAMES.has(f.title) ? 'transparent' : folderColor(f.title).border}; ${deep ? '' : 'font-weight:600'}">
        ${f.children.length ? '<span class="tree-arrow">▶</span>' : '<span class="tree-arrow"></span>'}
        <span class="tree-emoji">📁</span>
        <span class="tree-label">${f.title}</span>
        <span class="tree-count">${allInFolder}</span>
      </div>
      ${f.children.length ? `<ul class="tree-children open">${renderTree(f.children, deep + 1)}</ul>` : ''}
    </li>`;
  }).join('');

  $('#folderTree').innerHTML = renderTree(folderTree, 0);

  $$('#folderTree .tree-row').forEach(row => {
    row.addEventListener('click', (e) => {
      const id = row.dataset.folder;
      if (e.target.closest('.tree-arrow')) {
        row.classList.toggle('expanded');
        const children = row.nextElementSibling;
        if (children) children.classList.toggle('open');
        return;
      }
      if (state.filterType === 'folder' && state.filterKey === id) {
        state.filterType = 'all';
        state.filterKey = 'all';
      } else {
        state.filterType = 'folder';
        state.filterKey = id;
      }
      renderDomains();
      renderFolders();
      renderContent();
    });
      row.addEventListener('dragstart', (e) => {
        draggedFolderId = row.dataset.folder;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.folder);
      });

      row.addEventListener('dragend', () => {
        draggedFolderId = null;
        document.querySelectorAll('.tree-row').forEach(r => r.classList.remove('drop-target', 'drag-before', 'drag-after'));
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        row.classList.add('drop-target');
        row.classList.remove('drag-before', 'drag-after');
        const rect = row.getBoundingClientRect();
        const ratio = (e.clientY - rect.top) / rect.height;
        if (ratio < 0.34) row.classList.add('drag-before');
        else if (ratio > 0.66) row.classList.add('drag-after');
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drop-target');
      });

      row.addEventListener('drop', async (e) => {
        e.preventDefault();
        row.classList.remove('drop-target');
        if (draggedFolderId) {
          await handleFolderDrop(e, row);
          return;
        }
          const id = draggedBookmarkId || e.dataTransfer.getData('text/plain');
        if (!id) return;
        try {
          if (chrome.bookmarks && chrome.bookmarks.move) {
            const targetFolder = await getFolderNode(row.dataset.folder);
              if (!targetFolder) return;
              const rect = row.getBoundingClientRect();
              const ratio = (e.clientY - rect.top) / rect.height;
              let moveParent = row.dataset.folder;
              let moveIndex = (await new Promise(resolve => chrome.bookmarks.getChildren(row.dataset.folder, resolve))).length;
              if (ratio < 0.34 && targetFolder.parentId) {
                moveParent = targetFolder.parentId;
                const children = await new Promise(resolve => chrome.bookmarks.getChildren(moveParent, resolve));
                moveIndex = children.findIndex(n => n.id === row.dataset.folder);
              } else if (ratio > 0.66 && targetFolder.parentId) {
                moveParent = targetFolder.parentId;
                const children = await new Promise(resolve => chrome.bookmarks.getChildren(moveParent, resolve));
                moveIndex = children.findIndex(n => n.id === row.dataset.folder) + 1;
              }
              await new Promise(resolve => chrome.bookmarks.move(id, { parentId: moveParent, index: moveIndex }, resolve));
            draggedBookmarkId = null;
            await loadChromeBookmarks();
          }
        } catch (err) {
          console.error(err);
        }
      });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = row.dataset.folder;
        const folder = folderById(id);
        if (!folder) return;
          if (id === '__loose__') return;
        openContextMenu(e.clientX, e.clientY, [
          { label: '改名', run: () => renameFolderModal(id, folder.title) },
          { label: hiddenFolderIds.has(id) ? '取消隐藏内容' : '隐藏内容', run: () => toggleFolderHidden(id) },
          { label: '删除文件夹：释放内部网址', danger: true, run: () => deleteFolderReleaseModal(id) },
          { label: '删除文件夹：连同内容删除', danger: true, run: () => deleteFolderWithContentModal(id) }
        ]);
      });
  });
}

function allCountOf(f, counts) {
  return (counts.get(f.id) || 0) + f.children.reduce((sum, c) => sum + allCountOf(c, counts), 0);
}

async function getFolderNode(id) {
  const nodes = await new Promise(resolve => chrome.bookmarks.get(id, resolve));
  return nodes && nodes[0] ? nodes[0] : null;
}

async function handleFolderDrop(e, targetRow) {
  const sourceId = draggedFolderId;
  const targetId = targetRow.dataset.folder;
  if (!sourceId || !targetId || sourceId === targetId) return;

  const source = await getFolderNode(sourceId);
  const target = await getFolderNode(targetId);
  if (!source || !target) return;

  // 禁止拖入自己的子孙目录
  const sourceDesc = collectFolderIds(sourceId);
  if (sourceDesc.includes(targetId)) return;

  const targetParentId = target.parentId;
  if (!targetParentId) return;

  const children = await new Promise(resolve => chrome.bookmarks.getChildren(targetParentId, resolve));
  const targetIndex = children.findIndex(n => n.id === targetId);
  if (targetIndex < 0) return;

  const rect = targetRow.getBoundingClientRect();
  const before = e.clientY < rect.top + rect.height / 2;
  let index = before ? targetIndex : targetIndex + 1;

  await new Promise(resolve => chrome.bookmarks.move(sourceId, { parentId: targetParentId, index }, resolve));
  draggedFolderId = null;
  await loadChromeBookmarks();
}

function renderContent() {
  const filter = { type: state.filterType, key: state.filterKey };
  let filtered = allBookmarks.filter(b => isMatch(b, filter));
  filtered = sorted(filtered);
  if (state.filterType === 'all') {
    const hiddenSet = new Set();
    hiddenFolderIds.forEach(id => collectFolderIds(id).forEach(x => hiddenSet.add(x)));
    filtered = filtered.filter(b => !hiddenSet.has(b.folderId));
  }
  const list = $('#bookmarkList');

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">暂无匹配网址</div>';
    return;
  }

  // 右侧与左侧“网址聚合”行样式完全一致
  list.innerHTML = filtered.map(b => {
    const color = colorFor(b.domain);
      const folderName = b.folderPath ? b.folderPath.split(' / ').pop() : '';
      const fc = folderName && !DEFAULT_FOLDER_NAMES.has(folderName) ? folderColor(folderName) : null;
      const rowStyle = fc ? `background:${fc.bg}; border-left:3px solid ${fc.border};` : 'background:#ffffff; border-left:3px solid transparent;';
    return `<a class="domain-item bookmark-item" href="${b.url}" target="_blank" rel="noopener" style="${rowStyle}" draggable="true" data-id="${b.id}">
      <img class="domain-icon favicon-img" src="${faviconUrl(b.url)}" alt="" draggable="false" data-letter="${(b.title || b.host || '?')[0].toUpperCase()}" data-color="${color}">
      <span class="domain-info">
        <span class="domain-name">${b.title}</span>
      </span>
      
    </a>`;
  }).join('');
    bindFaviconFallback(list);
    updateBookmarkColumns();
    bindBookmarkDrag(list);
    list.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const b = allBookmarks.find(x => x.id === item.dataset.id);
        if (!b) return;
        openContextMenu(e.clientX, e.clientY, [
            { label: '置顶', run: () => pinBookmark(b.id) },
          { label: '改名', run: () => renameBookmarkModal(b.id, b.title) },
          { label: '删除', danger: true, run: () => deleteBookmarkModal(b.id) }
        ]);
      });
        item.addEventListener('click', () => {
          state.filterType = 'all';
          state.filterKey = 'all';
          renderDomains();
          renderFolders();
          renderContent();
        });
    });
}

// ===== 顶栏事件 =====
$('#searchInput').addEventListener('input', (e) => {
  state.search = e.target.value;
  renderContent();
});

$('#sortSelect').addEventListener('change', (e) => {
  state.sort = e.target.value;
  renderContent();
});

  $('#homeBtn').addEventListener('click', () => {
    state.filterType = 'all';
    state.filterKey = 'all';
    state.search = '';
    state.sort = 'default';
    $('#searchInput').value = '';
    $('#sortSelect').value = 'default';
    renderDomains();
    renderFolders();
    renderContent();
  });

  $('#allBtn').addEventListener('click', () => {
    state.filterType = 'all';
    state.filterKey = 'all';
    renderDomains();
    renderFolders();
    renderContent();
  });

  $('#refreshBtn').addEventListener('click', () => {
    loadSettings().then(() => loadChromeBookmarks());
  });

  $('#appModalOk').addEventListener('click', () => {
    const cb = modalOnOk;
    hideModal();
    if (cb) cb();
  });

  $('#appModalCancel').addEventListener('click', hideModal);

  $('#appModalInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#appModalOk').click();
    if (e.key === 'Escape') hideModal();
  });

  $('#undoBtn').addEventListener('click', () => {
    performUndo();
  });

  const folderPanelEl = $('#folderTree').closest('.panel');
  if (folderPanelEl) {
    folderPanelEl.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.tree-row')) return;
      e.preventDefault();
      e.stopPropagation();
      openContextMenu(e.clientX, e.clientY, [
        { label: '添加文件夹', run: () => addFolder() }
      ]);
    });
  }
  if (folderPanelEl) {
    folderPanelEl.addEventListener('click', (e) => {
      if (e.target.closest('.tree-row')) return;
      state.filterType = 'all';
      state.filterKey = 'all';
      renderDomains();
      renderFolders();
      renderContent();
    });
  }

  $('#settingsBtn').addEventListener('click', () => {
    const panel = $('#settingsPanel');
    panel.hidden = !panel.hidden;
  });

  $('#hideDomainIcons').addEventListener('change', async (e) => {
    settings.hideDomainIcons = e.target.checked;
    document.documentElement.classList.toggle('hide-domain-icons', settings.hideDomainIcons);
    if (chrome.storage && chrome.storage.local) {
      await new Promise(resolve => chrome.storage.local.set({ hideDomainIcons: settings.hideDomainIcons }, resolve));
    }
  });

  $('#hideContentIcons').addEventListener('change', async (e) => {
    settings.hideContentIcons = e.target.checked;
    document.documentElement.classList.toggle('hide-content-icons', settings.hideContentIcons);
    if (chrome.storage && chrome.storage.local) {
      await new Promise(resolve => chrome.storage.local.set({ hideContentIcons: settings.hideContentIcons }, resolve));
    }
  });

window.addEventListener('resize', updateBookmarkColumns);

// ===== 拖动调整宽度 =====
function enableResize(panel, resizer) {
  let startX = 0;
  let startPct = 0.2;
  let workspaceWidth = 1;

  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const workspace = document.querySelector('.workspace');
    workspaceWidth = workspace.clientWidth;
    startPct = panel.getBoundingClientRect().width / workspaceWidth;
    startX = e.clientX;
    resizer.classList.add('dragging');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  });

  function onMove(e) {
    let pct = startPct + (e.clientX - startX) / workspaceWidth;
    pct = Math.max(0.125, Math.min(0.25, pct));
    panel.style.width = (pct * 100).toFixed(2) + '%';
      updateBookmarkColumns();
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    resizer.classList.remove('dragging');
  }
}

enableResize(
  document.querySelector('.workspace aside.panel:nth-of-type(1)'),
  document.getElementById('resizeLeft')
);
enableResize(
  document.querySelector('.workspace aside.panel:nth-of-type(2)'),
  document.getElementById('resizeMid')
);

// ===== 初始化 =====
loadChromeBookmarks();
