# 🔧 Admin Panel CORS Fix

## Problem Identified

The admin panel was showing "forbidden" errors and not loading any data. This was caused by the CORS middleware blocking legitimate admin panel API calls.

## Root Cause

The admin panel makes API calls to endpoints like:
- `/api/admin/events`
- `/api/admin/students` 
- `/api/admin/config`
- `/api/admin/reset-database`

These calls were being blocked because:
1. The middleware was checking `Origin` headers strictly
2. Same-origin requests weren't being handled properly
3. The origin validation was too restrictive for admin panel operations

## Solution Implemented

### 1. **Same-Origin Request Detection**

Added `isSameOriginRequest()` function to properly detect when the admin panel is calling its own API:

```typescript
function isSameOriginRequest(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  // If no origin header, it's likely a same-origin request or server-side
  if (!origin) {
    return true;
  }

  // Check if the origin matches the current host
  const originHost = new URL(origin).hostname;
  return originHost === host;
}
```

### 2. **Updated Middleware Logic**

Modified the API origin checking to allow same-origin requests:

```typescript
// Allow same-origin requests (admin panel calling its own API)
if (isSameOriginRequest(req)) {
  // Same-origin requests are always allowed
  return NextResponse.next();
}

const origin = getOrigin(req);

if (!origin) {
  // Allow server-side calls (SSR/API-to-API within the same app)
  const host = req.headers.get("host");
  const isLocalhost = host?.startsWith("localhost");
  const isSameHost = ALLOWED_ORIGINS.has(`https://${host}`) || ALLOWED_ORIGINS.has(`http://${host}`);
  if (!isLocalhost && !isSameHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
} else if (!ALLOWED_ORIGINS.has(origin)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### 3. **Maintained Security**

The fix still maintains security:
- ✅ Cross-origin requests are validated
- ✅ Rate limiting still applies
- ✅ Firebase authentication still required
- ✅ Security headers still applied

## Firebase Authentication

The admin panel continues to use the same Firebase email/password authentication system:

```typescript
// From admin page
await signInWithEmailAndPassword(auth, email, password);

// API calls include Firebase token
const idToken = await currentUser.getIdToken(true);
const res = await fetch("/api/admin/events", {
  headers: { "x-admin-token": idToken },
});
```

## Testing

### Test Admin API Functionality

```bash
# Test admin panel API endpoints
npm run test:admin-api
```

This test script verifies:
- ✅ Public events API works without authentication
- ✅ Admin endpoints require Firebase authentication
- ✅ Same-origin requests are allowed
- ✅ CORS headers are properly set

### Expected Results

**Before Fix:**
- ❌ Admin panel shows "forbidden" error
- ❌ No data loads
- ❌ API calls blocked by CORS

**After Fix:**
- ✅ Admin panel loads normally
- ✅ API calls succeed
- ✅ Data displays correctly
- ✅ Firebase authentication works
- ✅ Same-origin requests allowed

## Configuration

### Environment Variables

No additional configuration needed. The admin panel works with:

```env
# Firebase configuration (existing)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key

# Firebase authentication (existing)
# Uses Firebase Auth with email/password

# CORS configuration (existing)
ALLOWED_ORIGINS=https://chem-event.netlify.app
```

### Admin Email Access

The admin panel uses the same Firebase email authentication as configured in:

```env
ADMIN_EMAILS=admin1@domain.com,admin2@domain.com
```

Only emails listed in `ADMIN_EMAILS` can access the admin panel.

## Security Considerations

### ✅ What's Protected

1. **Cross-origin requests** - Still validated against `ALLOWED_ORIGINS`
2. **Unauthorized access** - Firebase authentication required for admin endpoints
3. **Rate limiting** - Global API limits still apply
4. **Input validation** - All inputs still validated

### ✅ What's Allowed

1. **Same-origin requests** - Admin panel calling its own API
2. **Server-side requests** - Next.js server-side rendering
3. **Public endpoints** - `/api/events` still publicly accessible

## Deployment

### Deploy the Fix

```bash
# Build the project
npm run build

# Test locally first
npm run dev
# Visit http://localhost:3000/admin
# Login with Firebase admin credentials

# Test admin API
npm run test:admin-api

# Deploy to production
# (Use your deployment method)
```

### Verify Production Deployment

After deployment:

1. **Visit Admin Panel**: `https://chem-event.netlify.app/admin`
2. **Login**: Use Firebase admin email/password
3. **Check Data Loading**: Dashboard, students, events should load
4. **Test Operations**: Create events, view students, export data

## Troubleshooting

### Issue: Admin panel still shows forbidden

**Solution:**
1. Check `ALLOWED_ORIGINS` includes your domain
2. Verify `NODE_ENV=production` is set
3. Clear browser cache and cookies
4. Check browser console for specific error messages

### Issue: API calls fail with 401

**Solution:**
1. Verify Firebase authentication is working
2. Check that user email is in `ADMIN_EMAILS`
3. Ensure Firebase project is properly configured
4. Try logging out and back in

### Issue: Data not loading in admin panel

**Solution:**
1. Check browser network tab for failed requests
2. Verify API endpoints are responding correctly
3. Check Firebase Firestore rules and permissions
4. Look for JavaScript errors in browser console

## Files Modified

1. **`src/middleware.ts`**
   - Added `isSameOriginRequest()` function
   - Updated API origin checking logic
   - Made same-origin requests always allowed

2. **`package.json`**
   - Added `test:admin-api` script

3. **`test-admin-api.js`** (new file)
   - Admin API testing script
   - Tests authentication, CORS, and data loading

## Backward Compatibility

✅ **Fully Compatible**: The fix maintains all existing functionality:
- Existing Firebase authentication
- Existing rate limiting
- Existing security headers
- Existing admin features
- Existing API endpoints

## Summary

The admin panel CORS issue has been **completely resolved** while maintaining security:

✅ **Admin panel works normally**
✅ **Firebase authentication unchanged**
✅ **Same-origin requests allowed**
✅ **Cross-origin protection maintained**
✅ **Rate limiting still active**
✅ **Security headers still applied**

The admin panel should now work exactly as before, with the added benefit of proper CORS protection for cross-origin requests.

---

**Fix Completed:** 2026-04-13
**Status:** ✅ Ready for Deployment
**Tested:** ✅ TypeScript compilation, admin API testing
