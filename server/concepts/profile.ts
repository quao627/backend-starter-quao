import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";

/**
 * Profile information schema
 */
export interface ProfileDoc extends BaseDoc {
  userId: ObjectId;
  name: string;
  expertise: string[];
  interests: string[];
  pastExperience: string[];
  verificationStatus: "verified" | "unverified";
  gender: string;
  followers: ObjectId[];
  following: ObjectId[];
}

/**
 * concept: Profile [User]
 */
export default class ProfileConcept {
  public readonly profiles: DocCollection<ProfileDoc>;

  constructor(collectionName: string) {
    this.profiles = new DocCollection<ProfileDoc>(collectionName);
  }

  async createProfile(userId: ObjectId, name: string, expertise: string[], interests: string[], pastExperience: string[], gender: string) {
    return await this.profiles.createOne({
      userId,
      name,
      expertise,
      interests,
      pastExperience,
      verificationStatus: "unverified",
      gender,
      followers: [],
      following: [],
    });
  }

  async editProfile(userId: ObjectId, updatedInfo: Partial<ProfileDoc>) {
    return await this.profiles.partialUpdateOne({ userId }, updatedInfo);
  }

  async verifyProfile(userId: ObjectId) {
    return await this.profiles.partialUpdateOne({ userId }, { verificationStatus: "verified" });
  }

  async followUser(userId: ObjectId, targetUserId: ObjectId) {
    const profile = await this.profiles.readOne({ userId: targetUserId });
    if (!profile) {
      throw new ProfileNotFoundError(targetUserId);
    }
    if (!profile.followers.includes(userId)) {
      profile.followers.push(userId);
      await this.profiles.partialUpdateOne({ userId: targetUserId }, { followers: profile.followers });
    }

    const currentUserProfile = await this.profiles.readOne({ userId });
    if (currentUserProfile && !currentUserProfile.following.includes(targetUserId)) {
      currentUserProfile.following.push(targetUserId);
      await this.profiles.partialUpdateOne({ userId }, { following: currentUserProfile.following });
    }

    return { msg: "User followed successfully" };
  }

  async getProfile(userId: ObjectId) {
    const profile = await this.profiles.readOne({ userId });
    if (!profile) {
      throw new ProfileNotFoundError(userId);
    }
    return profile;
  }

  async getFollowers(userId: ObjectId) {
    const profile = await this.profiles.readOne({ userId });
    if (!profile) {
      throw new ProfileNotFoundError(userId);
    }
    return profile.followers;
  }

  async getFollowing(userId: ObjectId) {
    const profile = await this.profiles.readOne({ userId });
    if (!profile) {
      throw new ProfileNotFoundError(userId);
    }
    return profile.following;
  }
}

/** Custom Error Classes */
export class ProfileNotFoundError extends Error {
  constructor(public readonly userId: ObjectId) {
    super(`Profile for User ID ${userId} does not exist!`);
  }
}
