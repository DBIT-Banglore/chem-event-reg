/**
 * Valid USN List for DBIT Idea Lab
 * 
 * Based on the specific 2025 DBIT allocation:
 * 
 * Section | Branch      | USN Range                  
 * ---------------------------------------------------
 * A       | CSE         | 1DB25CS001 – 1DB25CS059    
 * B       | CSE         | 1DB25CS060 – 1DB25CS118    
 * C       | CSE         | 1DB25CS119 – 1DB25CS177    
 * D       | CSE + IOT   | 1DB25CS178 – 1DB25CS197 (CSE) & 1DB25IC001 – 1DB25IC037 (IOT)
 * E       | AI & ML     | 1DB25CI001 – 1DB25CI061    
 * F       | AI&ML+AI&DS | 1DB25CI062 – 1DB25CI100 (AI&ML) & 1DB25AD001 – 1DB25AD024 (AI&DS)
 * G       | AI & DS     | 1DB25AD025 – 1DB25AD087    
 * I       | ISE         | 1DB25IS001 – 1DB25IS066    
 * J       | ISE         | 1DB25IS067 – 1DB25IS130 & 1DB25IS195 (late)
 * K       | ISE         | 1DB25IS131 – 1DB25IS194    
 * L       | ECE         | 1DB25EC001 – 1DB25EC053    
 * M       | ECE         | 1DB25EC054 – 1DB25EC108 & 1DB25EC164 (late)
 * N       | ECE         | 1DB25EC109 – 1DB25EC163    
 * P       | EEE         | 1DB25EE001 – 1DB25EE045    
 */

// Helper to generate USNs exactly in a range [start, end]
function generateRange(branchCode: string, start: number, end: number): string[] {
    const usns: string[] = [];
    for (let i = start; i <= end; i++) {
        const num = String(i).padStart(3, "0");
        usns.push(`1DB25${branchCode}${num}`);
    }
    return usns;
}

// Generate the full valid USN set based on specific blocks
function buildValidUSNSet(): Set<string> {
    const allUSNs: string[] = [
        // CSE
        ...generateRange("CS", 1, 197),
        // IOT (IC)
        ...generateRange("IC", 1, 37),
        // AI & ML (CI)
        ...generateRange("CI", 1, 100),
        // AI & DS (AD)
        ...generateRange("AD", 1, 87),
        // ISE
        ...generateRange("IS", 1, 194),
        "1DB25IS195", // Late addition in J
        // ECE
        ...generateRange("EC", 1, 163),
        "1DB25EC164", // Late addition in M
        // EEE
        ...generateRange("EE", 1, 45),
    ];
    return new Set(allUSNs);
}

/**
 * Exported set of all valid USNs.
 * Use validUSNs.has(usn) to check membership.
 */
export const validUSNs: Set<string> = buildValidUSNSet();
