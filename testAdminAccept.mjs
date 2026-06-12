import { readFileSync } from 'fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

async function run() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'demo-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });

  const admin = testEnv.authenticatedContext('admin1', { email: 'arbnyt60@gmail.com', email_verified: true });
  
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('users/user1').set({ 
      id: 'user1', 
      username: 'user1', 
      name: 'User One', 
      avatar: '', 
      bio: '',
      verificationStatus: 'pending'
    });
  });

  const dbAdmin = admin.firestore();
  
  try {
    let expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    await dbAdmin.doc('users/user1').update({
      verificationStatus: 'accepted',
      isVerified: true,
      verifiedUntil: expiresAt
    });
    console.log("UPDATE USER SUCCESS");
  } catch(e) {
    console.log("UPDATE USER FAILED:", e.message);
  }

  try {
    const notifId = 'sys_12345';
    await dbAdmin.doc('notifications/' + notifId).set({
      id: notifId,
      userId: 'user1',
      actorId: 'admin1',
      type: 'system',
      message: 'Congratulations! Your verification request has been accepted. You are now verified.',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp() // Notice how rules-unit-testing handles timestamp
    });
    console.log("CREATE NOTIF SUCCESS");
  } catch (e) {
    console.log("CREATE NOTIF FAILED:", e.message);
  }
}

run();
