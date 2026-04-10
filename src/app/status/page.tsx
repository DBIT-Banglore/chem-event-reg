import Navbar from "@/components/Navbar";
import StatusLookup from "@/components/StatusLookup";

export default function StatusPage() {
    return (
        <main className="min-h-screen flex flex-col" style={{ background: "var(--paper)", color: "var(--ink)" }}>
            <Navbar />

            <section className="flex-1 flex items-start justify-center px-4 py-8" style={{ marginTop: 60 }}>
                <div className="w-full max-w-lg fade-in-up">
                    <div className="text-center mb-8">
                        <h1 style={{ fontFamily: "var(--bebas)", fontSize: "42px", letterSpacing: "0.02em", lineHeight: 1, marginBottom: "8px" }}>Check Your Status</h1>
                        <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.6 }}>
                            Enter your USN to view your registration, team details, and pending invites.
                        </p>
                    </div>

                    <div className="glass-card p-6 md:p-8">
                        <StatusLookup />
                    </div>
                </div>
            </section>
        </main>
    );
}
