import express from 'express';
import cors from 'cors';
import schedule from 'node-schedule';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { CollectorService } from './services/collector.js';
import { SubscriptionService } from './services/subscription.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    const clientPath = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientPath));
}

// Routes
app.get('/api/domains', async (req, res) => {
    try {
        const domains = await CollectorService.getDomains();
        res.json({ success: true, count: domains.length, data: domains });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/refresh', async (req, res) => {
    try {
        const domains = await CollectorService.updateDomains();
        res.json({ success: true, count: domains.length });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/subscribe', async (req, res) => {
    try {
        const { url, max, max_latency, include, exclude } = req.query;
        if (!url) return res.status(400).send('Missing url param');

        const result = await SubscriptionService.generate(
            url as string,
            parseInt(max as string) || 10,
            {
                maxLatency: max_latency ? parseInt(max_latency as string) : undefined,
                include: include as string,
                exclude: exclude as string
            }
        );

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(result);
    } catch (e: any) {
        res.status(500).send(e.message);
    }
});

app.get('/api/network-status', async (req, res) => {
    const measureLatency = async (url: string) => {
        const start = Date.now();
        try {
            await axios.get(url, { timeout: 5000, validateStatus: () => true });
            return Date.now() - start;
        } catch {
            return -1;
        }
    };

    const getIp = async (url: string, type: 'json' | 'text' | 'sohu' = 'json') => {
        try {
            const { data } = await axios.get(url, {
                timeout: 5000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            if (type === 'sohu') {
                // var returnCitySN = {"cip": "1.2.3.4", "cid": "110000", "cname": "北京市"};
                const match = data.match(/"cip":\s*"([^"]+)"/);
                const locMatch = data.match(/"cname":\s*"([^"]+)"/);
                return {
                    ip: match ? match[1] : 'Parse Error',
                    location: locMatch ? locMatch[1] : 'Unknown'
                };
            }

            if (type === 'text') {
                // For aws or similar that return just IP
                return { ip: data.trim(), location: 'Unknown' };
            }

            if (typeof data === 'string' && data.includes('ip=')) {
                const ipLine = data.split('\n').find((l: string) => l.startsWith('ip='));
                const locLine = data.split('\n').find((l: string) => l.startsWith('loc='));
                return { ip: ipLine?.split('=')[1] || 'Error', location: locLine?.split('=')[1] || 'CF node' };
            }
            if (data.status === 'success' && data.query) {
                // ip-api.com
                return { ip: data.query, location: `${data.country} ${data.isp}` };
            }
            if (data.ip || data.address) {
                const loc = [data.country, data.region, data.isp].filter(Boolean).join(' ');
                return { ip: data.ip || data.address, location: loc };
            }
            return { ip: typeof data === 'string' ? data.trim() : 'Format Error', location: 'Unknown' };
        } catch (e) {
            return { ip: 'Error', location: 'Failed' };
        }
    };

    const [domesticIp, abroadIp, cfIp, leakIp, twitterIp, ipApi, awsIp] = await Promise.all([
        getIp('https://api.ip.sb/ip', 'text'), // Changed from sohu to ip.sb
        getIp('https://api.ipify.org?format=json'),
        getIp('https://www.cloudflare.com/cdn-cgi/trace'),
        getIp('https://ifconfig.co/json'),
        getIp('https://api.myip.com'),
        getIp('http://ip-api.com/json'),
        getIp('https://checkip.amazonaws.com', 'text')
    ]);

    const sites = [
        { name: '字节跳动', url: 'https://www.douyin.com' },
        { name: 'Bilibili', url: 'https://www.bilibili.com' },
        { name: '微信', url: 'https://www.qq.com' }, // Changed to qq.com which is more responsive
        { name: '淘宝', url: 'https://www.taobao.com' },
        { name: 'GitHub', url: 'https://github.com' },
        { name: 'Google', url: 'https://www.google.com' },
        { name: 'Cloudflare', url: 'https://www.cloudflare.com' },
        { name: 'YouTube', url: 'https://www.youtube.com' },
    ];

    const latencies = await Promise.all(sites.map(async (s) => {
        return { name: s.name, latency: await measureLatency(s.url) };
    }));

    res.json({
        ip: {
            domestic: domesticIp,
            abroad: abroadIp,
            cloudflare: cfIp,
            leak: leakIp,
            twitter: twitterIp,
            ipApi: ipApi,
            aws: awsIp
        },
        latency: latencies
    });
});

// Auto-refresh every 20 minutes
schedule.scheduleJob('*/20 * * * *', () => {
    console.log('⏰ Running scheduled domain update (every 20m)...');
    CollectorService.updateDomains();
});

// Initial load
CollectorService.getDomains().then(d => {
    if (d.length === 0) CollectorService.updateDomains();
});

// SPA fallback - must be last
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Access at: http://localhost:${PORT}`);
});
