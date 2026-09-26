'use strict';

/* ============================================================
 * Базовые списки (можно расширять через модалку «Управление фразами»)
 * ============================================================ */
const DEFAULT_CHARACTERS = [
    'Персонаж1', 'Персонаж2', 'Персонаж3',
    'Персонаж4', 'Персонаж5'
];

const DEFAULT_ACTIONS = [
    'Действие1', 'Действие2', 'Действие3',
    'Действие4', 'Действие5'
];

/* ============================================================
 * Хранилище
 * ============================================================ */
const Storage = {
    getCharacters() {
        const raw = localStorage.getItem('characters');
        return raw ? JSON.parse(raw) : [...DEFAULT_CHARACTERS];
    },
    setCharacters(list) {
        localStorage.setItem('characters', JSON.stringify(list));
    },
    getActions() {
        const raw = localStorage.getItem('actions');
        return raw ? JSON.parse(raw) : [...DEFAULT_ACTIONS];
    },
    setActions(list) {
        localStorage.setItem('actions', JSON.stringify(list));
    },
    getHistory() {
        const raw = localStorage.getItem('history');
        return raw ? JSON.parse(raw) : [];
    },
    setHistory(list) {
        localStorage.setItem('history', JSON.stringify(list));
    },
    addHistory(entry) {
        const list = this.getHistory();
        list.unshift(entry);              // новые — сверху
        this.setHistory(list);
    },
    clearHistory() {
        localStorage.removeItem('history');
    }
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
    showToast._t = setTimeout(() => { toast.hidden = true; }, 2000);
}

/* ============================================================
 * Логика генератора (index.html)
 * ============================================================ */
function initGenerator() {
    const charSlot   = document.getElementById('char-slot');
    const actionSlot = document.getElementById('action-slot');
    const resultLine = document.getElementById('result-line');
    const spinAllBtn = document.getElementById('spin-all');

    /** Прокрутить одно колесо и записать значение в слот. */
    function spinOne(kind) {
        const list = kind === 'characters'
            ? Storage.getCharacters()
            : Storage.getActions();
        const value = pickRandom(list);
        const slot = kind === 'characters' ? charSlot : actionSlot;

        // Быстрая «анимация» — быстрое мелькание перед финалом
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

    /** Крутить оба колеса и вывести результат. */
    function spinAll() {
        const charValue = spinOne('characters');
        const actionValue = spinOne('actions');

        // Результат — после окончания анимации второго колеса
        setTimeout(() => {
            const text = `${charValue} + ${actionValue}`;
            resultLine.innerHTML = `<span class="result__text">${text}</span>`;

            // Запись в историю
            const now = new Date();
            Storage.addHistory({
                timestamp: now.getTime(),
                formatted: formatTimestamp(now),
                result: text
            });
        }, 550);
    }

    spinAllBtn.addEventListener('click', spinAll);

    // Отдельные кнопки у колёс — крутят только своё колесо
    document.querySelectorAll('.wheel__spin').forEach(btn => {
        btn.addEventListener('click', () => spinOne(btn.dataset.target));
    });

    // Управление фразами
    initManageModal();
}

/* ============================================================
 * Модальное окно управления фразами
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

    // Добавление
    document.querySelectorAll('[data-add]').forEach(btn => {
        btn.addEventListener('click', () => {
            const kind = btn.dataset.add;
            const input = document.getElementById(
                kind === 'characters' ? 'new-character' : 'new-action'
            );
            const value = input.value.trim();
            if (!value) {
                showToast('Введите фразу', 'error');
                return;
            }

            const list = kind === 'characters'
                ? Storage.getCharacters()
                : Storage.getActions();

            if (list.includes(value)) {
                showToast('Такая фраза уже есть', 'error');
                return;
            }

            list.push(value);
            kind === 'characters'
                ? Storage.setCharacters(list)
                : Storage.setActions(list);

            input.value = '';
            renderManageLists();
            showToast('Фраза добавлена', 'success');
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
        ? Storage.getCharacters()
        : Storage.getActions();

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
            kind === 'characters'
                ? Storage.setCharacters(newList)
                : Storage.setActions(newList);
            renderManageLists();
        });
        container.appendChild(row);
    });
}

/* ============================================================
 * Логика страницы истории (history.html)
 * ============================================================ */
function initHistory() {
    const list = document.getElementById('history-list');
    const empty = document.getElementById('history-empty');
    const clearBtn = document.getElementById('clear-history');

    if (!list || !empty) return;

    const history = Storage.getHistory();

    if (history.length === 0) {
        empty.hidden = false;
        if (clearBtn) clearBtn.hidden = true;
        return;
    }

    empty.hidden = true;

    history.forEach(entry => {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.innerHTML = `
            <span class="history-item__time">${entry.formatted}</span>
            <span class="history-item__result">${entry.result}</span>
        `;
        list.appendChild(li);
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (!confirm('Очистить всю историю генераций?')) return;
            Storage.clearHistory();
            list.innerHTML = '';
            empty.hidden = false;
            clearBtn.hidden = true;
            showToast('История очищена', 'info');
        });
    }
}

/* ============================================================
 * Запуск
 * ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('page--generator')) initGenerator();
    if (document.body.classList.contains('page--history'))   initHistory();
});
