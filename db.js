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

/* ============================================================
 * Общие утилиты
 * ============================================================ */
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

function escapeSql(s) {
    return String(s).replace(/'/g, "''");
}

/* ============================================================
 * История
 * ============================================================ */
function getAllHistory(db) {
    return queryDb(db, `
        SELECT id, timestamp, formatted, character, action, result
        FROM History
        ORDER BY timestamp DESC
    `);
}

function insertHistory(db, entry) {
    db.run(`
        INSERT INTO History (timestamp, formatted, character, action, result)
        VALUES (
            ${entry.timestamp},
            '${escapeSql(entry.formatted)}',
            '${escapeSql(entry.character)}',
            '${escapeSql(entry.action)}',
            '${escapeSql(entry.result)}'
        )
    `);
}

function clearHistoryDb(db) {
    db.run('DELETE FROM History');
}

/* ============================================================
 * Фразы (персонажи и действия)
 * ============================================================ */
function getPhrases(db, kind) {
    return queryDb(db, `
        SELECT id, value FROM Phrases
        WHERE kind = '${escapeSql(kind)}'
        ORDER BY id ASC
    `);
}

function insertPhrase(db, kind, value) {
    db.run(`
        INSERT INTO Phrases (kind, value)
        VALUES ('${escapeSql(kind)}', '${escapeSql(value)}')
    `);
}

function deletePhrase(db, kind, value) {
    db.run(`
        DELETE FROM Phrases
        WHERE kind = '${escapeSql(kind)}' AND value = '${escapeSql(value)}'
    `);
}

function phraseExists(db, kind, value) {
    const rows = queryDb(db, `
        SELECT 1 FROM Phrases
        WHERE kind = '${escapeSql(kind)}' AND value = '${escapeSql(value)}'
        LIMIT 1
    `);
    return rows.length > 0;
}

/* ============================================================
 * Экспорт файла history.db
 * ============================================================ */
function exportDatabase(db) {
    const data = db.export();
    return new Blob([data], { type: 'application/octet-stream' });
}

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
