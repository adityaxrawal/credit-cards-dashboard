/**
 * Tests for Cache Key Utilities
 */

import {
  cacheKey,
  normalizeModuleName,
  sessionKey,
  userModuleKey,
  userModulePattern,
  modulePattern,
} from "./key-utils";

describe("Cache Key Utilities", () => {
  describe("normalizeModuleName", () => {
    it("should convert to lowercase", () => {
      expect(normalizeModuleName("Analytics")).toBe("analytics");
      expect(normalizeModuleName("GMAIL")).toBe("gmail");
    });

    it("should convert underscores to hyphens", () => {
      expect(normalizeModuleName("ai_insights")).toBe("ai-insights");
      expect(normalizeModuleName("gmail_sync")).toBe("gmail-sync");
    });

    it("should convert dots to hyphens", () => {
      expect(normalizeModuleName("gmail.sync")).toBe("gmail-sync");
      expect(normalizeModuleName("api.gateway")).toBe("api-gateway");
    });

    it("should convert spaces to hyphens", () => {
      expect(normalizeModuleName("AI Insights")).toBe("ai-insights");
      expect(normalizeModuleName("Credit Cards")).toBe("credit-cards");
    });

    it("should convert camelCase to kebab-case", () => {
      expect(normalizeModuleName("aiInsights")).toBe("ai-insights");
      expect(normalizeModuleName("gmailSync")).toBe("gmail-sync");
      expect(normalizeModuleName("creditCards")).toBe("credit-cards");
    });

    it("should handle mixed formats", () => {
      expect(normalizeModuleName("AI_Insights.Service")).toBe("ai-insights-service");
      expect(normalizeModuleName("gmailSyncService")).toBe("gmail-sync-service");
    });

    it("should handle already normalized names", () => {
      expect(normalizeModuleName("analytics")).toBe("analytics");
      expect(normalizeModuleName("gmail-sync")).toBe("gmail-sync");
    });
  });

  describe("cacheKey", () => {
    it("should generate basic cache key", () => {
      expect(cacheKey("analytics", "123", "metrics")).toBe("cache:analytics:123:metrics");
    });

    it("should handle numeric userId", () => {
      expect(cacheKey("transactions", 456, "list")).toBe("cache:transactions:456:list");
    });

    it("should normalize module name", () => {
      expect(cacheKey("AI_Insights", "123", "recommendations")).toBe(
        "cache:ai-insights:123:recommendations"
      );

      expect(cacheKey("gmailSync", "456", "status")).toBe("cache:gmail-sync:456:status");
    });

    it("should append additional parts", () => {
      expect(cacheKey("transactions", "123", "list", "2024-01", "card-1")).toBe(
        "cache:transactions:123:list:2024-01:card-1"
      );

      expect(cacheKey("analytics", "789", "metrics", "monthly", 2024, 1)).toBe(
        "cache:analytics:789:metrics:monthly:2024:1"
      );
    });

    it("should handle string and numeric parts", () => {
      expect(cacheKey("budgets", 123, "forecast", 2024, "Q1")).toBe(
        "cache:budgets:123:forecast:2024:Q1"
      );
    });

    it("should work without additional parts", () => {
      expect(cacheKey("cards", "123", "data")).toBe("cache:cards:123:data");
    });

    it("should handle empty string parts", () => {
      expect(cacheKey("module", "123", "resource", "", "part")).toBe(
        "cache:module:123:resource::part"
      );
    });
  });

  describe("sessionKey", () => {
    it("should generate session key with string userId", () => {
      expect(sessionKey("user-123")).toBe("session:user-123");
    });

    it("should generate session key with numeric userId", () => {
      expect(sessionKey(456)).toBe("session:456");
    });
  });

  describe("userModuleKey", () => {
    it("should generate user module key", () => {
      expect(userModuleKey("analytics", "123")).toBe("cache:analytics:123:data");
    });

    it("should normalize module name", () => {
      expect(userModuleKey("AI_Insights", "456")).toBe("cache:ai-insights:456:data");
    });
  });

  describe("userModulePattern", () => {
    it("should generate user module pattern", () => {
      expect(userModulePattern("analytics", "123")).toBe("cache:analytics:123:*");
    });

    it("should normalize module name in pattern", () => {
      expect(userModulePattern("AI_Insights", "456")).toBe("cache:ai-insights:456:*");
    });
  });

  describe("modulePattern", () => {
    it("should generate module pattern", () => {
      expect(modulePattern("analytics")).toBe("cache:analytics:*");
    });

    it("should normalize module name in pattern", () => {
      expect(modulePattern("AI_Insights")).toBe("cache:ai-insights:*");
      expect(modulePattern("gmailSync")).toBe("cache:gmail-sync:*");
    });
  });

  describe("Edge Cases", () => {
    it("should handle UUID userId", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(cacheKey("analytics", uuid, "metrics")).toBe(`cache:analytics:${uuid}:metrics`);
    });

    it("should handle special characters in resource", () => {
      expect(cacheKey("module", "123", "data:v2")).toBe("cache:module:123:data:v2");
    });

    it("should handle very long keys", () => {
      const longParts = Array(10)
        .fill("part")
        .map((p, i) => `${p}${i}`);
      const key = cacheKey("module", "123", "resource", ...longParts);
      expect(key).toContain("cache:module:123:resource");
      expect(key.split(":").length).toBe(4 + longParts.length);
    });

    it("should be consistent for same inputs", () => {
      const key1 = cacheKey("analytics", "123", "metrics", "daily");
      const key2 = cacheKey("analytics", "123", "metrics", "daily");
      expect(key1).toBe(key2);
    });
  });
});
