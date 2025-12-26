export interface CfDomain {
    id: string;
    domain: string;
    type: 'official' | 'third-party' | 'cm'; // CM = China Mobile optimized
    description: string;
    speed?: number; // Latency in ms
    updatedAt: string;
}

export interface CollectionSource {
    url: string;
    type: 'web-scrape' | 'text-list' | 'api';
    parser?: 'cf090227' | 'generic';
}
