import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";

/**
 * Event information schema
 */
export interface EventDoc extends BaseDoc {
  description: string;
  time: Date;
  location: string;
  registeredUsers: ObjectId[]; // List of users registered for the event
}

/**
 * concept: Event [Platform Managed Activity]
 */
export default class EventConcept {
  public readonly events: DocCollection<EventDoc>;

  /**
   * Make an instance of EventConcept.
   */
  constructor(collectionName: string) {
    this.events = new DocCollection<EventDoc>(collectionName);
  }

  async createEvent(description: string, time: Date, location: string) {
    return await this.events.createOne({ description, time, location, registeredUsers: [] });
  }

  async registerUserForEvent(userId: ObjectId, eventId: ObjectId) {
    const event = await this.events.readOne({ _id: eventId });
    if (!event) {
      throw new EventNotFoundError(eventId);
    }
    if (event.registeredUsers.includes(userId)) {
      throw new UserAlreadyRegisteredError(userId, eventId);
    }

    event.registeredUsers.push(userId);
    await this.events.replaceOne({ _id: eventId }, event);
    return { msg: "User registered successfully" };
  }

  async viewEvents() {
    return await this.events.readMany({});
  }

  async viewEventDetails(eventId: ObjectId) {
    const event = await this.events.readOne({ _id: eventId });
    if (!event) {
      throw new EventNotFoundError(eventId);
    }
    return event;
  }

  async updateEvent(eventId: ObjectId, details: Partial<EventDoc>) {
    await this.events.partialUpdateOne({ _id: eventId }, details);
    return { msg: "Event updated successfully" };
  }

  async deleteEvent(eventId: ObjectId) {
    await this.events.deleteOne({ _id: eventId });
    return { msg: "Event deleted successfully" };
  }
}

/** Custom Error Classes */
export class EventNotFoundError extends Error {
  constructor(public readonly eventId: ObjectId) {
    super(`Event with ID ${eventId} does not exist!`);
  }
}

export class UserAlreadyRegisteredError extends Error {
  constructor(public readonly userId: ObjectId, public readonly eventId: ObjectId) {
    super(`User ${userId} is already registered for event ${eventId}!`);
  }
}
