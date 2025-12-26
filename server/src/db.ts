import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.sqlite');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbPromise: Promise<Database<sqlite3.Database, sqlite3.Statement>> | null = null;

export async function getDb() {
    if (dbPromise) return dbPromise;

    dbPromise = open({
        filename: DB_FILE,
        driver: sqlite3.Database
    });

    const db = await dbPromise;
    await db.exec(`
        CREATE TABLE IF NOT EXISTS domains (
            id TEXT PRIMARY KEY,
            domain TEXT UNIQUE NOT NULL,
            type TEXT,
            description TEXT,
            updatedAt TEXT NOT NULL,
            speed INTEGER
        )
    `);

    return db;
}
