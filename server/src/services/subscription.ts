import { CfDomain } from '../types.js';
import { CollectorService } from './collector.js';
import axios from 'axios';

export class SubscriptionService {
    static async generate(
        sourceUrl: string,
        maxNodes: number = 10,
        options: { maxLatency?: number; include?: string; exclude?: string } = {}
    ): Promise<string> {
        // 1. Get Domains (sorted by speed)
        let domains = await CollectorService.getDomains();
        if (domains.length === 0) {
            domains = await CollectorService.updateDomains();
        }

        // Filter by Max Latency
        if (options.maxLatency) {
            domains = domains.filter(d => (d.speed || 9999) <= options.maxLatency!);
        }

        // Filter by Include/Exclude Regex
        if (options.include) {
            const re = new RegExp(options.include, 'i');
            domains = domains.filter(d => re.test(d.domain) || re.test(d.description || '') || re.test(d.type || ''));
        }
        if (options.exclude) {
            const re = new RegExp(options.exclude, 'i');
            domains = domains.filter(d => !re.test(d.domain) && !re.test(d.description || '') && !re.test(d.type || ''));
        }

        // Optimize: Pick from top 50 fastest domains (after filtering), then shuffle
        const candidates = domains.slice(0, 50);
        const selectedDomains = candidates
            .sort(() => 0.5 - Math.random())
            .slice(0, maxNodes);

        // 2. Fetch Source
        let sourceContent = '';
        if (sourceUrl.startsWith('http')) {
            try {
                const res = await axios.get(sourceUrl, {
                    headers: { 'User-Agent': 'v2rayN/6.33' },
                    timeout: 15000 // 15s timeout
                });
                sourceContent = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
            } catch (e) {
                // assume it's just a raw node list if fetch fails or it's not a URL
                console.warn('Fetch failed, using raw input');
                sourceContent = sourceUrl;
            }
        } else {
            sourceContent = sourceUrl;
        }

        // Decode if base64
        try {
            const decoded = Buffer.from(sourceContent, 'base64').toString('utf-8');
            if (decoded.includes('://')) sourceContent = decoded;
        } catch { }

        // 3. Parse and Optimize
        const nodes: string[] = [];
        const lines = sourceContent.split(/[\n\s]+/).filter(l => l.includes('://'));

        for (const line of lines) {
            // Only process standard protocols
            if (line.startsWith('vmess://')) {
                nodes.push(...this.processVmess(line, selectedDomains));
            } else if (line.startsWith('vless://')) {
                nodes.push(...this.processVless(line, selectedDomains));
            } else if (line.startsWith('trojan://')) {
                nodes.push(...this.processTrojan(line, selectedDomains));
            } else {
                // Allow pass-through for others? or ignore. 
                // Request says "optimize", so we probably ignore non-optimizable ones or just pass them through.
                // Let's pass through source for now.
                nodes.push(line);
            }
        }

        // 4. Encode
        return Buffer.from(nodes.join('\n')).toString('base64');
    }

    private static processVmess(link: string, domains: CfDomain[]): string[] {
        try {
            const b64 = link.replace('vmess://', '');
            const configStr = Buffer.from(b64, 'base64').toString('utf-8');
            const config = JSON.parse(configStr);

            return domains.map(d => {
                const newConfig = { ...config };

                // Preserve original host as SNI/Host
                if (!newConfig.sni && newConfig.add) newConfig.sni = newConfig.add;
                if (!newConfig.host && newConfig.add) newConfig.host = newConfig.add;

                // Replace Address
                newConfig.add = d.domain;
                newConfig.ps = `${config.ps} [CF-${d.description || d.type}]`;

                return 'vmess://' + Buffer.from(JSON.stringify(newConfig)).toString('base64');
            });
        } catch { return [link]; }
    }

    private static processVless(link: string, domains: CfDomain[]): string[] {
        // Simplified regex parser for VLESS
        // vless://uuid@host:port?params#name
        try {
            const url = new URL(link);
            return domains.map(d => {
                const newUrl = new URL(link);

                // Set SNI/Host from original hostname
                // Note: 'host' param is usually used in query
                const originalHost = url.hostname;
                if (!newUrl.searchParams.has('sni')) newUrl.searchParams.set('sni', originalHost);
                if (!newUrl.searchParams.has('host')) newUrl.searchParams.set('host', originalHost);

                newUrl.hostname = d.domain;
                newUrl.hash = `${decodeURIComponent(url.hash)} [CF-${d.description}]`;

                return newUrl.toString();
            });
        } catch { return [link]; }
    }

    private static processTrojan(link: string, domains: CfDomain[]): string[] {
        try {
            const url = new URL(link);
            return domains.map(d => {
                const newUrl = new URL(link);
                const originalHost = url.hostname;
                if (!newUrl.searchParams.has('sni')) newUrl.searchParams.set('sni', originalHost);
                if (!newUrl.searchParams.has('peer')) newUrl.searchParams.set('peer', originalHost); // some clients use peer

                newUrl.hostname = d.domain;
                newUrl.hash = `${decodeURIComponent(url.hash)} [CF-${d.description}]`;
                return newUrl.toString();
            });
        } catch { return [link]; }
    }
}
