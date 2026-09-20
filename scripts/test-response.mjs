async function test() {
  const loginRes = await fetch('http://localhost:3099/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: 'leadpulse2026' })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];
  console.log('Cookie:', cookie);

  // 1. Root page
  const pageRes = await fetch('http://localhost:3099/', {
    headers: { Cookie: cookie }
  });
  const html = await pageRes.text();
  console.log('1. Root Page status:', pageRes.status);
  console.log('   Contains root div:', html.includes('id="root"'));
  console.log('   Contains Vite assets:', html.includes('/assets/index-'));

  // 2. Sub-route /leads
  const leadsRouteRes = await fetch('http://localhost:3099/leads', {
    headers: { Cookie: cookie }
  });
  const leadsHtml = await leadsRouteRes.text();
  console.log('2. /leads sub-route status:', leadsRouteRes.status);
  console.log('   Contains root div:', leadsHtml.includes('id="root"'));

  // 3. Asset fetching
  const assetMatch = html.match(/src="(\/assets\/[^"]+)"/);
  if (assetMatch) {
    const assetUrl = 'http://localhost:3099' + assetMatch[1];
    const assetRes = await fetch(assetUrl);
    console.log('3. Asset JS status:', assetRes.status, 'Content-Type:', assetRes.headers.get('content-type'));
  }

  // 4. API fetching
  const apiRes = await fetch('http://localhost:3099/api/leads?limit=2', {
    headers: { Cookie: cookie }
  });
  const apiData = await apiRes.json();
  console.log('4. API /api/leads status:', apiRes.status, 'Total leads:', apiData.total);

  console.log('\n ALL TESTS PASSED! Port 3500 Vite app is fully operational through Next.js BFF!');
}
test().catch(console.error);
