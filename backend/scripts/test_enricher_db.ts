
import { MerchantEnricher } from '../src/modules/transactions/services/enrichment/MerchantEnricher';
import { ExtractionCandidate } from '../src/modules/transactions/services/extraction/MerchantExtractor';

const testEnricher = async () => {
    console.log("Testing Merchant Enricher with DB...");

    // 1. Exact Match (Seeded)
    const t1 = await MerchantEnricher.enrich({ rawName: 'Swiggy', confidence: 0.95, source: 'test' });
    console.log(`[TEST 1] Swiggy -> ${t1.canonicalName} (Conf: ${t1.confidence}, Match: ${t1.matchType})`);

    // 2. Fuzzy Match (Seeded alias/fuzzy)
    // "zomato ltd" should match "zomato"
    const t2 = await MerchantEnricher.enrich({ rawName: 'Zomato Ltd', confidence: 0.9, source: 'test' });
    console.log(`[TEST 2] Zomato Ltd -> ${t2.canonicalName} (Conf: ${t2.confidence}, Match: ${t2.matchType})`);

    // 3. Unknown
    const t3 = await MerchantEnricher.enrich({ rawName: 'Random Shop XYZ', confidence: 0.8, source: 'test' });
    console.log(`[TEST 3] Random Shop XYZ -> ${t3.canonicalName} (Conf: ${t3.confidence}, Match: ${t3.matchType})`);

    // 4. Legacy String Input
    const t4 = await MerchantEnricher.enrich("Uber Rides");
    console.log(`[TEST 4] (String) Uber Rides -> ${t4.canonicalName} (Conf: ${t4.confidence}, Match: ${t4.matchType})`);
};

testEnricher().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
