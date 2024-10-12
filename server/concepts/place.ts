import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";

/**
 * Meeting proposal schema
 */
export interface MeetingDoc extends BaseDoc {
  proposer: ObjectId; // User ID of the person proposing the meeting
  recipient: ObjectId; // User ID of the person receiving the proposal
  location: string; // Name of the proposed location
  status: Status; // Status of the meeting proposal
}

export type Status = "Pending" | "Accepted";

/**
 * Concept: Place [MeetingLocation]
 */
export default class PlaceConcept {
  public readonly proposedMeetings: DocCollection<MeetingDoc>;
  public readonly locations: string[]; // Array of location names

  /**
   * Make an instance of PlaceConcept.
   */
  constructor(meetingCollectionName: string) {
    this.proposedMeetings = new DocCollection<MeetingDoc>(meetingCollectionName);
    this.locations = ["Stata Center", "Kendall Square", "IHQ at MIT"]; // Default locations
  }

  async browseNearbyLocations(): Promise<string[]> {
    // Return all available locations
    return this.locations;
  }

  async proposeMeeting(proposer: ObjectId, recipient: ObjectId, loc: string) {
    return await this.proposedMeetings.createOne({
      proposer,
      recipient,
      location: loc,
      status: "Pending",
    });
  }

  async acceptMeeting(recipient: ObjectId, meetingId: ObjectId): Promise<void> {
    const meeting = await this.proposedMeetings.readOne({ _id: meetingId });
    if (!meeting) {
      throw new MeetingNotFoundError(meetingId);
    }
    if (meeting.recipient.toString() !== recipient.toString()) {
      throw new UnauthorizedMeetingAcceptanceError(recipient, meetingId);
    }

    meeting.status = "Accepted";
    await this.proposedMeetings.replaceOne({ _id: meetingId }, meeting);
  }
}

/** Custom Error Classes */
export class MeetingNotFoundError extends Error {
  constructor(public readonly meetingId: ObjectId) {
    super(`Meeting with ID ${meetingId} does not exist!`);
  }
}

export class UnauthorizedMeetingAcceptanceError extends Error {
  constructor(
    public readonly recipient: ObjectId,
    public readonly meetingId: ObjectId,
  ) {
    super(`User ${recipient} is not authorized to accept meeting ${meetingId}!`);
  }
}
