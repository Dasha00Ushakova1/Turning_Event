'use strict';

/* ============================================================
 * Загрузка sql.js и history.db
 * ============================================================ */
let _db = null;

async function loadHistoryDatabase() {
    if (_db) return _db;

    const SQL = await initSqlJs({ locateFile: file => `./${file}` });
    const response = await fetch('./history.db');
    if (!response.ok) {
        throw new Error(`Не удалось загрузить history.db (HTTP ${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    _db = new SQL.Database(new Uint8Array(buffer));
    return _db;
}

/**
 * Выполняет SQL-запрос и возвращает массив объектов.
 */
function queryDb(db, sql) {
    const res = db.exec(sql);
    if (!res || res.length === 0) return [];
    const { columns, values } = res[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((c, i) => obj[c] = row[i]);
        return obj;
    });
}

/**
 * Возвращает всю историю из БД, новые — сверху.
 */
function getAllHistory(db) {
    return queryDb(db, `
        SELECT id, timestamp, formatted, character, action, result
        FROM History
        ORDER BY timestamp DESC
    `);
}

/**
 * Добавляет запись в БД (в памяти страницы).
 */
function insertHistory(db, entry) {
    const esc = s => String(s).replace(/'/g, "''");
    db.run(`
        INSERT INTO History (timestamp, formatted, character, action, result)
        VALUES (
            ${entry.timestamp},
            '${esc(entry.formatted)}',
            '${esc(entry.character)}',
            '${esc(entry.action)}',
            '${esc(entry.result)}'
        )
    `);
}

/**
 * Удаляет всю историю из БД (в памяти).
 */
function clearHistoryDb(db) {
    db.run('DELETE FROM History');
}

/**
 * Экспортирует текущее состояние БД в Blob для скачивания.
 */
function exportDatabase(db) {
    const data = db.export();
    return new Blob([data], { type: 'application/octet-stream' });
}

/* ============================================================
 * Скачивание обновлённого history.db
 * ============================================================ */
function downloadDatabase(db) {
    const blob = exportDatabase(db);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'history.db';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
