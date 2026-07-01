import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadString } from "firebase/storage";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const testRef = ref(storage, "test.txt");

uploadString(testRef, "hello world").then(() => {
  console.log("Upload successful");
  process.exit(0);
}).catch((e) => {
  console.error("Upload failed:", e);
  process.exit(1);
});
