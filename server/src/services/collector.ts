import { Buffer } from 'node:buffer';
import axios from 'axios';
import { CfDomain } from '../types.js';
import { getDb } from '../db.js';
import { measureTcpLatency } from '../utils/pinger.js';

export class CollectorService {
    static async getDomains(): Promise<CfDomain[]> {
        const db = await getDb();
        return await db.all<CfDomain[]>('SELECT * FROM domains ORDER BY speed ASC, updatedAt DESC');
    }

    static async updateDomains(): Promise<CfDomain[]> {
        console.log('🔄 Starting domain update...');
        const domains: CfDomain[] = [];

        try {
            // Source 1: cf.090227.xyz
            const newDomains = await this.scrapeCF090227();
            domains.push(...newDomains);

            if (domains.length === 0) {
                console.warn('⚠️ No domains collected, skipping DB update.');
                return await this.getDomains();
            }

            // Deduplicate
            const unique = new Map<string, CfDomain>();
            domains.forEach(d => unique.set(d.domain, d));
            let finalList = Array.from(unique.values());

            // ⚡ Speed Test Phase
            console.log(`⚡ Testing latency for ${finalList.length} domains...`);
            finalList = await this.batchTestSpeed(finalList);

            // Save to DB
            const db = await getDb();
            await db.run('BEGIN TRANSACTION');

            // Optional: Clear old domains if you want a fresh start, 
            // or just upsert. Let's upsert to keep history/valid ones if we had a mechanism to check validity.
            // For now, let's keep it simple: replace all or upset?
            // The JSON logic was "rewrite file", so essentially "replace all" or "merge then write".
            // The scraping logic gets a fresh list. If a domain is no longer in scrape, should we keep it?
            // The original logic: `domains` (accumulated from scrape) -> dedupe -> write.
            // So it only kept what was scraped NOW + static list.
            // To mimic original behavior completely:
            await db.run('DELETE FROM domains');

            const stmt = await db.prepare('INSERT INTO domains (id, domain, type, description, updatedAt, speed) VALUES (?, ?, ?, ?, ?, ?)');

            for (const d of finalList) {
                await stmt.run(d.id, d.domain, d.type, d.description, d.updatedAt, d.speed || 9999);
            }

            await stmt.finalize();
            await db.run('COMMIT');

            console.log(`✅ Updated ${finalList.length} domains with speed data.`);
            return finalList;
        } catch (error) {
            console.error('❌ Update failed:', error);
            const db = await getDb();
            await db.run('ROLLBACK').catch(() => { }); // safely ignore if no transaction
            return await this.getDomains();
        }
    }

    private static async batchTestSpeed(domains: CfDomain[], concurrency: number = 10): Promise<CfDomain[]> {
        const results: CfDomain[] = [];
        for (let i = 0; i < domains.length; i += concurrency) {
            const batch = domains.slice(i, i + concurrency);
            const promises = batch.map(async (d) => {
                const latency = await measureTcpLatency(d.domain);
                return { ...d, speed: latency === -1 ? 9999 : latency };
            });
            const processed = await Promise.all(promises);
            results.push(...processed);
        }
        // pre-sort by speed for convenience
        return results.sort((a, b) => (a.speed || 9999) - (b.speed || 9999));
    }

    private static async scrapeCF090227(): Promise<CfDomain[]> {
        const domains: CfDomain[] = [];

        // 1. Static Famous List (Fallback/Guaranteed)
        const famousDomains: Array<{ d: string, desc: string, type: 'third-party' }> = [
            { d: 'cf.877774.xyz', desc: '秋名山优选', type: 'third-party' },
            { d: 'bestcf.030101.xyz', desc: 'Mingyu优选', type: 'third-party' },
            { d: 'saas.sin.fan', desc: 'MIYU优选', type: 'third-party' },
            { d: 'cf.tencentapp.cn', desc: '隐藏大佬维护', type: 'third-party' },
            { d: 'cloudflare.182682.xyz', desc: 'WeTest.Vip', type: 'third-party' },
            { d: 'cloudflare-dl.byoip.top', desc: 'NB优选', type: 'third-party' },
            { d: 'cfip.cfcdn.vip', desc: 'CFCDNVIP', type: 'third-party' }
        ];

        famousDomains.forEach(item => {
            domains.push({
                id: Buffer.from(item.d).toString('base64'),
                domain: item.d,
                type: item.type,
                description: item.desc,
                updatedAt: new Date().toISOString()
            });
        });

        try {
            const { data } = await axios.get('https://cf.090227.xyz/');

            // Regex to find domain/ip and optional #comment
            // Matches: example.com, 1.1.1.1, example.com#comment
            const regexGlobal = /([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(?:\d{1,3}\.){3}\d{1,3})(?:#([\p{L}\p{N}_-]+))?/gu;

            const lines = data.split('\n');
            let currentType: 'official' | 'third-party' | 'cm' = 'official'; // Default start

            for (const line of lines) {
                const trimmed = line.trim();

                // Content Type Detection
                if (trimmed.includes('官方优选')) currentType = 'official';
                else if (trimmed.includes('CM优选') || trimmed.includes('移动')) currentType = 'cm';
                else if (trimmed.includes('第三方') || trimmed.includes('更多优选')) currentType = 'third-party';

                // Skip extremely short lines or markdown headers
                if (trimmed.length < 4 || trimmed.startsWith('#')) continue;

                // Find all matches in the line (support space separated domains)
                const matches = [...trimmed.matchAll(regexGlobal)];

                for (const match of matches) {
                    let domain = match[1];
                    // Clean up leading dots which might be captured by regex
                    domain = domain.replace(/^\.+/, '');

                    // If comment exists in scrape, use it, otherwise use previously defined description or generic
                    const desc = match[2] || (currentType === 'official' ? '官方优选' : '社区优选');

                    // Filter noise and common file extensions
                    // 1. Exact match ignore list
                    if (['tcping', 'http', 'https', 'com', 'cn', 'xyz'].includes(domain)) continue;

                    // 2. File extension ignore list (css, js, png, etc.)
                    if (/\.(png|jpg|jpeg|gif|css|js|html|htm|zip|rar|ico|svg|xml|json|txt|md)$/i.test(domain)) continue;

                    // Avoid duplicates from static list (simple check)
                    if (domains.some(d => d.domain === domain)) continue;

                    domains.push({
                        id: Buffer.from(domain).toString('base64'),
                        domain,
                        type: currentType,
                        description: desc,
                        updatedAt: new Date().toISOString()
                    });
                }
            }

            return domains;
        } catch (error) {
            console.error('Failed to scrape cf.090227.xyz:', error);
            return domains; // Return at least the static ones
        }
    }
}
