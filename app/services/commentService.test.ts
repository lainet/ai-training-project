import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import {
  createComment,
  getCommentById,
  getApprovedCommentsByLesson,
  getPendingCommentsByLesson,
  approveComment,
  rejectComment,
  deleteComment,
  createCourseComment,
  getCourseCommentById,
  getApprovedCourseComments,
  getPendingCourseComments,
  approveCourseComment,
  rejectCourseComment,
  deleteCourseComment,
} from "./commentService";
import { createModule } from "./moduleService";
import { createLesson } from "./lessonService";

let lessonId: number;

describe("commentService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    const mod = createModule(base.course.id, "Test Module", 1);
    const lesson = createLesson(mod.id, "Test Lesson", null, null, 1, null);
    lessonId = lesson.id;
  });

  // ─── Lesson Comments ───────────────────────────────────────────────────────

  describe("createComment", () => {
    it("creates a comment with pending status", () => {
      const comment = createComment(lessonId, base.user.id, "Great lesson!");
      expect(comment.lessonId).toBe(lessonId);
      expect(comment.userId).toBe(base.user.id);
      expect(comment.content).toBe("Great lesson!");
      expect(comment.status).toBe(schema.CommentStatus.Pending);
    });
  });

  describe("getCommentById", () => {
    it("returns the comment when it exists", () => {
      const created = createComment(lessonId, base.user.id, "Hello");
      expect(getCommentById(created.id)?.id).toBe(created.id);
    });

    it("returns undefined for a nonexistent id", () => {
      expect(getCommentById(99999)).toBeUndefined();
    });
  });

  describe("getApprovedCommentsByLesson", () => {
    it("returns only approved comments with user info", () => {
      const a = createComment(lessonId, base.user.id, "Approved");
      createComment(lessonId, base.user.id, "Pending");
      approveComment(a.id);

      const results = getApprovedCommentsByLesson(lessonId);
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe("Approved");
      expect(results[0].userName).toBe(base.user.name);
    });

    it("returns empty array when no approved comments exist", () => {
      createComment(lessonId, base.user.id, "Still pending");
      expect(getApprovedCommentsByLesson(lessonId)).toHaveLength(0);
    });
  });

  describe("getPendingCommentsByLesson", () => {
    it("returns only pending comments", () => {
      const c = createComment(lessonId, base.user.id, "Pending one");
      const approved = createComment(lessonId, base.user.id, "Will be approved");
      approveComment(approved.id);

      const results = getPendingCommentsByLesson(lessonId);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(c.id);
    });
  });

  describe("approveComment", () => {
    it("sets status to approved", () => {
      const comment = createComment(lessonId, base.user.id, "Nice lesson");
      const updated = approveComment(comment.id);
      expect(updated?.status).toBe(schema.CommentStatus.Approved);
    });
  });

  describe("rejectComment", () => {
    it("sets status to rejected", () => {
      const comment = createComment(lessonId, base.user.id, "Bad comment");
      const updated = rejectComment(comment.id);
      expect(updated?.status).toBe(schema.CommentStatus.Rejected);
    });
  });

  describe("deleteComment", () => {
    it("removes the comment from the database", () => {
      const comment = createComment(lessonId, base.user.id, "To delete");
      deleteComment(comment.id);
      expect(getCommentById(comment.id)).toBeUndefined();
    });
  });

  // ─── Course Comments ───────────────────────────────────────────────────────

  describe("createCourseComment", () => {
    it("creates a comment with pending status", () => {
      const comment = createCourseComment(base.course.id, base.user.id, "Great course!");
      expect(comment.courseId).toBe(base.course.id);
      expect(comment.userId).toBe(base.user.id);
      expect(comment.content).toBe("Great course!");
      expect(comment.status).toBe(schema.CommentStatus.Pending);
    });
  });

  describe("getCourseCommentById", () => {
    it("returns the comment when it exists", () => {
      const created = createCourseComment(base.course.id, base.user.id, "Hello");
      expect(getCourseCommentById(created.id)?.id).toBe(created.id);
    });

    it("returns undefined for a nonexistent id", () => {
      expect(getCourseCommentById(99999)).toBeUndefined();
    });
  });

  describe("getApprovedCourseComments", () => {
    it("returns only approved course comments with user info", () => {
      const a = createCourseComment(base.course.id, base.user.id, "Approved");
      createCourseComment(base.course.id, base.user.id, "Pending");
      approveCourseComment(a.id);

      const results = getApprovedCourseComments(base.course.id);
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe("Approved");
      expect(results[0].userName).toBe(base.user.name);
    });

    it("returns empty array when no approved course comments exist", () => {
      createCourseComment(base.course.id, base.user.id, "Still pending");
      expect(getApprovedCourseComments(base.course.id)).toHaveLength(0);
    });
  });

  describe("getPendingCourseComments", () => {
    it("returns only pending course comments", () => {
      const c = createCourseComment(base.course.id, base.user.id, "Pending one");
      const approved = createCourseComment(base.course.id, base.user.id, "Will be approved");
      approveCourseComment(approved.id);

      const results = getPendingCourseComments(base.course.id);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(c.id);
    });
  });

  describe("approveCourseComment", () => {
    it("sets status to approved", () => {
      const comment = createCourseComment(base.course.id, base.user.id, "Great course");
      const updated = approveCourseComment(comment.id);
      expect(updated?.status).toBe(schema.CommentStatus.Approved);
    });
  });

  describe("rejectCourseComment", () => {
    it("sets status to rejected", () => {
      const comment = createCourseComment(base.course.id, base.user.id, "Bad comment");
      const updated = rejectCourseComment(comment.id);
      expect(updated?.status).toBe(schema.CommentStatus.Rejected);
    });
  });

  describe("deleteCourseComment", () => {
    it("removes the comment from the database", () => {
      const comment = createCourseComment(base.course.id, base.user.id, "To delete");
      deleteCourseComment(comment.id);
      expect(getCourseCommentById(comment.id)).toBeUndefined();
    });
  });
});
