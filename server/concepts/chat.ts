import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";

/**
 * Chat information schema
 */
export interface ChatDoc extends BaseDoc {
  participants: ObjectId[];
  messages: Message[];
}

export interface Message {
  author: ObjectId;
  text: string;
  timestamp: Date;
}

/**
 * concept: Chat [Messaging]
 */
export default class ChatConcept {
  public readonly chats: DocCollection<ChatDoc>;

  constructor(collectionName: string) {
    this.chats = new DocCollection<ChatDoc>(collectionName);
  }

  async startPrivateChat(user1: ObjectId, user2: ObjectId) {
    return await this.chats.createOne({ participants: [user1, user2], messages: [] });
  }

  async sendMessage(chatId: ObjectId, author: ObjectId, text: string) {
    const chat = await this.chats.readOne({ _id: chatId });
    if (!chat) {
      throw new ChatNotFoundError(chatId);
    }

    const newMessage: Message = { author, text, timestamp: new Date() };
    chat.messages.push(newMessage);
    await this.chats.replaceOne({ _id: chatId }, chat);
    return { msg: "Message sent successfully" };
  }

  async getChat(chatId: ObjectId) {
    const chat = await this.chats.readOne({ _id: chatId });
    if (!chat) {
      throw new ChatNotFoundError(chatId);
    }
    return chat;
  }

  async getChatIdsForUser(userId: ObjectId) {
    const chats = await this.chats.readMany({ participants: userId });
    return chats.map((chat) => chat._id); // Return an array of chat IDs
  }
}

/** Custom Error Classes */
export class ChatNotFoundError extends Error {
  constructor(public readonly chatId: ObjectId) {
    super(`Chat with ID ${chatId} does not exist!`);
  }
}
