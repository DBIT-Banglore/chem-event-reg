"use client";

interface TeamMember {
  usn: string;
  name: string;
  branch: string;
  section: string;
  isLeader: boolean;
  verified: boolean;
}

interface TeamMemberListProps {
  members: TeamMember[];
  otpVerificationStatus: Record<string, boolean>;
  teamLeaderUSN: string;
}

export default function TeamMemberList({ members, otpVerificationStatus, teamLeaderUSN }: TeamMemberListProps) {
  const getMemberStatus = (usn: string) => {
    if (otpVerificationStatus?.[usn] === true) {
      return {
        color: "bg-green-100 text-green-800 border-green-300",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 2-2-4.79L3.067 9.32l1.933 2.286L12 5.79 9.32l.787 3.084 3.084 2.286L6 8.485 2.286 9.32l2.067 9.32 2.286z" />
          </svg>
        ),
        text: "Verified"
      };
    } else {
      return {
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m0-6l-3 3m0 6H8z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m0-6l-3 3m0 6H8z" />
          </svg>
        ),
        text: "Pending OTP"
      };
    }
  };

  const getInitials = (name: string): string => {
    if (!name) return "?";
    const parts = name.split(" ");
    return parts.map(part => part.charAt(0).toUpperCase()).join(" ");
  };

  const unverifiedCount = Object.values(otpVerificationStatus || {}).filter(status => !status).length;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Team Members</h3>
          <p className="text-sm text-gray-600">{members.length} total members</p>
        </div>
        {unverifiedCount > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0-4l3 3m0-6l-3 3m0 6H8z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m0-6l-3 3m0 6H8z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  <span className="font-bold">{unverifiedCount}</span> member{unverifiedCount !== 1 ? 's' : ''} pending verification
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Please remind them to check their email
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Members List */}
      <div className="space-y-3">
        {members.map((member, index) => {
          const memberStatus = getMemberStatus(member.usn);
          const initials = getInitials(member.name);

          return (
            <div
              key={member.usn}
              className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                member.isLeader ? "bg-blue-50 border-blue-200" : memberStatus.color
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Avatar/Initials */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                  member.isLeader ? 'bg-blue-600' : memberStatus.color.includes('green') ? 'bg-green-600' : 'bg-gray-400'
                }`}>
                  {initials}
                </div>

                {/* Member Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{member.name}</span>
                    {member.isLeader && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        Leader
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="font-mono text-xs">{member.usn}</span>
                    <span className="text-gray-400">•</span>
                    <span>{member.branch}</span>
                    <span className="text-gray-400">•</span>
                    <span>Section {member.section}</span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${memberStatus.color}`}>
                {memberStatus.icon}
                <span className="text-sm font-medium ml-2">{memberStatus.text}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      {unverifiedCount > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Team Leader Actions</h4>
            <div className="space-y-2 text-sm text-blue-800">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m0-6l-3 3m0 6H8z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m0-6l-3 3m0 6H8z" />
                </svg>
                <p>
                  <span className="font-semibold">Send reminder OTPs:</span> Contact unverified team members and ask them to check their email for the OTP
                </p>
              </div>
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7c0-1.1-.9-2-2H5c-1.1 0-2 .9-2V5c0-1.1-.9-2-2h10c1.1 0 2 .9 2v2zM12 15c-1.1 0-2-.9-2h-2v2h4c1.1 0 2 .9 2v4c0 1.1.9 2 2h2v-2H7c-1.1 0-2 .9-2z" />
                </svg>
                <p>
                  <span className="font-semibold">Remove unverified members:</span> You can replace unverified team members with other students
                </p>
              </div>
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 6L6 18M6 6h12v12H6z" />
                </svg>
                <p>
                  <span className="font-semibold">Cancel team:</span> If verification cannot be completed, you can cancel this team and create a new one
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}