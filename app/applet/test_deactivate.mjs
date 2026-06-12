import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, updateDoc, doc, collection, query, where, getDocs } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  let user;
  const email = "test_deactivate_" + Date.now() + "@example.com";
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, "password");
    user = cred.user;
    console.log("Logged in:", user.uid);
  } catch (e) {
    console.error("Auth error:", e.message);
    return;
  }

  try {
    const usersRef = collection(db, "users");
    // try to read all users
    await getDocs(query(usersRef, where('isDeactivated', '==', true)));
    console.log("Read isDeactivated==true SUCCEEDED");
  } catch (e) {
    console.error("Read query FAILED:", e.message);
  }

  try {
    await updateDoc(doc(db, "users", user.uid), {
      isDeactivated: true
    });
    console.log("Update isDeactivated SUCCEEDED");
  } catch (e) {
    console.error("Update isDeactivated FAILED:", e.message);
  }

  process.exit(0);
}

run();
