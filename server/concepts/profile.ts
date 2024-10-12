import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";

/**
 * Profile information schema
 */
export interface ProfileInfo {
  name: string;
  expertise: string;
  interests: string;
  pastExperience: string;
  gender: string;
}

export interface ProfileDoc extends BaseDoc {
  author: ObjectId;
  verificationStatus: "verified" | "unverified";
  friends: ObjectId[];
  profileInfo: ProfileInfo;
}

/**
 * concept: Profile [User]
 */
export default class ProfileConcept {
  public readonly profiles: DocCollection<ProfileDoc>;

  constructor(collectionName: string) {
    this.profiles = new DocCollection<ProfileDoc>(collectionName);
  }

  async createProfile(author: ObjectId, name: string, expertise: string, interests: string, pastExperience: string, gender: string) {
    const existingProfile = await this.profiles.readOne({ author });
    if (existingProfile) {
      throw new Error("Profile already exists for this user.");
    }
    console.log("Creating profile for user", author);

    const profileInfo: ProfileInfo = { name, expertise, interests, pastExperience, gender };
    await this.profiles.createOne({ author, verificationStatus: "unverified", profileInfo: profileInfo });
    return { msg: "Profile created successfully" };
  }

  async editProfile(author: ObjectId, name: string, expertise: string, interests: string, pastExperience: string, gender: string) {
    const updatedInfo: ProfileInfo = { name, expertise, interests, pastExperience, gender };
    await this.profiles.partialUpdateOne({ author: author }, { profileInfo: updatedInfo });
    return { msg: "Profile updated successfully" };
  }

  async verifyProfile(author: ObjectId) {
    return await this.profiles.partialUpdateOne({ author: author }, { verificationStatus: "verified" });
  }

  async getProfile(author: ObjectId) {
    const profile = await this.profiles.readOne({ author: author });
    if (!profile) {
      throw new ProfileNotFoundError(author);
    }
    return profile;
  }
}

/** Custom Error Classes */
export class ProfileNotFoundError extends Error {
  constructor(public readonly userId: ObjectId) {
    super(`Profile for User ID ${userId} does not exist!`);
  }
}
