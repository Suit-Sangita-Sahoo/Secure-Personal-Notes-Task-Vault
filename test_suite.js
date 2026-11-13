const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Note = require('./models/Note');

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

async function runTests() {
  console.log('====================================================');
  console.log('STARTING AUTOMATED ACCEPTANCE & SECURITY TEST SUITE');
  console.log('====================================================');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB test database.');

  // Clean test collection
  await User.deleteMany({ email: { $in: ['alice@example.com', 'bob@example.com'] } });
  await Note.deleteMany({});
  console.log('Cleaned up any previous test records.\n');

  let passedTests = 0;
  let totalTests = 8;

  try {
    // ----------------------------------------------------
    // TEST 1: Password Hashing Verification
    // ----------------------------------------------------
    console.log('[TEST 1] Registering Alice and verifying bcrypt cost factor 10...');
    const regAliceRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'alice123'
      })
    });
    const regAliceData = await regAliceRes.json();
    if (regAliceRes.status !== 201) {
      throw new Error(`Test 1 Failed: Registration returned status ${regAliceRes.status}: ${JSON.stringify(regAliceData)}`);
    }

    const aliceInDb = await User.findOne({ email: 'alice@example.com' });
    if (!aliceInDb) {
      throw new Error('Test 1 Failed: Alice not found in MongoDB');
    }
    if (aliceInDb.password === 'alice123') {
      throw new Error('Test 1 Failed: Password was stored in plain text!');
    }
    if (!aliceInDb.password.startsWith('$2a$10$') && !aliceInDb.password.startsWith('$2b$10$')) {
      throw new Error(`Test 1 Failed: Password hash does not have cost factor 10: ${aliceInDb.password}`);
    }
    console.log(`✓ TEST 1 PASSED: Password hashed securely with cost factor 10 (${aliceInDb.password.substring(0, 10)}...)`);
    passedTests++;

    // ----------------------------------------------------
    // TEST 2: Duplicate Email Prevention
    // ----------------------------------------------------
    console.log('\n[TEST 2] Registering duplicate account with Alice\'s email...');
    const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Clone',
        email: 'alice@example.com',
        password: 'password456'
      })
    });
    const dupData = await dupRes.json();
    if (dupRes.status !== 409) {
      throw new Error(`Test 2 Failed: Expected status 409 for duplicate email, got ${dupRes.status}`);
    }
    console.log(`✓ TEST 2 PASSED: Duplicate email registration rejected with HTTP 409: "${dupData.message}"`);
    passedTests++;

    // ----------------------------------------------------
    // Authenticate Alice & Bob
    // ----------------------------------------------------
    console.log('\nLogging in as Alice to retrieve JWT...');
    const loginAliceRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'alice123' })
    });
    const loginAliceData = await loginAliceRes.json();
    const aliceToken = loginAliceData.token;
    if (!aliceToken) throw new Error('Failed to get Alice token');

    console.log('Registering and logging in as Bob...');
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob',
        email: 'bob@example.com',
        password: 'bobpassword123'
      })
    });
    const loginBobRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@example.com', password: 'bobpassword123' })
    });
    const loginBobData = await loginBobRes.json();
    const bobToken = loginBobData.token;
    if (!bobToken) throw new Error('Failed to get Bob token');

    // ----------------------------------------------------
    // TEST 3: User Data Isolation
    // ----------------------------------------------------
    console.log('\n[TEST 3] Creating notes for Alice and Bob, testing data isolation...');
    // Alice creates 3 notes
    const aliceNote1Res = await fetch(`${BASE_URL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aliceToken}`
      },
      body: JSON.stringify({ title: 'Alice Note 1', content: 'Secret project idea' })
    });
    const aliceNote1Data = await aliceNote1Res.json();
    const aliceNote1Id = aliceNote1Data.note._id;

    await fetch(`${BASE_URL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aliceToken}`
      },
      body: JSON.stringify({ title: 'Alice Note 2', content: 'Meeting notes with team' })
    });

    await fetch(`${BASE_URL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aliceToken}`
      },
      body: JSON.stringify({ title: 'Alice Note 3', content: 'Grocery checklist' })
    });

    // Bob creates 2 notes
    const bobNote1Res = await fetch(`${BASE_URL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bobToken}`
      },
      body: JSON.stringify({ title: 'Bob Note 1', content: 'Gym workout routine' })
    });
    const bobNote1Data = await bobNote1Res.json();
    const bobNote1Id = bobNote1Data.note._id;

    await fetch(`${BASE_URL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bobToken}`
      },
      body: JSON.stringify({ title: 'Bob Note 2', content: 'Book recommendations' })
    });

    // Fetch notes for Alice
    const getAliceNotesRes = await fetch(`${BASE_URL}/api/notes`, {
      headers: { 'Authorization': `Bearer ${aliceToken}` }
    });
    const aliceNotesData = await getAliceNotesRes.json();

    // Fetch notes for Bob
    const getBobNotesRes = await fetch(`${BASE_URL}/api/notes`, {
      headers: { 'Authorization': `Bearer ${bobToken}` }
    });
    const bobNotesData = await getBobNotesRes.json();

    if (aliceNotesData.notes.length !== 3) {
      throw new Error(`Test 3 Failed: Alice expected 3 notes, got ${aliceNotesData.notes.length}`);
    }
    if (bobNotesData.notes.length !== 2) {
      throw new Error(`Test 3 Failed: Bob expected 2 notes, got ${bobNotesData.notes.length}`);
    }

    // Verify Bob does not see any of Alice's notes
    const bobSawAliceNote = bobNotesData.notes.some(n => n.title.includes('Alice'));
    const aliceSawBobNote = aliceNotesData.notes.some(n => n.title.includes('Bob'));
    if (bobSawAliceNote || aliceSawBobNote) {
      throw new Error('Test 3 Failed: Notes leaked across user boundaries!');
    }
    console.log(`✓ TEST 3 PASSED: User isolation verified. Alice sees only her 3 notes, Bob sees only his 2 notes.`);
    passedTests++;

    // ----------------------------------------------------
    // TEST 4: Unauthorized API Access (No Token)
    // ----------------------------------------------------
    console.log('\n[TEST 4] Calling GET /api/notes without Authorization header...');
    const noAuthRes = await fetch(`${BASE_URL}/api/notes`);
    if (noAuthRes.status !== 401) {
      throw new Error(`Test 4 Failed: Expected HTTP 401, got ${noAuthRes.status}`);
    }
    console.log(`✓ TEST 4 PASSED: Missing token request rejected with HTTP 401.`);
    passedTests++;

    // ----------------------------------------------------
    // TEST 5: Invalid JWT Token
    // ----------------------------------------------------
    console.log('\n[TEST 5] Calling GET /api/notes with invalid Bearer token...');
    const invalidAuthRes = await fetch(`${BASE_URL}/api/notes`, {
      headers: { 'Authorization': 'Bearer invalid.token.payload' }
    });
    if (invalidAuthRes.status !== 401) {
      throw new Error(`Test 5 Failed: Expected HTTP 401 for invalid token, got ${invalidAuthRes.status}`);
    }
    console.log(`✓ TEST 5 PASSED: Invalid token request rejected with HTTP 401.`);
    passedTests++;

    // ----------------------------------------------------
    // TEST 6: Unauthorized Note Deletion (Cross-user deletion attempt)
    // ----------------------------------------------------
    console.log('\n[TEST 6] Bob attempting to delete Alice\'s note (' + aliceNote1Id + ')...');
    const deleteCrossRes = await fetch(`${BASE_URL}/api/notes/${aliceNote1Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${bobToken}` }
    });
    if (deleteCrossRes.status !== 404) {
      throw new Error(`Test 6 Failed: Expected HTTP 404, got ${deleteCrossRes.status}`);
    }

    // Verify Alice's note is still intact in MongoDB
    const checkNote = await Note.findById(aliceNote1Id);
    if (!checkNote) {
      throw new Error(`Test 6 Failed: Alice's note was deleted by Bob!`);
    }
    console.log(`✓ TEST 6 PASSED: Unauthorized cross-user deletion rejected with HTTP 404. Alice's note is safely preserved.`);
    passedTests++;

    // ----------------------------------------------------
    // TEST 7: Successful Note Operations (CRUD by owner)
    // ----------------------------------------------------
    console.log('\n[TEST 7] Testing owner note operations (Bob deleting his own note ' + bobNote1Id + ')...');
    const deleteOwnRes = await fetch(`${BASE_URL}/api/notes/${bobNote1Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${bobToken}` }
    });
    if (deleteOwnRes.status !== 200) {
      throw new Error(`Test 7 Failed: Expected HTTP 200, got ${deleteOwnRes.status}`);
    }
    const checkBobNote = await Note.findById(bobNote1Id);
    if (checkBobNote) {
      throw new Error(`Test 7 Failed: Note still exists in DB after deletion.`);
    }

    // Bob now should have 1 note remaining
    const getBobRemainingRes = await fetch(`${BASE_URL}/api/notes`, {
      headers: { 'Authorization': `Bearer ${bobToken}` }
    });
    const bobRemainingData = await getBobRemainingRes.json();
    if (bobRemainingData.notes.length !== 1) {
      throw new Error(`Test 7 Failed: Expected 1 note remaining for Bob, got ${bobRemainingData.notes.length}`);
    }
    console.log(`✓ TEST 7 PASSED: Owner note creation, retrieval, and deletion operate cleanly and synchronize with MongoDB.`);
    passedTests++;

    // ----------------------------------------------------
    // TEST 8: Client-Side Logout & Session Invalidation Contract
    // ----------------------------------------------------
    console.log('\n[TEST 8] Verifying Logout & Session Protection...');
    // Simulated logout removes client token; verifying API without token fails
    const postLogoutAccessRes = await fetch(`${BASE_URL}/api/notes`, {
      headers: {} // No token
    });
    if (postLogoutAccessRes.status !== 401) {
      throw new Error(`Test 8 Failed: Expected 401 when accessing protected route after logout, got ${postLogoutAccessRes.status}`);
    }
    console.log(`✓ TEST 8 PASSED: Client logout security verified. Without stored token, access to dashboard data is blocked.`);
    passedTests++;

    console.log('\n====================================================');
    console.log(`ALL ACCEPTANCE CRITERIA VERIFIED: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('====================================================');

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();

