
import { MerchantEnricher } from '../src/modules/transactions/services/enrichment/MerchantEnricher';

// Test ZOMATOLIMITED
const test = async () => {
    console.log("Debugging ZOMATOLIMITED Enrichment...");
    const raw = "ZOMATOLIMITED";

    // Simulate what pipeline does: pass string
    const enriched = await MerchantEnricher.enrich(raw);

    console.log(`Input: "${raw}"`);
    console.log(`Enriched: "${enriched.canonicalName}" [${enriched.category}]`);
    console.log(`Confidence: ${enriched.confidence}`);
    console.log(`Match Type: ${enriched.matchType}`);
    console.log(`Is Merchant: ${enriched.isMerchant}`);

    if (enriched.confidence < 0.8) {
        console.log("FAIL: Confidence too low.");
    } else {
        console.log("SUCCESS: Enriched correctly.");
    }
};

test().then(() => process.exit(0));
