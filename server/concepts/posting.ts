import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

// Define possible post states
export enum PostState {
  LookingForPeople = "LookingForPeople",
  GeneralDiscussion = "GeneralDiscussion",
}

// Define the Post options with state, tags, likes, and options
export interface PostOptions {
  backgroundColor?: string;
}

export interface PostDoc extends BaseDoc {
  author: ObjectId;
  content: string;
  state: PostState;
  tags: string[];
  likes: ObjectId[]; // Array of user IDs who liked the post
  options?: PostOptions;
}

/**
 * Concept: Posting [Author]
 */
export default class PostingConcept {
  public readonly posts: DocCollection<PostDoc>;

  /**
   * Make an instance of Posting.
   */
  constructor(collectionName: string) {
    this.posts = new DocCollection<PostDoc>(collectionName);
  }

  /**
   * Create a post with content, state, tags, and options.
   */
  async create(author: ObjectId, content: string, state: PostState, options?: PostOptions) {
    const _id = await this.posts.createOne({
      author,
      content,
      state,
      likes: [], // Initialize with no likes
      options,
    });
    return { msg: "Post successfully created!", post: await this.posts.readOne({ _id }) };
  }

  /**
   * Get all posts.
   */
  async getPosts() {
    // Returns all posts! You might want to page for better client performance
    return await this.posts.readMany({}, { sort: { _id: -1 } });
  }

  /**
   * Get posts by author.
   */
  async getByAuthor(author: ObjectId) {
    return await this.posts.readMany({ author });
  }

  /**
   * Update the content, state, or tags of an existing post.
   */
  async update(_id: ObjectId, content?: string, state?: PostState, options?: PostOptions) {
    // Only update fields that are provided
    await this.posts.partialUpdateOne({ _id }, { content, state, options });
    return { msg: "Post successfully updated!" };
  }

  /**
   * Delete a post.
   */
  async delete(_id: ObjectId) {
    await this.posts.deleteOne({ _id });
    return { msg: "Post deleted successfully!" };
  }

  /**
   * React to a post by adding a like from a user.
   */
  async reactToPost(user: ObjectId, postId: ObjectId) {
    const post = await this.posts.readOne({ _id: postId });
    if (!post) {
      throw new NotFoundError(`Post ${postId} does not exist!`);
    }
    const alreadyLiked = post.likes.some((like: ObjectId) => like.equals(user));
    if (!alreadyLiked) {
      post.likes.push(user); // Add user to the likes if not already liked
      await this.posts.partialUpdateOne({ _id: postId }, { likes: post.likes });
    }
    return { msg: "Post liked!" };
  }

  /**
   * Get the number of likes for a post.
   */
  async getNumberOfLikes(postId: ObjectId): Promise<number> {
    const post = await this.posts.readOne({ _id: postId });
    if (!post) {
      throw new NotFoundError(`Post ${postId} does not exist!`);
    }
    return post.likes.length;
  }

  /**
   * Ensure the current user is the author of the post.
   */
  async assertAuthorIsUser(_id: ObjectId, user: ObjectId) {
    const post = await this.posts.readOne({ _id });
    if (!post) {
      throw new NotFoundError(`Post ${_id} does not exist!`);
    }
    if (post.author.toString() !== user.toString()) {
      throw new PostAuthorNotMatchError(user, _id);
    }
  }
}

export class PostAuthorNotMatchError extends NotAllowedError {
  constructor(
    public readonly author: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the author of post {1}!", author, _id);
  }
}
