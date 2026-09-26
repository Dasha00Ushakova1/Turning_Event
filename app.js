'use strict';

/* ============================================================
 * Списки фраз
 * ============================================================ */
const DEFAULT_CHARACTERS = ['Юдер', 'Канна', 'Нахан', 'Кишиар', 'Гакейн'];
const DEFAULT_ACTIONS    = ['У моря', 'Спит', 'Что-то ест', 'Рабочий день', 'Выходной'];

/* ============================================================
 * Хранилище фраз (списки) — localStorage
 * ============================================================ */
const Storage = {
    getCharacters() {
        const raw = localStorage.getItem('characters');
        return raw ? JSON.parse(raw) : [...DEFAULT_CHARACTERS];
    },
    setCharacters(list) { localStorage.setItem('characters', JSON.stringify(list)); },
    getActions() {
        const raw = localStorage.getItem('actions');
        return raw ? JSON.parse(raw) : [...DEFAULT_ACTIONS];
    },
    setActions(list) { localStorage.setItem('actions', JSON.stringify(list)); }
};

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
 * ГЕНЕРАТОР (index.html)
 * ============================================================ */
function initGenerator() {
    const charSlot   = document.getElementById('char-slot');
    const actionSlot = document.getElementById('action-slot');
    const resultLine = document.getElementById('result-line');
    const spinAllBtn = document.getElementById('spin-all');

    let db = null;
    loadHistoryDatabase()
        .then(database => { db = database; })
        .catch(err => {
            console.warn('history.db недоступна:', err.message);
        });

    function spinOne(kind) {
        const list = kind === 'characters' ? Storage.getCharacters() : Storage.getActions();
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
            }
        }, 60);

        return value;
    }

    function spinAll() {
        const charValue   = spinOne('characters');
        const actionValue = spinOne('actions');

        setTimeout(() => {
            const text = `${charValue} + ${actionValue}`;
            resultLine.innerHTML = `<span class="result__text">${text}</span>`;

            const now = new Date();
            const entry = {
                timestamp: now.getTime(),
                formatted: formatTimestamp(now),
                character: charValue,
                action: actionValue,
                result: text
            };

            // Пишем в БД (в памяти страницы)
            if (db) {
                try {
                    insertHistory(db, entry);
                    showToast('Запись добавлена в историю', 'success');
                } catch (e) {
                    console.error('Не удалось добавить запись:', e);
                    showToast('Ошибка записи в историю', 'error');
                }
            } else {
                showToast('История недоступна', 'error');
            }
        }, 550);
    }

    spinAllBtn.addEventListener('click', spinAll);

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

            const list = kind === 'characters' ? Storage.getCharacters() : Storage.getActions();
            if (list.includes(value)) { showToast('Уже есть', 'error'); return; }

            list.push(value);
            kind === 'characters' ? Storage.setCharacters(list) : Storage.setActions(list);
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

    const list = kind === 'characters' ? Storage.getCharacters() : Storage.getActions();
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = `<p class="phrase-list__empty">Пусто</p>`;
        return;
    }

    list.forEach((phrase, idx) => {
        const row = document.createElement('div');
        row.className = 'phrase-list__row';
        row.innerHTML = `
            <span class="phrase-list__text">${phrase}</span>
            <button class="btn btn--ghost btn--dark btn--small" type="button"
                    data-remove="${kind}" data-idx="${idx}">✕</button>
        `;
        row.querySelector('[data-remove]').addEventListener('click', () => {
            const newList = [...list];
            newList.splice(idx, 1);
            kind === 'characters' ? Storage.setCharacters(newList) : Storage.setActions(newList);
            renderManageLists();
        });
        container.appendChild(row);
    });
}

/* ============================================================
 * ИСТОРИЯ (history.html)
 * ============================================================ */
async function initHistory() {
    const listEl = document.getElementById('history-list');
    const emptyEl = document.getElementById('history-empty');
    const saveBtn = document.getElementById('save-db');
    const clearBtn = document.getElementById('clear-history');

    let db;
    try {
        db = await loadHistoryDatabase();
    } catch (err) {
        console.error(err);
        emptyEl.textContent = 'Не удалось загрузить history.db';
        emptyEl.hidden = false;
        return;
    }

    function render() {
        const entries = getAllHistory(db);
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

    saveBtn.addEventListener('click', () => {
        downloadDatabase(db);
        showToast('Файл history.db скачан — залейте его в репозиторий', 'success');
    });

    clearBtn.addEventListener('click', () => {
        if (!confirm('Очистить всю историю?')) return;
        clearHistoryDb(db);
        render();
        showToast('История очищена — не забудьте сохранить файл', 'info');
    });

    render();
}

/* ============================================================
 * Запуск
 * ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('page--generator')) initGenerator();
    if (document.body.classList.contains('page--history'))   initHistory();
});
