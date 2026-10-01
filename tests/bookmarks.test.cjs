const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Load the actual application functions; only the browser boundary is mocked.
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8').split('// ===== 顶栏事件 =====')[0];

function setup() {
  const elements = new Map();
  const element = () => ({
    innerHTML: '', attributes: {}, setAttribute(name, value) { this.attributes[name] = String(value); }, style: {}, clientWidth: 600, dataset: {},
    addEventListener() {}, querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }
  });
  const bookmark = (id, title = id, url = `https://${id}.example/`) => ({ id, title, url });
  const roots = [
    { id: '1', title: 'Lesezeichenleiste', children: [
      bookmark('a', 'Zulu'),
      { id: 'f', title: 'F <test>', children: [bookmark('b'), { id: 'sub', title: 'Sub', children: [bookmark('c')] }] },
      bookmark('d', 'Alpha'), { id: 'empty', title: 'Empty', children: [] }, bookmark('e', 'Echo')
    ] },
    { id: '2', title: 'Other', children: [bookmark('o'), { id: 'otherFolder', title: 'Other folder', children: [] }] },
    { id: '3', title: 'Mobile', children: [bookmark('file', 'Local', 'file:///tmp/a.html')] }
  ];
  const tree = [{ id: '0', children: roots }];
  let nodes;
  function reindex() {
    nodes = new Map();
    function walk(node, parentId, index) {
      node.parentId = parentId;
      node.index = index;
      nodes.set(node.id, node);
      (node.children || []).forEach((child, i) => walk(child, node.id, i));
    }
    walk(tree[0]);
  }
  reindex();
  const moves = [];
  let nextId = 100;
  const chrome = { runtime: {}, bookmarks: {
    getTree(cb) { cb(tree); },
    getSubTree(id, cb) { cb([JSON.parse(JSON.stringify(nodes.get(id)))]); },
    get(id, cb) { cb(nodes.has(id) ? [nodes.get(id)] : []); },
    getChildren(id, cb) { cb(nodes.get(id).children); },
    create(details, cb) {
      const parent = nodes.get(details.parentId);
      const node = { ...details, id: String(nextId++) };
      if (!node.url) node.children = [];
      parent.children.splice(details.index ?? parent.children.length, 0, node);
      reindex();
      cb(node);
    },
    removeTree(id, cb) {
      const node = nodes.get(id);
      nodes.get(node.parentId).children.splice(node.index, 1);
      reindex();
      cb();
    },
    move(id, destination, cb) {
      moves.push({ id, ...destination });
      const node = nodes.get(id);
      const parent = nodes.get(destination.parentId);
      const oldParent = nodes.get(node.parentId);
      const oldIndex = oldParent.children.indexOf(node);
      // Chromium BookmarkModel::Move accepts the pre-removal index.
      let index = destination.index ?? parent.children.length;
      if (oldParent === parent && index > oldIndex) index--;
      oldParent.children.splice(oldIndex, 1);
      parent.children.splice(index, 0, node);
      reindex();
      cb(node);
    }
  } };
  const context = vm.createContext({ console, URL, setTimeout, clearTimeout, chrome, window: { chrome }, document: {
    addEventListener() {},
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    querySelectorAll() { return []; },
    documentElement: { getAttribute() { return 'light'; } }
  } });
  const run = code => vm.runInContext(code, context);
  run(source);
  async function drop(id, target, y = 50, folder = true) {
    context.dropRow = { dataset: { folder: target }, getBoundingClientRect: () => ({ top: 0, height: 100 }) };
    context.dropEvent = { clientY: y, preventDefault() {}, stopPropagation() {} };
    run(`${folder ? 'draggedFolderId' : 'draggedBookmarkId'} = ${JSON.stringify(id)}`);
    await run('handleFolderDrop(dropEvent, dropRow)');
  }
  return { run, chrome, elements, moves, drop, roots, node: id => nodes.get(id) };
}

