// types/round.ts

// Boolean flags stored as "T" or "F" in the source data
export const BoolFlag = {
    True: 'T',
    False: 'F',
} as const;
export type BoolFlag = (typeof BoolFlag)[keyof typeof BoolFlag];

// Club type mapping (based on observed IDs and Arccos patterns)
export const ClubType = {
    Driver: 1,
    ThreeWood: 2,
    FiveWood: 3,
    Hybrid: 4,
    Iron3: 5,
    Iron4: 6,
    Iron5: 7,
    Iron6: 8,
    Iron7: 9,
    Iron8: 10,
    Iron9: 11,
    PitchingWedge: 12,
    GapWedge: 56,
    SandWedge: 49,
    LobWedge: 53,
    Putter: 14,
} as const;
export type ClubType = (typeof ClubType)[keyof typeof ClubType];

// Common ISO 8601 timestamp branded type for clarity
export type ISODateTime = string & { __type: 'ISODateTime' };

// Common geo coordinate pair
export interface LatLong {
    lat: number;
    long: number;
}

// Start and end elevation range
export interface AltitudeRange {
    start: number;
    end: number | null;
}

// Individual shot within a hole
export interface Shot {
    shotId: number;
    clubType: ClubType;
    clubId: number;
    startLocation: LatLong;
    endLocation: LatLong | null;
    distance: number;
    altitude: AltitudeRange;
    isHalfSwing: BoolFlag;
    shotTime: ISODateTime;
    noOfPenalties: number;
    shouldIgnore: BoolFlag;
    isSandUser: boolean | null;
    isNonSandUser: boolean | null;
    shouldConsiderPuttAsChip: BoolFlag;
    userStartTerrainOverride: number;
    shotUUID: string | null;
    tourQuality: string | null;
}

// A single hole within a round
export interface Hole {
    holeId: number;
    noOfShots: number;
    isGir: BoolFlag;
    putts: number;
    isSandSaveChance: BoolFlag;
    isSandSave: BoolFlag;
    startTime: ISODateTime;
    endTime: ISODateTime;
    shouldIgnore: BoolFlag;
    isFairWay: BoolFlag;
    isFairWayRight: BoolFlag;
    isFairWayLeft: BoolFlag;
    isFairWayUser: boolean | null;
    isFairWayRightUser: boolean | null;
    isFairWayLeftUser: boolean | null;
    approachShotId: number;
    isUpDownChance: BoolFlag;
    isUpDown: BoolFlag;
    pinLocation: LatLong;
    scoreOverride: number | null;
    shots: Shot[];
}

// A full round record
export interface Round {
    roundId: number;
    roundVersion: number;
    courseId: number;
    courseVersion: number;
    userId: string;
    startTime: ISODateTime;
    endTime: ISODateTime;
    lastModifiedTime: ISODateTime;
    noOfHoles: number;
    noOfShots: number;
    shouldIgnore: BoolFlag;
    teeId: number;
    isPrivate: BoolFlag;
    isVerified: BoolFlag;
    isEnded: BoolFlag;
    isDriverRound: BoolFlag;
    noOfHolesOverride: number | null;
    scoreOverride: number | null;
    courseName: string;
    overUnder: number;
    roundTypeId: number;
    scoreFormatId: number | null;
    roundUUID: string;
    holes: Hole[];
}
