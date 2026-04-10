/**
 * USN Validation & Branch/Section Detection
 * 
 * Accurately determines Branch and Section based on DBIT 2025 exact ranges:
 * CS -> CSE
 * IC -> IOT
 * CI -> AI&ML
 * AD -> AI&DS
 * IS -> ISE
 * EC -> ECE
 * EE -> EEE
 */

import { validUSNs } from "./validUSNs";

export const BRANCH_MAP: Record<string, string> = {
    CS: "CSE",
    IC: "IOT",
    CI: "AI&ML",
    AD: "AI&DS",
    IS: "ISE",
    EC: "ECE",
    EE: "EEE",
};

/**
 * Validates the basic format of a USN string.
 */
export function isValidUSNFormat(usn: string): boolean {
    return /^1DB25(CS|IC|CI|AD|IS|EC|EE)\d{3}$/.test(usn.toUpperCase());
}

/**
 * Checks if a USN exists in the predetermined list.
 */
export function isUSNInValidList(usn: string): boolean {
    return validUSNs.has(usn.toUpperCase());
}

/**
 * Gets the full branch name from a USN.
 */
export function getBranchName(usn: string): string {
    const code = usn.toUpperCase().substring(5, 7);
    return BRANCH_MAP[code] || "Unknown";
}

/**
 * Accurately determines the section using explicit rules rather than math.
 */
export function getSection(usn: string): string {
    const upperUSN = usn.toUpperCase();
    const branchCode = upperUSN.substring(5, 7);
    const rollStr = upperUSN.substring(7);
    const rollNumber = parseInt(rollStr, 10);

    if (branchCode === "CS") {
        if (rollNumber >= 1 && rollNumber <= 59) return "A";
        if (rollNumber >= 60 && rollNumber <= 118) return "B";
        if (rollNumber >= 119 && rollNumber <= 177) return "C";
        if (rollNumber >= 178 && rollNumber <= 197) return "D";
    }

    if (branchCode === "IC") {
        if (rollNumber >= 1 && rollNumber <= 37) return "D";
    }

    if (branchCode === "CI") {
        if (rollNumber >= 1 && rollNumber <= 61) return "E";
        if (rollNumber >= 62 && rollNumber <= 100) return "F";
    }

    if (branchCode === "AD") {
        if (rollNumber >= 1 && rollNumber <= 24) return "F";
        if (rollNumber >= 25 && rollNumber <= 87) return "G";
    }

    if (branchCode === "IS") {
        if (rollNumber >= 1 && rollNumber <= 66) return "I";
        if ((rollNumber >= 67 && rollNumber <= 130) || rollNumber === 195) return "J";
        if (rollNumber >= 131 && rollNumber <= 194) return "K";
    }

    if (branchCode === "EC") {
        if (rollNumber >= 1 && rollNumber <= 53) return "L";
        if ((rollNumber >= 54 && rollNumber <= 108) || rollNumber === 164) return "M";
        if (rollNumber >= 109 && rollNumber <= 163) return "N";
    }

    if (branchCode === "EE") {
        if (rollNumber >= 1 && rollNumber <= 45) return "P";
    }

    return "Unknown";
}

/**
 * Full validation of a USN. Returns an object with validation status,
 * branch, and section information.
 */
export function validateUSN(usn: string): {
    valid: boolean;
    error?: string;
    branch?: string;
    section?: string;
} {
    const upperUSN = usn.toUpperCase();

    if (!upperUSN) {
        return { valid: false, error: "USN is required" };
    }

    if (!isValidUSNFormat(upperUSN)) {
        return { valid: false, error: "Invalid USN format. e.g. 1DB25CS001" };
    }

    if (!isUSNInValidList(upperUSN)) {
        return { valid: false, error: "Invalid USN — not found in student list" };
    }

    return {
        valid: true,
        branch: getBranchName(upperUSN),
        section: getSection(upperUSN),
    };
}

/**
 * Checks if two USNs belong to the same section.
 */
export function areSameSection(usn1: string, usn2: string): boolean {
    const s1 = getSection(usn1);
    const s2 = getSection(usn2);
    // If either section is Unknown, they cannot be inherently verified as same section safely.
    if (s1 === "Unknown" || s2 === "Unknown") return false;
    return s1 === s2;
}
