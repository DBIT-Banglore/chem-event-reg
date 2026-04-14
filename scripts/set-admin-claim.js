/**
 * Run once to grant admin custom claim to a Firebase user.
 * Usage: node scripts/set-admin-claim.js <uid-or-email>
 */

require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/set-admin-claim.js <uid-or-email>");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
if (!serviceAccount.project_id) {
  console.error("FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

async function run() {
  let uid = target;
  if (target.includes("@")) {
    const user = await admin.auth().getUserByEmail(target);
    uid = user.uid;
    console.log(`Resolved email -> UID: ${uid}`);
  }
  await admin.auth().setCustomUserClaims(uid, { admin: true });
  console.log(`admin: true claim set on ${uid}`);
  console.log("Sign out and back in to the admin panel for the claim to take effect.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
