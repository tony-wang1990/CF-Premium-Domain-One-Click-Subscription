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

    // Domains table
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

    // ISP Speed History table - stores 24h data
    await db.exec(`
        CREATE TABLE IF NOT EXISTS isp_speed_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            ct_latency INTEGER,
            ct_loss REAL,
            cm_latency INTEGER,
            cm_loss REAL,
            cu_latency INTEGER,
            cu_loss REAL
        )
    `);

    // Create index for faster queries
    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_isp_speed_domain_time 
        ON isp_speed_history(domain, timestamp)
    `);

    return db;
}
