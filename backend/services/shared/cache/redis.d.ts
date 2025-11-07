import Redis from "ioredis";
declare class UpstashRestRedis {
    private baseUrl;
    private token;
    constructor(baseUrl: string, token: string);
    private request;
    get(key: string): Promise<string | null>;
    set(key: string, value: any, ...args: any[]): Promise<string>;
    del(key: string): Promise<number>;
    exists(key: string): Promise<number>;
    ttl(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
}
declare class MockRedis {
    private store;
    get(key: string): Promise<string | null>;
    set(key: string, value: any, ...args: any[]): Promise<string>;
    del(key: string): Promise<number>;
    exists(key: string): Promise<number>;
    ttl(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
}
declare let redis: Redis | UpstashRestRedis | MockRedis;
export { redis };
export default redis;
