'use strict';

/* ============================================================
 * Значения по умолчанию — используются как fallback,
 * если history.db недоступна
 * ============================================================ */
const DEFAULT_CHARACTERS = ['Юдер', 'Канна', 'Нахан', 'Кишиар', 'Гакейн'];
const DEFAULT_ACTIONS    = ['У моря', 'Спит', 'Что-то ест', 'Рабочий день', 'Выходной'];

/* Кэш БД */
let _appDb = null;

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

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast toast--${type}`;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, 2500);
}

/* ============================================================
 * Обёртки над фразами
 * ============================================================ */
function getCharacters() {
    if (_appDb) {
        const rows = getPhrases(_appDb, 'character');
        return rows.length ? rows.map(r => r.value) : [...DEFAULT_CHARACTERS];
    }
    const raw = localStorage.getItem('characters');
    return raw ? JSON.parse(raw) : [...DEFAULT_CHARACTERS];
}

function getActions() {
    if (_appDb) {
        const rows = getPhrases(_appDb, 'action');
        return rows.length ? rows.map(r => r.value) : [...DEFAULT_ACTIONS];
    }
    const raw = localStorage.getItem('actions');
    return raw ? JSON.parse(raw) : [...DEFAULT_ACTIONS];
}

function addCharacter(value) {
    if (_appDb) {
        if (phraseExists(_appDb, 'character', value)) return false;
        insertPhrase(_appDb, 'character', value);
    }
    const list = JSON.parse(localStorage.getItem('characters') || '[]');
    if (!list.includes(value)) list.push(value);
    localStorage.setItem('characters', JSON.stringify(list));
    return true;
}

function addAction(value) {
    if (_appDb) {
        if (phraseExists(_appDb, 'action', value)) return false;
        insertPhrase(_appDb, 'action', value);
    }
    const list = JSON.parse(localStorage.getItem('actions') || '[]');
    if (!list.includes(value)) list.push(value);
    localStorage.setItem('actions', JSON.stringify(list));
    return true;
}

function removeCharacter(value) {
    if (_appDb) deletePhrase(_appDb, 'character', value);
    const list = JSON.parse(localStorage.getItem('characters') || '[]');
    localStorage.setItem('characters', JSON.stringify(list.filter(v => v !== value)));
}

function removeAction(value) {
    if (_appDb) deletePhrase(_appDb, 'action', value);
    const list = JSON.parse(localStorage.getItem('actions') || '[]');
    localStorage.setItem('actions', JSON.stringify(list.filter(v => v !== value)));
}

/* ============================================================
 * ГЕНЕРАТОР (index.html)
 * ============================================================ */
async function initGenerator() {
    const charSlot   = document.getElementById('char-slot');
    const actionSlot = document.getElementById('action-slot');
    const resultLine = document.getElementById('result-line');
    const spinAllBtn = document.getElementById('spin-all');

    try {
        _appDb = await loadHistoryDatabase();
    } catch (err) {
        console.warn('history.db недоступна:', err.message);
        _appDb = null;
    }

    let currentChar   = '—';
    let currentAction = '—';

    function updateResultLine(saveToHistory) {
        const text = `${currentChar} + ${currentAction}`;
        resultLine.innerHTML = `<span class="result__text">${text}</span>`;

        const bothReady = currentChar !== '—' && currentAction !== '—';
        if (saveToHistory && bothReady && _appDb) {
            const now = new Date();
            const entry = {
                timestamp: now.getTime(),
                formatted: formatTimestamp(now),
                character: currentChar,
                action: currentAction,
                result: text
            };
            try {
                insertHistory(_appDb, entry);
            } catch (e) {
                console.error('Не удалось добавить запись:', e);
            }
        }
    }

    function spinOne(kind) {
        const list = kind === 'characters' ? getCharacters() : getActions();
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

        return value;
    }

    spinAllBtn.addEventListener('click', () => {
        spinOne('characters');
        spinOne('actions');
        setTimeout(() => updateResultLine(true), 600);
    });

    document.querySelectorAll('.wheel__spin').forEach(btn => {
        btn.addEventListener('click', () => spinOne(btn.dataset.target));
    });

    initManageModal();
}

/* ============================================================
 * Модалка управления фразами
 * ============================================================ */
function initManageModal() {
    const modal = document.getElementById('manage-modal');
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

            const dbKind = kind === 'characters' ? 'character' : 'action';

            if (_appDb && phraseExists(_appDb, dbKind, value)) {
                showToast('Уже есть', 'error');
                return;
            }

            if (kind === 'characters') addCharacter(value);
            else                       addAction(value);

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

    const list = kind === 'characters' ? getCharacters() : getActions();
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
            if (kind === 'characters') removeCharacter(phrase);
            else                       removeAction(phrase);
            renderManageLists();
        });
        container.appendChild(row);
    });
}

/* ============================================================
 * ИСТОРИЯ (history.html)
 * ============================================================ */
async function initHistory() {
    const listEl  = document.getElementById('history-list');
    const emptyEl = document.getElementById('history-empty');

    try {
        _appDb = await loadHistoryDatabase();
    } catch (err) {
        console.error(err);
        emptyEl.textContent = 'Не удалось загрузить историю';
        emptyEl.hidden = false;
        return;
    }

    const entries = getAllHistory(_appDb);
    listEl.innerHTML = '';

    if (entries.length === 0) {
        emptyEl.hidden = false;
        return;
    }
    emptyEl.hidden = true;

    entries.forEach(entry => {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.innerHTML = `
            <span class="history-item__time">${entry.formatted}</span>
            <span class="history-item__result">${entry.result}</span>
        `;
        listEl.appendChild(li);
    });
}

/* ============================================================
 * Запуск
 * ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('page--generator')) initGenerator();
    if (document.body.classList.contains('page--history'))   initHistory();
});
