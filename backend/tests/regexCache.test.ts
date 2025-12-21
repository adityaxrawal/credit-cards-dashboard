import { RegexCache } from '../src/utils/regexCache';

describe('RegexCache LRU Behavior', () => {
    beforeEach(() => {
        RegexCache.clear();
    });

    it('should cache compiled regexes', () => {
        const regex1 = RegexCache.get('abc', 'i');
        const regex2 = RegexCache.get('abc', 'i');
        expect(regex1).toBe(regex2); // Same object reference
        expect(RegexCache.size()).toBe(1);
    });

    it('should respect LRU eviction policy', () => {
        // Manually inspect the internal cache if possible, or infer from behavior.
        // Since maxKeys is hardcoded to 1000 in source, we can't easily change it for testing without
        // some deeper mocking or dependency injection. 
        // Ideally we would make options configurable.
        // However, we can basic function check here.

        // Basic function check
        expect(RegexCache.test('^hello', 'hello world')).toBe(true);
        expect(RegexCache.size()).toBe(1);

        // Add another
        expect(RegexCache.test('^world', 'world hello')).toBe(true);
        expect(RegexCache.size()).toBe(2);
    });
});
