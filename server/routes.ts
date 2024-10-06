import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Chatting, Friending, Posting, Profiling, Sessioning } from "./app";
import { PostOptions } from "./concepts/posting";
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

  @Router.post("/posts")
  async createPost(session: SessionDoc, content: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, content, options);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.patch("/posts/:id")
  async updatePost(session: SessionDoc, id: string, content?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return await Posting.update(oid, content, options);
  }

  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return Posting.delete(oid);
  }

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
    return await Eventing.createEvent(description, eventTime, location);
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
  async updateEvent(session: SessionDoc, eventId: string, details: Partial<EventDoc>) {
    //  Sessioning.assertAdmin(session);
    const oid = new ObjectId(eventId);
    return await Eventing.updateEvent(oid, details);
  }

  @Router.delete("/events/:eventId")
  @Router.validate(z.object({ eventId: z.string().min(1) }))
  async deleteEvent(session: SessionDoc, eventId: string) {
    //  Sessioning.assertAdmin(session);
    const oid = new ObjectId(eventId);
    return await Eventing.deleteEvent(oid);
  }

  @Router.post("/events/:eventId/register")
  @Router.validate(z.object({ eventId: z.string().min(1) }))
  async registerForEvent(session: SessionDoc, eventId: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(eventId);
    return await Eventing.registerUserForEvent(user, oid);
  }

  // --- Commenting Routes ---

  @Router.post("/posts/:postId/comments")
  @Router.validate(z.object({ postId: z.string().min(1), text: z.string().min(1) }))
  async addComment(session: SessionDoc, postId: string, text: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(postId);
    return await Commenting.addComment(oid, user, text);
  }

  @Router.get("/posts/:postId/comments")
  @Router.validate(z.object({ postId: z.string().min(1) }))
  async getComments(postId: string) {
    const oid = new ObjectId(postId);
    return await Commenting.getCommentsByPost(oid);
  }

  @Router.patch("/comments/:commentId")
  @Router.validate(z.object({ commentId: z.string().min(1), text: z.string().min(1) }))
  async editComment(session: SessionDoc, commentId: string, text: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(commentId);
    return await Commenting.editComment(oid, text);
  }

  @Router.delete("/comments/:commentId")
  @Router.validate(z.object({ commentId: z.string().min(1) }))
  async deleteComment(session: SessionDoc, commentId: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(commentId);
    return await Commenting.deleteComment(oid);
  }

  // --- Profile Routes ---

  @Router.post("/profiles")
  async createProfile(session: SessionDoc, name: string, expertise: string[], interests: string[], pastExperience: string[], gender: string) {
    const user = Sessioning.getUser(session);
    return await Profiling.createProfile(user, name, expertise, interests, pastExperience, gender);
  }

  @Router.patch("/profiles")
  async editProfile(session: SessionDoc, updatedInfo: Partial<ProfileDoc>) {
    const user = Sessioning.getUser(session);
    return await Profiling.editProfile(user, updatedInfo);
  }

  @Router.get("/profiles/:userId")
  @Router.validate(z.object({ userId: z.string().min(1) }))
  async getProfile(userId: string) {
    const oid = new ObjectId(userId);
    return await Profiling.getProfile(oid);
  }

  @Router.put("/profiles/:targetUserId/follow")
  @Router.validate(z.object({ targetUserId: z.string().min(1) }))
  async followUser(session: SessionDoc, targetUserId: string) {
    const user = Sessioning.getUser(session);
    const targetOid = new ObjectId(targetUserId);
    return await Profiling.followUser(user, targetOid);
  }

  // --- Chat Routes ---

  @Router.post("/chats/private")
  async startPrivateChat(session: SessionDoc, targetUserId: string) {
    const user = Sessioning.getUser(session);
    const targetOid = new ObjectId(targetUserId);
    return await Chatting.startPrivateChat(user, targetOid);
  }

  @Router.post("/chats/group")
  async startGroupChat(session: SessionDoc, participants: string[]) {
    const userIds = participants.map((id) => new ObjectId(id));
    return await Chatting.startGroupChat(userIds);
  }

  @Router.post("/chats/:chatId/messages")
  @Router.validate(z.object({ chatId: z.string().min(1), text: z.string().min(1) }))
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

  @Router.delete("/chats/:chatId/leave")
  @Router.validate(z.object({ chatId: z.string().min(1) }))
  async leaveChat(session: SessionDoc, chatId: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(chatId);
    return await Chatting.leaveChat(oid, user);
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
