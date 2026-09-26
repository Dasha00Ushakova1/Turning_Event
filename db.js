'use strict';

/* ============================================================
 * Загрузка sql.js и history.db
 * ============================================================ */
let _db = null;

async function loadHistoryDatabase() {
    if (_db) return _db;

    const SQL = await initSqlJs({ locateFile: file => `./${file}` });
    const response = await fetch('./history.db');
    if (!response.ok) throw new Error(`history.db: HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    _db = new SQL.Database(new Uint8Array(buffer));
    return _db;
}

/* ============================================================
 * Утилиты
 * ============================================================ */
function queryDb(db, sql) {
    const res = db.exec(sql);
    if (!res || res.length === 0) return [];
    const { columns, values } = res[0];
    return values.map(row => {
        const o = {};
        columns.forEach((c, i) => o[c] = row[i]);
        return o;
    });
}

function esc(s) {
    return String(s).replace(/'/g, "''");
}

/* ============================================================
 * История
 * ============================================================ */
function getAllHistory(db) {
    return queryDb(db, `
        SELECT id, timestamp, formatted, character, action, result
        FROM History ORDER BY timestamp DESC
    `);
}

function insertHistory(db, e) {
    db.run(`
        INSERT INTO History (timestamp, formatted, character, action, result)
        VALUES (
            ${e.timestamp},
            '${esc(e.formatted)}',
            '${esc(e.character)}',
            '${esc(e.action)}',
            '${esc(e.result)}'
        )
    `);
}

/* ============================================================
 * Фразы
 * ============================================================ */
function getPhrases(db, kind) {
    return queryDb(db, `
        SELECT id, value FROM Phrases
        WHERE kind = '${esc(kind)}' ORDER BY id ASC
    `);
}

function insertPhrase(db, kind, value) {
    db.run(`
        INSERT INTO Phrases (kind, value)
        VALUES ('${esc(kind)}', '${esc(value)}')
    `);
}

function deletePhrase(db, kind, value) {
    db.run(`
        DELETE FROM Phrases
        WHERE kind = '${esc(kind)}' AND value = '${esc(value)}'
    `);
}

function phraseExists(db, kind, value) {
    return queryDb(db, `
        SELECT 1 FROM Phrases
        WHERE kind = '${esc(kind)}' AND value = '${esc(value)}'
        LIMIT 1
    `).length > 0;
}

/* ============================================================
 * Скачать обновлённый history.db — только для админа (через консоль)
 * ============================================================ */
function downloadDatabase(db) {
    const data = db.export();
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'history.db';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
