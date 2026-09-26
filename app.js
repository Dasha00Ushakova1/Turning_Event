'use strict';

/* ============================================================
 * Состояние
 * ============================================================ */
let _appDb = null;

const DEFAULT_CHARACTERS = ['Юдер', 'Канна', 'Нахан', 'Кишиар', 'Гакейн'];
const DEFAULT_ACTIONS    = ['У моря', 'Спит', 'Что-то ест', 'Рабочий день', 'Выходной'];

/* ============================================================
 * Утилиты
 * ============================================================ */
function pickRandom(arr) {
    if (!arr || arr.length === 0) return '—';
    return arr[Math.floor(Math.random() * arr.length)];
}
function pad2(n) { return String(n).padStart(2, '0'); }
function formatTimestamp(date) {
    return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()} ` +
           `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}
function showToast(msg, type = 'info') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast toast--${type}`;
    t.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { t.hidden = true; }, 2500);
}
function esc(s) { return String(s).replace(/'/g, "''"); }

/* ============================================================
 * Локальный кэш (localStorage)
 * ============================================================ */
function lsGet(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
}
function lsSet(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

/* ============================================================
 * История: объединяем БД + localStorage
 * ============================================================ */
function getAllHistoryCombined(db) {
    const fromDb = db ? getAllHistory(db) : [];
    const fromLs = lsGet('history', []);

    const seen = new Set(fromDb.map(e => e.timestamp));
    const extra = fromLs.filter(e => !seen.has(e.timestamp));

    const merged = [...fromDb, ...extra];
    merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return merged;
}

function addHistoryEntry(db, entry) {
    if (db) {
        try { insertHistory(db, entry); }
        catch (e) { console.warn('Ошибка записи в БД:', e.message); }
    }
    const list = lsGet('history', []);
    list.push(entry);
    lsSet('history', list);
}

/* ============================================================
 * Фразы: объединяем БД + localStorage
 * ============================================================ */
function getCharacters(db) {
    const fromDb = db ? getPhrases(db, 'character').map(r => r.value) : [];
    const fromLs = lsGet('characters', []);
    const merged = Array.from(new Set([...fromDb, ...fromLs]));
    return merged.length ? merged : [...DEFAULT_CHARACTERS];
}
function getActions(db) {
    const fromDb = db ? getPhrases(db, 'action').map(r => r.value) : [];
    const fromLs = lsGet('actions', []);
    const merged = Array.from(new Set([...fromDb, ...fromLs]));
    return merged.length ? merged : [...DEFAULT_ACTIONS];
}
function addCharacter(db, value) {
    if (db && phraseExists(db, 'character', value)) return false;
    const ls = lsGet('characters', []);
    if (ls.includes(value)) return false;

    if (db) insertPhrase(db, 'character', value);
    ls.push(value);
    lsSet('characters', ls);
    return true;
}
function addAction(db, value) {
    if (db && phraseExists(db, 'action', value)) return false;
    const ls = lsGet('actions', []);
    if (ls.includes(value)) return false;

    if (db) insertPhrase(db, 'action', value);
    ls.push(value);
    lsSet('actions', ls);
    return true;
}
function removeCharacter(db, value) {
    if (db) deletePhrase(db, 'character', value);
    lsSet('characters', lsGet('characters', []).filter(v => v !== value));
}
function removeAction(db, value) {
    if (db) deletePhrase(db, 'action', value);
    lsSet('actions', lsGet('actions', []).filter(v => v !== value));
}

/* ============================================================
 * ГЕНЕРАТОР (index.html)
 * ============================================================ */
async function initGenerator() {
    const charSlot   = document.getElementById('char-slot');
    const actionSlot = document.getElementById('action-slot');
    const resultLine = document.getElementById('result-line');
    const spinAllBtn = document.getElementById('spin-all');

    try { _appDb = await loadHistoryDatabase(); }
    catch (err) {
        console.warn('БД недоступна:', err.message);
        _appDb = null;
    }

    let currentChar = '—';
    let currentAction = '—';

    function updateResultLine(saveToHistory) {
        const text = `${currentChar} + ${currentAction}`;
        resultLine.innerHTML = `<span class="result__text">${text}</span>`;

        const bothReady = currentChar !== '—' && currentAction !== '—';
        if (saveToHistory && bothReady) {
            const now = new Date();
            addHistoryEntry(_appDb, {
                timestamp: now.getTime(),
                formatted: formatTimestamp(now),
                character: currentChar,
                action: currentAction,
                result: text
            });
        }
    }

    function spinOne(kind) {
        const list = kind === 'characters' ? getCharacters(_appDb) : getActions(_appDb);
        if (list.length === 0) { showToast('Список пуст', 'error'); return; }

        const value = pickRandom(list);
        const slot = kind === 'characters' ? charSlot : actionSlot;

        let ticks = 0;
        const maxTicks = 8;
        const interval = setInterval(() => {
            slot.textContent = pickRandom(list);
            ticks++;
            if (ticks >= maxTicks) {
                clearInterval(interval);
                slot.textContent = value;
                slot.classList.add('wheel__slot--pop');
                setTimeout(() => slot.classList.remove('wheel__slot--pop'), 300);

                if (kind === 'characters') currentChar = value;
                else                       currentAction = value;

                updateResultLine(false);
            }
        }, 60);
    }

    /* Главная кнопка — крутит оба колеса и сохраняет */
    spinAllBtn.addEventListener('click', () => {
        spinOne('characters');
        spinOne('actions');
        setTimeout(() => updateResultLine(true), 600);
    });

    /* Кнопки «Крутить» у каждого колеса:
       крутят своё колесо и — если оба значения уже заполнены —
       тоже пишут запись в историю. */
    document.querySelectorAll('.wheel__spin').forEach(btn => {
        btn.addEventListener('click', () => {
            spinOne(btn.dataset.target);
            setTimeout(() => updateResultLine(true), 700);
        });
    });

    initManageModal();
}

/* ============================================================
 * Модалка управления фразами
 * ============================================================ */
function initManageModal() {
    const modal   = document.getElementById('manage-modal');
    const openBtn = document.getElementById('open-manage');
    const closeBtn = document.getElementById('manage-close');
    if (!modal || !openBtn) return;

    openBtn.addEventListener('click', e => {
        e.preventDefault();
        renderManageLists();
        modal.hidden = false;
    });
    closeBtn.addEventListener('click', () => { modal.hidden = true; });
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.hidden = true;
    });

    document.querySelectorAll('[data-add]').forEach(btn => {
        btn.addEventListener('click', () => {
            const kind = btn.dataset.add;
            const input = document.getElementById(
                kind === 'characters' ? 'new-character' : 'new-action'
            );
            const value = input.value.trim();
            if (!value) { showToast('Введите фразу', 'error'); return; }

            const ok = kind === 'characters'
                ? addCharacter(_appDb, value)
                : addAction(_appDb, value);

            if (!ok) { showToast('Уже есть', 'error'); return; }

            input.value = '';
            renderManageLists();
            showToast('Добавлено', 'success');
        });
    });
}

function renderManageLists() {
    renderPhraseList('characters', 'list-characters');
    renderPhraseList('actions', 'list-actions');
}

function renderPhraseList(kind, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const list = kind === 'characters'
        ? getCharacters(_appDb)
        : getActions(_appDb);
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = `<p class="phrase-list__empty">Пусто</p>`;
        return;
    }

    list.forEach(phrase => {
        const row = document.createElement('div');
        row.className = 'phrase-list__row';
        row.innerHTML = `
            <span class="phrase-list__text">${phrase}</span>
            <button class="btn btn--ghost btn--dark btn--small" type="button">✕</button>
        `;
        row.querySelector('button').addEventListener('click', () => {
            if (kind === 'characters') removeCharacter(_appDb, phrase);
            else                       removeAction(_appDb, phrase);
            renderManageLists();
        });
        container.appendChild(row);
    });
}

/* ============================================================
 * ИСТОРИЯ (history.html) — таблица
 * ============================================================ */
async function initHistory() {
    const tbody   = document.getElementById('history-body');
    const emptyEl = document.getElementById('history-empty');

    try { _appDb = await loadHistoryDatabase(); }
    catch (err) {
        console.warn('БД недоступна:', err.message);
        _appDb = null;
    }

    const entries = getAllHistoryCombined(_appDb);
    tbody.innerHTML = '';

    if (entries.length === 0) {
        emptyEl.hidden = false;
        return;
    }
    emptyEl.hidden = true;

    entries.forEach(e => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${e.formatted || ''}</td>
            <td>${e.character || ''}</td>
            <td>${e.action || ''}</td>
            <td>${e.result || ''}</td>
        `;
        tbody.appendChild(tr);
    });
}

/* ============================================================
 * Запуск
 * ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('page--generator')) initGenerator();
    if (document.body.classList.contains('page--history'))   initHistory();
});
