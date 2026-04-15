"use client";

interface TeamStatusTrackerProps {
  status: "pending" | "verified" | "paid" | "complete" | "cancelled";
  teamName: string;
  memberCount: number;
  otpVerificationStatus: Record<string, boolean>;
  teamId: string;
}

export default function TeamStatusTracker({ status, teamName, memberCount, otpVerificationStatus, teamId }: TeamStatusTrackerProps) {
  const verifiedCount = Object.values(otpVerificationStatus).filter(Boolean).length;
  const allVerified = verifiedCount === memberCount;

  const getStatusColor = () => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "verified":
        return "bg-green-100 text-green-800 border-green-300";
      case "paid":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "complete":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "pending":
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m0-6l-3 3m0 6H8z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m0-6l-3 3m0 6H8z" />
          </svg>
        );
      case "verified":
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 2-2-4.79L3.067 9.32l1.933 2.286L12 5.79 9.32l.787 3.084 3.084 2.286L6 8.485 2.286 9.32l2.067 9.32 2.286z" />
          </svg>
        );
      case "paid":
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7c0-1.1-.9-2-2H5c-1.1 0-2 .9-2V5c0-1.1-.9-2-2h10c1.1 0 2 .9 2v2zM12 15c-1.1 0-2-.9-2h-2v2h4c1.1 0 2 .9 2v4c0 1.1.9 2 2h2v-2H7c-1.1 0-2 .9-2z" />
          </svg>
        );
      case "complete":
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C6.48 2 2 6.48 2 2s6.48 2 12 2 6.48 2 12 2 6.48 2 12 2s6.48 2 12 2-6.48 2 12-6.48 2-12-2.226a.757.757 0 00-5.237 5.237a.757.757 0 01 5.237 5.237a.757.757 0 01 5.237 5.237a.757.757 0 00 6.463 5.237a.757.757 0 01 5.237 5.237a.757.757 0 00 6.463 5.237a.757.757 0 00 2.022 7.237a.757.757 0 00-6.237-5.237a.757.757 0 00-6.237-5.237a.757.757 0 01 0 0.917-.227.757.757 0 00 0 0.917-.227.757.757 0 01 0 0-5.237-5.237a.757.757 0 00-6.237-5.237a.757.757 0 01 0 0.917.227.757.757 0 00 0 0.917.227.757.757 0 01 0 0 0 0.917.227.757.757 0 00 0 0.917-.227.757.757 0 01 0 0-5.237-5.237a.757.757 0 00-6.237-5.237a.757.757 0 00z" />
          </svg>
        );
      case "cancelled":
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 6L6 18M6 6h12v12H6z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getNextAction = () => {
    switch (status) {
      case "pending":
        return "Waiting for team members to verify their OTPs";
      case "verified":
        return "All members verified! Proceed to payment";
      case "paid":
        return "Payment successful! Team registration complete";
      case "complete":
        return "Team fully registered";
      case "cancelled":
        return "Team registration cancelled";
      default:
        return "Unknown status";
    }
  };

  return (
    <div className={`rounded-lg p-6 ${getStatusColor()}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{teamName}</h3>
          <p className="text-sm text-gray-600">Team ID: {teamId}</p>
        </div>
        <div className={`px-3 py-1 rounded-full ${getStatusColor().split(' ')[0]}`}>
          {getStatusIcon()}
        </div>
      </div>

      <div className="space-y-4">
        {/* Verification Progress */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">OTP Verification Progress</h4>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                allVerified ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${(verifiedCount / memberCount) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">
              {verifiedCount} of {memberCount} members verified
            </span>
            {allVerified && (
              <span className="text-green-600 font-medium">✓ All verified!</span>
            )}
          </div>
        </div>

        {/* Team Status */}
        <div className="bg-white bg-opacity-50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-medium text-gray-700">Current Status:</span>
            <span className={`text-lg font-bold ${getStatusColor().split(' ')[1]}`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
          <p className="text-sm text-gray-600">{getNextAction()}</p>
        </div>

        {/* Action Buttons */}
        {status === "pending" && !allVerified && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">Action Required:</span> Please remind your team members to check their email and verify their OTPs within 24 hours.
            </p>
          </div>
        )}

        {status === "verified" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Action Required:</span> As team leader, proceed to payment to complete team registration.
            </p>
          </div>
        )}

        {status === "paid" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800">
              <span className="font-semibold">Success:</span> Your team has been successfully registered for this event!
            </p>
          </div>
        )}

        {status === "cancelled" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              <span className="font-semibold">Cancelled:</span> This team registration has been cancelled. Please create a new team if needed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}