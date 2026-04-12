// Test environment setup — stub all env vars used by the app
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-chars-long!!";
process.env.RAZORPAY_KEY_ID = "rzp_test_testKeyId";
process.env.RAZORPAY_KEY_SECRET = "test_razorpay_secret";
process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_testKeyId";
process.env.ADMIN_EMAILS = "admin@dbit.in,superadmin@dbit.in";
process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
  type: "service_account",
  project_id: "test-project",
  private_key_id: "key-id",
  private_key: "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Z3VS5JJcds3xHn/ygWep4PAtEsHAEIXYMO2lhq8FKFrjJYH\nFEXHDMJhLLNSuMFGMVU8HjF/X5OWRQ0mLZo0c6n8DXtRHVkVJWhbbSb3AFNG\n-----END RSA PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk@test-project.iam.gserviceaccount.com",
  client_id: "123456789",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
});