test('零散 includes direct bookmarks from every system root, excludes nested bookmarks, supports sort/search', async () => {
  const app = setup();
  await app.run('loadChromeBookmarks()');
  assert.equal(app.run('barFolderId'), '1');
  assert.equal(app.run('allBookmarks.filter(isLooseBookmark).map(b => b.id).join()'), 'a,d,e,o,file');
  app.run("state.filterType = 'folder'; state.filterKey = '__loose__'; state.sort = 'name'; renderContent()");
  const html = app.elements.get('#bookmarkList').innerHTML;
  assert.ok(html.indexOf('data-id="d"') < html.indexOf('data-id="a"'));
  assert.ok(html.includes('data-id="o"') && html.includes('data-id="file"'));
  assert.ok(!html.includes('data-id="b"'));
  app.run("state.search = 'Alpha'; renderContent()");
  assert.ok(app.elements.get('#bookmarkList').innerHTML.includes('data-id="d"'));
  assert.ok(!app.elements.get('#bookmarkList').innerHTML.includes('data-id="a"'));
  app.run("state.search = 'missing'; renderContent()");
  assert.ok(app.elements.get('#bookmarkList').innerHTML.includes('暂无匹配网址'));
});

test('零散 works without a recognized bookmarks bar', async () => {
  const app = setup();
  app.roots.shift();
  await app.run('loadChromeBookmarks()');
  app.run("state.filterType = 'folder'; state.filterKey = '__loose__'; renderContent()");
  assert.equal(app.run('barFolderId'), null);
  assert.ok(app.elements.get('#bookmarkList').innerHTML.includes('data-id="o"'));
});

test('folder middle drop nests into empty folders; loose drop restores original root', async () => {
  const app = setup();
  await app.run('loadChromeBookmarks()');
  await app.drop('f', 'empty');
  assert.equal(app.node('f').parentId, 'empty');
  assert.equal(app.node('sub').parentId, 'f');
  assert.equal(app.run("folderExpansion.get('empty')"), true);
  await app.drop('f', '__loose__');
  assert.equal(app.node('f').parentId, '1');
  assert.equal(app.node('c').parentId, 'sub');
});

test('folder edges reorder siblings and move a second-level folder up one level', async () => {
  const app = setup();
  await app.run('loadChromeBookmarks()');
  await app.drop('f', 'empty', 95);
  assert.equal(app.node('1').children.map(n => n.id).join(), 'a,d,empty,f,e');
  await app.drop('f', 'empty', 5);
  assert.equal(app.node('1').children.map(n => n.id).join(), 'a,d,f,empty,e');
  await app.drop('sub', 'empty', 5);
  assert.equal(app.node('sub').parentId, '1');
  assert.equal(app.node('1').children.map(n => n.id).join(), 'a,d,f,sub,empty,e');
});

test('reject self, descendants, system root dragging and external text drops', async () => {
  const app = setup();
  await app.run('loadChromeBookmarks()');
  await app.drop('f', 'f');
  await app.drop('f', 'sub');
  await app.drop('f', 'sub', 5);
  await app.drop('2', 'f');
  await app.drop('__loose__', 'f');
  await app.drop(null, 'f');
  assert.equal(app.moves.length, 0);
});

test('bookmarks move between folders and loose in their own system root', async () => {
  const app = setup();
  await app.run('loadChromeBookmarks()');
  await app.drop('b', 'otherFolder', 50, false);
  assert.equal(app.node('b').parentId, 'otherFolder');
  await app.drop('b', '__loose__', 50, false);
  assert.equal(app.node('b').parentId, '2');
  assert.equal(app.run("allBookmarks.filter(isLooseBookmark).some(b => b.id === 'b')"), true);
});

test('bookmark relative ordering uses complete sibling order including folders in both directions', async () => {
  const app = setup();
  await app.run('loadChromeBookmarks()');
  await app.run("moveRelative('a', 'd', false)");
  assert.equal(app.node('1').children.map(n => n.id).join(), 'f,d,a,empty,e');
  await app.run("moveRelative('e', 'd', true)");
  assert.equal(app.node('1').children.map(n => n.id).join(), 'f,e,d,a,empty');
  await app.run("moveRelative('b', 'd', false)");
  assert.equal(app.node('1').children.map(n => n.id).join(), 'f,e,d,b,a,empty');
});

