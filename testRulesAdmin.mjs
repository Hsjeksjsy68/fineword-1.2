import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import * as fs from 'fs';

let testEnv;

async function runTests() {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-test',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
  });

  const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com', email_verified: true });
  const admin = testEnv.authenticatedContext('admin', { email: 'wwwrakibcom071@gmail.com', email_verified: true });
  
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('users/alice').set({ id: 'alice', username: 'alice', name: 'Alice', avatar: '', bio: '' });
  });

  try {
    await assertSucceeds(alice.firestore().doc('users/alice').update({ isDeactivated: true }));
    console.log("Alice update isDeactivated succeeded");
  } catch (e) {
    console.error("Alice update failed", e.message);
  }

  try {
    await assertSucceeds(admin.firestore().doc('users/alice').update({ verificationStatus: 'accepted', isVerified: true }));
    console.log("Admin update verificationStatus succeeded");
  } catch (e) {
    console.error("Admin update failed", e.message);
  }
}

runTests();
