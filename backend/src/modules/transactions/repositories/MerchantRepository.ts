
import { query } from '../../../shared/database/db';

export interface MerchantEntity {
  id: string;
  name: string;
  default_category: string;
  logo_url?: string;
  website?: string;
  is_subscription_capable: boolean;
}

export interface AliasEntity {
  id: string;
  merchant_id: string;
  alias: string;
  match_type: string;
  confidence_penalty: string; // Decimal comes as string from PG usually
  merchant_name: string;
  default_category: string;
  logo_url?: string;
}

export class MerchantRepository {

  /**
   * Finds an exact alias match in the DB.
   */
  async findExactAlias(raw: string): Promise<AliasEntity | null> {
    const sql = `
      SELECT 
        ma.id,
        ma.merchant_id,
        ma.alias,
        ma.match_type,
        ma.confidence_penalty,
        m.name as merchant_name, 
        m.default_category,
        m.logo_url
      FROM merchant_aliases ma
      JOIN merchants m ON ma.merchant_id = m.id
      WHERE lower(ma.alias) = lower($1)
      LIMIT 1;
    `;

    const res = await query(sql, [raw.trim()]);
    return res.rows[0] || null;
  }

  /**
   * Finds potential fuzzy matches using LIKE queries or specific fuzzy patterns.
   * For now, we fetch 'fuzzy' type aliases and do loose logic if needed, 
   * or rely on the caller to handle fuzzy logic against a cached set (future optimization).
   * 
   * Current Strategy: 
   * Search for aliases that are substrings of the input OR where input is substring of alias
   * This is expensive on large DBs but fine for <10k merchants.
   */
  async findPotentialMatches(raw: string): Promise<AliasEntity[]> {
    const normalized = raw.trim().toLowerCase();

    // Naive implementation: Fetch all 'fuzzy' aliases that share tokens? 
    // Or just fetch specific merchants if we had a trigram index.
    // Given Postgres + small scale, we can try ILIKE.

    const sql = `
      SELECT 
        ma.id,
        ma.merchant_id,
        ma.alias,
        ma.match_type,
        ma.confidence_penalty,
        m.name as merchant_name, 
        m.default_category,
        m.logo_url
      FROM merchant_aliases ma
      JOIN merchants m ON ma.merchant_id = m.id
      WHERE 
        ($1 ILIKE '%' || ma.alias || '%') 
      LIMIT 10;
    `;

    const res = await query(sql, [normalized]);
    return res.rows;
  }
}
