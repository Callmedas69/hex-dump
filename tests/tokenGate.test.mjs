import test from 'node:test'; import assert from 'node:assert/strict';
test('policy rejects invalid numeric configuration and supports explicit development profiles', async () => {
  const { productionPolicy, developmentPolicy, hasTokenAccess } = await import('../lib/tokenGate.ts');
  const valid = { NEXT_PUBLIC_MEME_TOKEN_ADDRESS: '0x0000000000000000000000000000000000000001', NEXT_PUBLIC_MEME_TOKEN_CHAIN_ID: '4663' };
  for (const bad of [
    { NEXT_PUBLIC_MEME_TOKEN_CHAIN_ID: 'abc' },
    { NEXT_PUBLIC_MEME_TOKEN_CHAIN_ID: '-1' },
    { NEXT_PUBLIC_MEME_TOKEN_CHAIN_ID: '1' },
    { NEXT_PUBLIC_MEME_TOKEN_CHAIN_ID: '11155111' },
    { NEXT_PUBLIC_MEME_TOKEN_CHAIN_ID: '46630' },
    { NEXT_PUBLIC_MEME_TOKEN_DECIMALS: '256' },
    { NEXT_PUBLIC_MEME_TOKEN_DECIMALS: '1.5' },
    { NEXT_PUBLIC_MEME_TOKEN_MIN_RAW: '-1' },
    { NEXT_PUBLIC_MEME_TOKEN_MIN_RAW: '1.5' },
  ]) assert.equal(productionPolicy({ ...valid, ...bad }), null);
  assert.equal(developmentPolicy().chainId, 4663);
  assert.equal(productionPolicy(valid).chainId, 4663);
  assert.equal(developmentPolicy('mainnet'), null);
  assert.equal(productionPolicy({}), null);
  assert.equal(productionPolicy({ ...valid, NEXT_PUBLIC_MEME_TOKEN_ADDRESS: 'bad' }), null);
  assert.equal(productionPolicy({ ...valid, NEXT_PUBLIC_MEME_TOKEN_MIN_RAW: '2' }).minimumRawBalance, 2n);
  assert.equal(hasTokenAccess(0n, 0n), false);
  assert.equal(hasTokenAccess(1n, 1n), true);
  assert.equal(hasTokenAccess(1n, 2n), false);
  assert.equal(developmentPolicy().decimals, 6);
  assert.equal(developmentPolicy().symbol, 'USDG');
  assert.equal(developmentPolicy('unknown'), null);
  assert.equal(hasTokenAccess(undefined, 0n), false);
});
test('Robinhood USDG policy and inclusive threshold', async()=>{ const {hasTokenAccess,developmentPolicy}=await import('../lib/tokenGate.ts'); const p=developmentPolicy('robinhood-mainnet'); assert.equal(p.chainId,4663); assert.equal(p.address.toLowerCase(),'0x5fc5360d0400a0fd4f2af552add042d716f1d168'); assert.equal(p.minimumRawBalance,10000n); assert.equal(hasTokenAccess(9999n,10000n),false); assert.equal(hasTokenAccess(10000n,10000n),true); assert.equal(hasTokenAccess(10001n,10000n),true); assert.equal(developmentPolicy('sepolia'),null); });