test('API errors surface and never trigger a success reload', async () => {
  const app = setup();
  await app.run('loadChromeBookmarks()');
  app.chrome.bookmarks.move = (id, destination, cb) => {
    app.chrome.runtime.lastError = { message: 'Cannot modify managed bookmarks' };
    cb();
    delete app.chrome.runtime.lastError;
  };
  await assert.rejects(app.run("moveRelative('a', 'd', true)"), /Cannot modify/);
  app.run('loadChromeBookmarks = () => { throw new Error("Unexpected reload"); }; reportMoveError = e => { globalThis.moveError = e.message; }');
  await app.drop('f', 'empty');
  assert.match(app.run('moveError'), /Cannot modify/);
  assert.equal(app.run('draggedFolderId'), null);
});

test('folder expansion survives rerender and user strings are escaped', async () => {
  const app = setup();
  await app.run('loadChromeBookmarks()');
  app.run("folderExpansion.set('f', false); renderFolders()");
  assert.ok(app.elements.get('#folderTree').innerHTML.includes('F &lt;test&gt;'));
  assert.equal(app.run("folderExpansion.get('f')"), false);
  const html = app.run(`renderBookmarkItem({ id: 'x', title: '<img src=x>"', url: 'https://example.com/?q="x"', host: 'example.com', domain: 'example.com' }, false)`);
  assert.ok(html.includes('&lt;img src=x&gt;&quot;'));
  assert.ok(html.includes('?q=&quot;x&quot;'));
});

test('failed release stops before deleting the source folder', async () => {
  const app = setup();
  await app.run('loadChromeBookmarks()');
  app.run('showConfirmModal = (title, message, cb) => { globalThis.confirmAction = cb; };');
  app.chrome.bookmarks.move = (id, destination, cb) => {
    app.chrome.runtime.lastError = { message: 'Move failed' };
    cb();
    delete app.chrome.runtime.lastError;
  };
  app.run("deleteFolderReleaseModal('f')");
  await assert.rejects(app.run('confirmAction()'), /Move failed/);
  assert.equal(app.node('f').children.length, 2);
  assert.equal(app.node('b').parentId, 'f');
  assert.equal(app.run('undoStack.length'), 0);
});

for (const kind of ['Release', 'WithContent']) {
  test(`delete ${kind} and undo preserves hierarchy and only originally hidden folders`, async () => {
    const app = setup();
    await app.run('loadChromeBookmarks()');
    app.run('showConfirmModal = (title, message, cb) => { globalThis.confirmAction = cb; }; showUndoToast = () => {};');
    app.run("hiddenFolderIds.add('sub')");
    app.run(`deleteFolder${kind}Modal('f')`);
    await app.run('confirmAction()');
    assert.equal(app.node('f'), undefined);
    assert.equal(app.run('hiddenFolderIds.size'), 0);
    await app.run('performUndo()');
    const restored = app.node('1').children.find(n => n.title === 'F <test>');
    assert.ok(restored);
    const sub = restored.children.find(n => n.title === 'Sub');
    assert.equal(sub.children[0].title, 'c');
    assert.equal(restored.children[0].title, 'b');
    assert.equal(app.run('hiddenFolderIds.size'), 1);
    assert.equal(app.run(`hiddenFolderIds.has('${sub.id}')`), true);
    assert.equal(app.run(`hiddenFolderIds.has('${restored.id}')`), false);
  });
}

