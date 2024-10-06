import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";

/**
 * Comment information schema
 */
export interface CommentDoc extends BaseDoc {
  postId: ObjectId;
  author: ObjectId;
  text: string;
  timestamp: Date;
}

/**
 * concept: Commenting [Associated with Posts]
 */
export default class CommentingConcept {
  public readonly comments: DocCollection<CommentDoc>;

  /**
   * Make an instance of CommentingConcept.
   */
  constructor(collectionName: string) {
    this.comments = new DocCollection<CommentDoc>(collectionName);
  }

  async addComment(postId: ObjectId, author: ObjectId, text: string) {
    const timestamp = new Date();
    return await this.comments.createOne({ postId, author, text, timestamp });
  }

  async editComment(commentId: ObjectId, newText: string) {
    const comment = await this.comments.readOne({ _id: commentId });
    if (!comment) {
      throw new CommentNotFoundError(commentId);
    }
    comment.text = newText;
    comment.timestamp = new Date();
    await this.comments.replaceOne({ _id: commentId }, comment);
    return { msg: "Comment updated successfully" };
  }

  async deleteComment(commentId: ObjectId) {
    await this.comments.deleteOne({ _id: commentId });
    return { msg: "Comment deleted successfully" };
  }

  async getCommentsByPost(postId: ObjectId) {
    return await this.comments.readMany({ postId });
  }
}

/** Custom Error Classes */
export class CommentNotFoundError extends Error {
  constructor(public readonly commentId: ObjectId) {
    super(`Comment with ID ${commentId} does not exist!`);
  }
}
