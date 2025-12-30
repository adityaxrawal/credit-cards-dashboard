export const queryKeys = {
    transactions: {
        all: ["transactions"] as const,
        list: (filters: Record<string, unknown>) => ["transactions", filters] as const,
        detail: (id: string) => ["transactions", id] as const,
    },
    cards: {
        all: ["cards"] as const,
        detail: (id: string) => ["cards", id] as const,
    },
    analytics: {
        all: ["analytics"] as const,
        overview: ["analytics", "overview"] as const,
        trends: (range: string) => ["analytics", "trends", range] as const,
        categories: (month: number, year: number) => ["analytics", "categories", month, year] as const,
        merchants: (month: number, year: number) => ["analytics", "merchants", month, year] as const,
    },
    bills: {
        upcoming: ["bills", "upcoming"] as const,
        upcomingReminders: ["upcoming-reminders"] as const, // Maintaining existing key for compatibility during migration, eventually should be standardized to ["bills", "upcoming"] or similar
    },
    budget: {
        current: ["budget", "current"] as const,
    },
    rewards: {
        summary: ["rewards", "summary"] as const,
    },
    recurring: {
        all: ["recurring"] as const,
        stats: ["recurring", "stats"] as const,
    },
};