test('view status follows folder/domain searches and matches the visible hidden-folder scope', async () => {
  const app = setup();
  await app.run('loadChromeBookmarks()');
  assert.equal(app.elements.get('#resultCount').textContent, '7 个书签');
  assert.equal(app.elements.get('#allBtn').attributes['aria-pressed'], 'true');
  app.run("state.filterType = 'folder'; state.filterKey = 'f'; state.search = 'b'; renderContent()");
  assert.equal(app.elements.get('#filterLabel').textContent, 'F <test>');
  assert.equal(app.elements.get('#resultCount').textContent, '2 个匹配');
  assert.equal(app.elements.get('#clearFilterBtn').hidden, false);
  assert.equal(app.elements.get('#clearSearchBtn').hidden, false);
  assert.equal(app.elements.get('#allBtn').attributes['aria-pressed'], 'false');
  app.run("state.filterType = 'domain'; state.filterKey = 'b.example'; state.search = ''; renderContent()");
  assert.equal(app.elements.get('#filterLabel').textContent, 'b.example');
  assert.equal(app.elements.get('#resultCount').textContent, '1 个书签');
  app.run("clearFilters(); hiddenFolderIds.add('f'); renderContent()");
  assert.equal(app.elements.get('#resultCount').textContent, '5 个书签');
});

test('clear scope preserves search; explicit all reset clears search and keeps sort', async () => {
  const app = setup();
  await app.run('loadChromeBookmarks()');
  app.run("state.filterType = 'folder'; state.filterKey = 'f'; state.search = 'Alpha'; state.sort = 'recent'; clearFilters()");
  assert.equal(app.run('state.filterType'), 'all');
  assert.equal(app.run('state.search'), 'Alpha');
  assert.equal(app.elements.get('#resultCount').textContent, '1 个匹配');
  app.run('clearFilters(true)');
  assert.equal(app.run('state.search'), '');
  assert.equal(app.run('state.sort'), 'recent');
  assert.equal(app.elements.get('#searchInput').value, '');
  assert.equal(app.elements.get('#clearFilterBtn').hidden, true);
  assert.equal(app.elements.get('#clearSearchBtn').hidden, true);
});

test('opening a bookmark preserves the active folder and search; action button is separate from link', async () => {
  const app = setup();
  await app.run('loadChromeBookmarks()');
  const html = app.run('renderBookmarkItem(allBookmarks.find(b => b.id === "b"))');
  assert.ok(html.indexOf('</a>') < html.indexOf('class="row-menu"'));
  app.run(`
    state.filterType = 'folder'; state.filterKey = 'f'; state.search = 'b';
    const linkHandlers = {};
    const itemHandlers = {};
    const linkStub = { addEventListener(name, handler) { linkHandlers[name] = handler; } };
    const itemStub = {
      dataset: { id: 'b' },
      querySelector(selector) { return selector === '.bookmark-link' ? linkStub : null; },
      addEventListener(name, handler) { itemHandlers[name] = handler; }
    };
    bindInnerList({ querySelectorAll(selector) { return selector === '.bookmark-item' ? [itemStub] : []; } });
    linkHandlers.click();
  `);
  assert.equal(app.run('state.filterType'), 'folder');
  assert.equal(app.run('state.filterKey'), 'f');
  assert.equal(app.run('state.search'), 'b');
  assert.equal(app.run('itemHandlers.click'), undefined);
});


test('Escape restores menu focus only when a context menu was open', () => {
  const app = setup();
  app.run('let restoreCount = 0; contextMenuReturnFocus = { isConnected: true, focus() { restoreCount++; } };');
  app.elements.set('#contextMenu', { hidden: false });
  app.run('hideContextMenu(true)');
  assert.equal(app.run('restoreCount'), 1);
  assert.equal(app.elements.get('#contextMenu').hidden, true);
  app.run('hideContextMenu(true)');
  assert.equal(app.run('restoreCount'), 1);
});


test('favicons use the browser interface only and never fall back to a third-party service', () => {
  const app = setup();
  app.chrome.runtime.getURL = value => 'chrome-extension://test-extension' + value;
  const icon = app.run('faviconUrl("https://example.com/private?q=1")');
  assert.equal(icon, 'chrome-extension://test-extension/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2Fprivate%3Fq%3D1&size=32');
  delete app.chrome.runtime.getURL;
  assert.equal(app.run('faviconUrl("https://example.com/private?q=1")'), '');
  assert.equal(app.run('faviconUrl("not a valid URL")'), '');
});
