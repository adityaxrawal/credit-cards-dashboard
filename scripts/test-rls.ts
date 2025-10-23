/* eslint-disable @typescript-eslint/no-explicit-any */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createSigner } from 'fast-jwt';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET!;

  if (!url || !anon || !service || !jwtSecret) {
    throw new Error('Missing Supabase env variables. Ensure .env.local is configured.');
  }

  const admin = createSupabaseClient(url, service);

  // Create two test users via Admin API (ensures auth.users + profiles)
  let userA: string;
  let userB: string;

  const { data: createdA, error: createErrA } = await (admin as any).auth.admin.createUser({
    email: 'usera@test.local',
    password: 'Test1234!',
    email_confirm: true,
    user_metadata: { name: 'User A' },
  });
  if (createErrA) {
    const { data: profA, error: profErrA } = await admin
      .from('profiles')
      .select('id')
      .eq('email', 'usera@test.local')
      .single();
    if (profErrA) throw profErrA;
    userA = profA!.id;
  } else {
    userA = createdA.user.id;
  }

  const { data: createdB, error: createErrB } = await (admin as any).auth.admin.createUser({
    email: 'userb@test.local',
    password: 'Test1234!',
    email_confirm: true,
    user_metadata: { name: 'User B' },
  });
  if (createErrB) {
    const { data: profB, error: profErrB } = await admin
      .from('profiles')
      .select('id')
      .eq('email', 'userb@test.local')
      .single();
    if (profErrB) throw profErrB;
    userB = profB!.id;
  } else {
    userB = createdB.user.id;
  }

  console.log('Users ready:', { userA, userB });

  console.log('Seeding profiles for:', { userA, userB });

  // Seed profiles
  // const { error: profErr } = await admin.from('profiles').insert([
  //   { id: userA, email: 'usera@test.local', full_name: 'User A' },
  //   { id: userB, email: 'userb@test.local', full_name: 'User B' },
  // ]);
  // if (profErr) throw profErr;

  // Seed credit cards for each user
  const { error: cardErr } = await admin.from('credit_cards').upsert([
    {
      user_id: userA,
      bank_name: 'Bank A',
      card_last_4: '1111',
      card_holder_name: 'User A',
      card_type: 'Visa',
      statement_day: 15,
      sender_pattern: 'bank-a.com'
    },
    {
      user_id: userB,
      bank_name: 'Bank B',
      card_last_4: '2222',
      card_holder_name: 'User B',
      card_type: 'Mastercard',
      statement_day: 5,
      sender_pattern: 'bank-b.com'
    },
  ], { onConflict: 'user_id,card_last_4' });
  if (cardErr) throw cardErr;

  // Seed one current transaction for each user
  // Fetch card IDs for users
  const { data: cardARec, error: cardAGetErr } = await admin
    .from('credit_cards')
    .select('id, card_last_4')
    .eq('user_id', userA)
    .eq('card_last_4', '1111')
    .maybeSingle();
  if (cardAGetErr) throw cardAGetErr;
  const { data: cardBRec, error: cardBGetErr } = await admin
    .from('credit_cards')
    .select('id, card_last_4')
    .eq('user_id', userB)
    .eq('card_last_4', '2222')
    .maybeSingle();
  if (cardBGetErr) throw cardBGetErr;

  // Seed one current transaction for each user with valid schema
  const { error: txErr } = await admin.from('current_transactions').insert([
    {
      user_id: userA,
      card_id: cardARec?.id,
      amount: 25.5,
      description: 'Coffee Shop purchase',
      merchant: 'Coffee Shop',
      category: 'Dining',
      transaction_date: new Date().toISOString()
    },
    {
      user_id: userB,
      card_id: cardBRec?.id,
      amount: 100.0,
      description: 'Electronics store purchase',
      merchant: 'Electronics',
      category: 'Shopping',
      transaction_date: new Date().toISOString()
    }
  ]);
  if (txErr) throw txErr;

  // Mint JWTs for user A and user B
  const sign = createSigner({ key: jwtSecret, algorithm: 'HS256' });
  const now = Math.floor(Date.now() / 1000);
  const tokenA = sign({
    sub: userA,
    email: 'usera@test.local',
    role: 'authenticated',
    iat: now,
    exp: now + 60 * 60,
  });
  const tokenB = sign({
    sub: userB,
    email: 'userb@test.local',
    role: 'authenticated',
    iat: now,
    exp: now + 60 * 60,
  });

  // Create user-scoped clients and set auth
  const userAClient = createSupabaseClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${tokenA}` } },
  });

  const userBClient = createSupabaseClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${tokenB}` } },
  });

  console.log('\nTesting RLS: SELECT should only return own rows');
  const { data: cardsA, error: selErrA } = await userAClient
    .from('credit_cards')
    .select('*');
  if (selErrA) throw selErrA;
  console.log('User A sees cards:', cardsA?.map(c => c.card_last_4));

  const { data: cardsB, error: selErrB } = await userBClient
    .from('credit_cards')
    .select('*');
  if (selErrB) throw selErrB;
  console.log('User B sees cards:', cardsB?.map(c => c.card_last_4));

  console.log('\nTesting RLS: INSERT should be blocked when user_id != auth.uid()');
  const { error: insErr } = await userAClient.from('credit_cards').insert({
    user_id: userB,
    bank_name: 'Bank B',
    card_last_4: '3333',
    card_holder_name: 'User B',
    card_type: 'Visa',
    statement_day: 10,
  });
  console.log('Insert cross-user error expected:', !!insErr, insErr?.message);

  console.log('\nTesting RLS: email_patterns is publicly readable');
  const { data: patterns, error: patErr } = await userAClient
    .from('email_patterns')
    .select('*')
    .limit(3);
  if (patErr) throw patErr;
  console.log('Email patterns sample:', patterns);

  console.log('\nTesting Admin: service role can count all rows');
  const { count: countCards } = await admin.from('credit_cards').select('*', { count: 'exact', head: true });
  const { count: countTx } = await admin.from('current_transactions').select('*', { count: 'exact', head: true });
  console.log('Admin counts:', { countCards, countTx });

  console.log('\n✅ RLS tests completed');
}

main().catch((err) => {
  console.error('RLS test failed:', err);
  process.exit(1);
});