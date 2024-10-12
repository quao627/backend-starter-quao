import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Chatting, Eventing, Friending, Place, Posting, Profiling, Sessioning } from "./app";
import { EventDoc } from "./concepts/eventing";
import { PostOptions, PostState } from "./concepts/posting";
import { SessionDoc } from "./concepts/sessioning";
import Responses from "./responses";

import { z } from "zod";

/**
 * Web server routes for the app. Implements synchronizations between concepts.
 */
class Routes {
  // Synchronize the concepts from `app.ts`.

  @Router.get("/session")
  async getSessionUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await Authing.getUsers();
  }

  @Router.get("/users/:username")
  @Router.validate(z.object({ username: z.string().min(1) }))
  async getUser(username: string) {
    return await Authing.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: SessionDoc, username: string, password: string) {
    Sessioning.isLoggedOut(session);
    return await Authing.create(username, password);
  }

  @Router.patch("/users/username")
  async updateUsername(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    return await Authing.updateUsername(user, username);
  }

  @Router.patch("/users/password")
  async updatePassword(session: SessionDoc, currentPassword: string, newPassword: string) {
    const user = Sessioning.getUser(session);
    return Authing.updatePassword(user, currentPassword, newPassword);
  }

  @Router.delete("/users")
  async deleteUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    Sessioning.end(session);
    return await Authing.delete(user);
  }

  @Router.post("/login")
  async logIn(session: SessionDoc, username: string, password: string) {
    const u = await Authing.authenticate(username, password);
    Sessioning.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: SessionDoc) {
    Sessioning.end(session);
    return { msg: "Logged out!" };
  }

  // --- Post
  @Router.get("/posts")
  @Router.validate(z.object({ author: z.string().optional() }))
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await Authing.getUserByUsername(author))._id;
      posts = await Posting.getByAuthor(id);
    } else {
      posts = await Posting.getPosts();
    }
    return Responses.posts(posts);
  }

  /**
   * Create a new post.
   */
  @Router.post("/posts")
  async createPost(session: SessionDoc, content: string, state: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, content, state as PostState, options);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  /**
   * Update an existing post (only the author can update).
   */
  @Router.patch("/posts/:id")
  async updatePost(session: SessionDoc, id: string, content?: string, state?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return await Posting.update(oid, content, state as PostState, options);
  }

  /**
   * Delete a post (only the author can delete).
   */
  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return await Posting.delete(oid);
  }

  /**
   * React to a post (like a post).
   */
  @Router.post("/posts/:id/react")
  async reactToPost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    return await Posting.reactToPost(user, oid);
  }

  /**
   * Get the number of likes for a post.
   */
  @Router.get("/posts/:id/likes")
  async getLikesCount(id: string) {
    const oid = new ObjectId(id);
    const likesCount = await Posting.getNumberOfLikes(oid);
    return { likes: likesCount };
  }

  // --- Friending Routes ---
  @Router.get("/friends")
  async getFriends(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.idsToUsernames(await Friending.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: SessionDoc, friend: string) {
    const user = Sessioning.getUser(session);
    const friendOid = (await Authing.getUserByUsername(friend))._id;
    return await Friending.removeFriend(user, friendOid);
  }

  @Router.get("/friend/requests")
  async getRequests(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Responses.friendRequests(await Friending.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.sendRequest(user, toOid);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.removeRequest(user, toOid);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.acceptRequest(fromOid, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.rejectRequest(fromOid, user);
  }

  // --- Event Routes ---
  @Router.post("/events")
  async createEvent(session: SessionDoc, description: string, time: string, location: string) {
    //  Sessioning.assertAdmin(session); // only admins can create events
    const eventTime = new Date(time);
    const eventID = await Eventing.createEvent(description, eventTime, location);
    return { msg: "Event created successfully", eventID: eventID };
  }

  @Router.get("/events")
  async getEvents() {
    return await Eventing.viewEvents();
  }

  @Router.get("/events/:eventId")
  @Router.validate(z.object({ eventId: z.string().min(1) }))
  async getEventDetails(eventId: string) {
    const oid = new ObjectId(eventId);
    return await Eventing.viewEventDetails(oid);
  }

  @Router.patch("/events/:eventId")
  @Router.validate(z.object({ eventId: z.string().min(1) }))
  async updateEvent(eventId: string, details: Partial<EventDoc>) {
    //  Sessioning.assertAdmin(session);
    const oid = new ObjectId(eventId);
    return await Eventing.updateEvent(oid, details);
  }

  @Router.delete("/events/:eventId")
  @Router.validate(z.object({ eventId: z.string().min(1) }))
  async deleteEvent(eventId: string) {
    //  Sessioning.assertAdmin(session);
    const oid = new ObjectId(eventId);
    return await Eventing.deleteEvent(oid);
  }

  @Router.post("/events/:eventId/register")
  async registerForEvent(session: SessionDoc, eventId: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(eventId);
    return await Eventing.registerUserForEvent(user, oid);
  }

  // --- Profile Routes ---
  @Router.post("/profiles")
  async createProfile(session: SessionDoc, name: string, expertise: string, interests: string, pastExperience: string, gender: string) {
    const user = Sessioning.getUser(session);
    return await Profiling.createProfile(user, name, expertise, interests, pastExperience, gender);
  }

  @Router.patch("/profiles")
  async editProfile(session: SessionDoc, name: string, expertise: string, interests: string, pastExperience: string, gender: string) {
    const user = Sessioning.getUser(session);
    return await Profiling.editProfile(user, name, expertise, interests, pastExperience, gender);
  }

  // PATCH: Verify Profile
  @Router.patch("/profiles/:userId/verify")
  @Router.validate(z.object({ userId: z.string().min(1) }))
  async verifyProfile(userId: string) {
    const oid = new ObjectId(userId);
    return await Profiling.verifyProfile(oid);
  }

  // GET: Get Profile by userId
  @Router.get("/profiles/:userId")
  @Router.validate(z.object({ userId: z.string().min(1) }))
  async getProfile(userId: string) {
    const oid = new ObjectId(userId);
    return await Profiling.getProfile(oid);
  }

  // --- Chat Routes ---
  @Router.post("/chats/private")
  async startPrivateChat(session: SessionDoc, targetUserId: string) {
    const user = Sessioning.getUser(session);
    const targetOid = new ObjectId(targetUserId);
    return await Chatting.startPrivateChat(user, targetOid);
  }

  @Router.post("/chats/:chatId/messages")
  async sendMessage(session: SessionDoc, chatId: string, text: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(chatId);
    return await Chatting.sendMessage(oid, user, text);
  }

  @Router.get("/chats/:chatId")
  @Router.validate(z.object({ chatId: z.string().min(1) }))
  async getChat(chatId: string) {
    const oid = new ObjectId(chatId);
    return await Chatting.getChat(oid);
  }

  // New route to get all chat IDs for a given user
  @Router.get("/users/:userId/chats")
  @Router.validate(z.object({ userId: z.string().min(1) }))
  async getChatIdsForUser(userId: string) {
    const oid = new ObjectId(userId);
    return await Chatting.getChatIdsForUser(oid);
  }

  // Route to browse nearby locations
  @Router.get("/locations")
  async browseLocations() {
    return await Place.browseNearbyLocations();
  }

  // Route to propose a meeting
  @Router.post("/meetings/propose")
  async proposeMeeting(session: SessionDoc, recipient: string, location: string) {
    const user = Sessioning.getUser(session);
    const recipientOid = new ObjectId(recipient);
    const meeting = await Place.proposeMeeting(user, recipientOid, location);
    return { msg: "Meeting proposed successfully", meeting };
  }

  // Route to accept a meeting
  @Router.patch("/meetings/:meetingId/accept")
  async acceptMeeting(session: SessionDoc, meetingId: string) {
    const user = Sessioning.getUser(session);
    const meetingOid = new ObjectId(meetingId);
    await Place.acceptMeeting(user, meetingOid);
    return { msg: "Meeting accepted successfully" };
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
