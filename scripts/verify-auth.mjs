// Quick script to verify passcode gate on running Next.js server

async function run() {
  const baseUrl = 'http://localhost:3099';
  console.log('Testing Passcode Gate on:', baseUrl);

  // 1. Unauthenticated page request -> should redirect to /login
  const resPage = await fetch(`${baseUrl}/`, { redirect: 'manual' });
  console.log('1. Page without auth status:', resPage.status);
  const location = resPage.headers.get('location');
  console.log('   Redirect location:', location);
  if (!location || !location.includes('/login')) {
    throw new Error('Expected redirect to /login, got: ' + location);
  }

  // 2. Unauthenticated API request -> should return 401
  const resApi = await fetch(`${baseUrl}/api/leads`);
  console.log('2. API without auth status:', resApi.status);
  const apiJson = await resApi.json();
  console.log('   API response:', apiJson);
  if (resApi.status !== 401) {
    throw new Error('Expected 401 Unauthorized for API, got: ' + resApi.status);
  }

  // 3. Login with invalid passcode -> should fail
  const resWrong = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: 'wrong_password_123' }),
  });
  console.log('3. Wrong passcode status:', resWrong.status);
  if (resWrong.status !== 401) {
    throw new Error('Expected 401 for wrong passcode, got: ' + resWrong.status);
  }

  // 4. Login with correct passcode -> should succeed and return cookie
  const resLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: 'leadpulse2026' }),
  });
  console.log('4. Correct passcode status:', resLogin.status);
  const cookie = resLogin.headers.get('set-cookie');
  console.log('   Received cookie:', cookie ? cookie.split(';')[0] : 'None');
  if (!cookie || !cookie.includes('leadpulse_session=')) {
    throw new Error('Cookie leadpulse_session was not set!');
  }

  const cookieVal = cookie.split(';')[0];

  // 5. Authenticated API request with session cookie -> should succeed (200)
  const resAuthApi = await fetch(`${baseUrl}/api/leads?limit=3`, {
    headers: { Cookie: cookieVal },
  });
  console.log('5. Authenticated API status:', resAuthApi.status);
  const leadsData = await resAuthApi.json();
  console.log('   Leads total returned:', leadsData.total ?? leadsData.leads?.length ?? 'OK');
  if (resAuthApi.status !== 200) {
    throw new Error('Expected 200 OK for authenticated API call, got: ' + resAuthApi.status);
  }

  // 6. Authenticated Page request with session cookie -> should return 200
  const resAuthPage = await fetch(`${baseUrl}/`, {
    headers: { Cookie: cookieVal },
    redirect: 'manual',
  });
  console.log('6. Authenticated Page status:', resAuthPage.status);
  if (resAuthPage.status !== 200) {
    throw new Error('Expected 200 OK for authenticated page, got: ' + resAuthPage.status);
  }

  console.log('\n SUCCESS: Passcode Gate and Session Cookie are 100% working!');
}

run().catch((err) => {
  console.error('\n❌ Verification failed:', err.message);
  process.exit(1);
});
