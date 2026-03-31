import { useEffect, useState } from "react";
import { Form, Link, useFetcher, useSearchParams } from "react-router";
import { toast } from "sonner";
import type { Route } from "./+types/courses.$slug";
import {
  getCourseBySlug,
  getCourseWithDetails,
  getLessonCountForCourse,
} from "~/services/courseService";
import { isUserEnrolled } from "~/services/enrollmentService";
import {
  calculateProgress,
  getLessonProgressForCourse,
  getNextIncompleteLesson,
} from "~/services/progressService";
import { getCurrentUserId } from "~/lib/session";
import { LessonProgressStatus } from "~/db/schema";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsContentNoShift,
} from "~/components/ui/tabs";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquare,
  Pencil,
  PlayCircle,
  Users,
} from "lucide-react";

const addCourseCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty.")
    .max(2000, "Comment is too long (max 2000 characters)."),
});
import { CourseImage } from "~/components/course-image";
import { UserAvatar } from "~/components/user-avatar";
import { data, isRouteErrorResponse } from "react-router";
import { formatDuration, formatPrice } from "~/lib/utils";
import { renderMarkdown } from "~/lib/markdown.server";
import { resolveCountry } from "~/lib/country.server";
import { calculatePppPrice, getCountryTierInfo } from "~/lib/ppp";
import {
  getAverageRatingForCourse,
  getUserRatingForCourse,
  upsertCourseReview,
} from "~/services/reviewService";
import {
  createCourseComment,
  getApprovedCourseComments,
} from "~/services/commentService";
import { StarDisplay, StarPicker } from "~/components/star-rating";
import { z } from "zod";

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Course";
  return [
    { title: `${title} — Cadence` },
    { name: "description", content: loaderData?.course?.description ?? "" },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const slug = params.slug;
  const course = getCourseBySlug(slug);

  if (!course) {
    throw data("Course not found", { status: 404 });
  }

  const courseWithDetails = getCourseWithDetails(course.id);
  if (!courseWithDetails) {
    throw data("Course not found", { status: 404 });
  }

  const lessonCount = getLessonCountForCourse(course.id);
  const currentUserId = await getCurrentUserId(request);

  let enrolled = false;
  let progress = 0;
  let lessonProgressMap: Record<number, string> = {};
  let nextLessonId: number | null = null;

  if (currentUserId) {
    enrolled = isUserEnrolled(currentUserId, course.id);

    if (enrolled) {
      progress = calculateProgress(currentUserId, course.id, false, false);

      const progressRecords = getLessonProgressForCourse(
        currentUserId,
        course.id
      );
      for (const record of progressRecords) {
        lessonProgressMap[record.lessonId] = record.status;
      }

      const nextLesson = getNextIncompleteLesson(currentUserId, course.id);
      nextLessonId = nextLesson?.id ?? null;
    }
  }

  // Render sales copy from Markdown to HTML server-side
  const salesCopyHtml = courseWithDetails.salesCopy
    ? await renderMarkdown(courseWithDetails.salesCopy)
    : null;

  const country = await resolveCountry(request);
  const pppPrice = courseWithDetails.pppEnabled
    ? calculatePppPrice(courseWithDetails.price, country)
    : courseWithDetails.price;
  const tierInfo = getCountryTierInfo(country);

  const { avgRating, ratingCount } = getAverageRatingForCourse(course.id);
  const userRating =
    currentUserId && enrolled
      ? getUserRatingForCourse(currentUserId, course.id)
      : null;

  const comments = getApprovedCourseComments(course.id);

  return {
    course: courseWithDetails,
    salesCopyHtml,
    lessonCount,
    enrolled,
    progress,
    lessonProgressMap,
    nextLessonId,
    currentUserId,
    pppPrice,
    tierInfo,
    avgRating,
    ratingCount,
    userRating,
    comments,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const course = getCourseBySlug(params.slug);
  if (!course) {
    throw data("Course not found", { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "rate") {
    if (!isUserEnrolled(currentUserId, course.id)) {
      throw data("You must be enrolled to rate this course", { status: 403 });
    }
    const rating = Number(formData.get("rating"));
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return { error: "Please select a rating between 1 and 5 stars." };
    }
    upsertCourseReview(currentUserId, course.id, rating);
    return { success: true };
  }

  if (intent === "add-comment") {
    if (!isUserEnrolled(currentUserId, course.id)) {
      throw data("You must be enrolled to comment.", { status: 403 });
    }
    const content = formData.get("content");
    if (!content || typeof content !== "string") {
      return { commentError: "Comment cannot be empty." };
    }
    const parsed = addCourseCommentSchema.safeParse({ content });
    if (!parsed.success) {
      return { commentError: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    createCourseComment(course.id, currentUserId, parsed.data.content.trim());
    return { commentSuccess: true };
  }

  throw data("Invalid action.", { status: 400 });
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6">
        <Skeleton className="h-4 w-48" />
      </nav>
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="mb-6 aspect-video rounded-lg" />
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="mb-3 h-9 w-3/4" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="mb-4 h-4 w-2/3" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
      <Skeleton className="mb-4 h-8 w-40" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function CourseDetail({ loaderData, actionData }: Route.ComponentProps) {
  const {
    course,
    salesCopyHtml,
    lessonCount,
    enrolled,
    progress,
    lessonProgressMap,
    nextLessonId,
    currentUserId,
    pppPrice,
    tierInfo,
    avgRating,
    ratingCount,
    userRating,
    comments,
  } = loaderData;
  const isInstructor = currentUserId === course.instructorId;
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("already_enrolled") === "1") {
      toast.info("You're already enrolled in this course.");
      setSearchParams(
        (prev) => {
          prev.delete("already_enrolled");
          return prev;
        },
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      toast.success("Your rating has been saved!");
    }
    if (actionData && "error" in actionData && actionData.error) {
      toast.error(actionData.error);
    }
    if (actionData && "commentSuccess" in actionData && actionData.commentSuccess) {
      toast.success("Comment submitted for review.");
    }
  }, [actionData]);

  const totalDuration = course.modules.reduce(
    (sum, mod) =>
      sum + mod.lessons.reduce((s, l) => s + (l.durationMinutes ?? 0), 0),
    0
  );

  const pppPriceLabel = formatPrice(pppPrice);
  const isDiscounted = pppPrice < course.price;

  const selfPurchaseLink = currentUserId
    ? `/courses/${course.slug}/purchase`
    : `/signup?redirectTo=${encodeURIComponent(`/courses/${course.slug}/purchase`)}`;

  const teamPurchaseLink = currentUserId
    ? `/courses/${course.slug}/purchase?mode=team`
    : `/signup?redirectTo=${encodeURIComponent(`/courses/${course.slug}/purchase?mode=team`)}`;

  const priceDisplay = (
    <div className="mb-3 text-center">
      {isDiscounted ? (
        <>
          <div className="text-sm text-muted-foreground line-through">
            {formatPrice(course.price)}
          </div>
          <div className="text-2xl font-bold">{pppPriceLabel}</div>
          <div className="mt-1 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
            {tierInfo.label} — PPP discount
          </div>
        </>
      ) : (
        <div className="text-2xl font-bold">{pppPriceLabel}</div>
      )}
    </div>
  );

  const enrollButton = (
    <Tabs defaultValue="self">
      <TabsList className="mb-4 w-full">
        <TabsTrigger value="self" className="flex-1 text-xs">
          Buy for Myself
        </TabsTrigger>
        <TabsTrigger value="team" className="flex-1 text-xs">
          Buy for Team
        </TabsTrigger>
      </TabsList>
      <TabsContentNoShift>
        <TabsContent value="self" forceMount>
          {priceDisplay}
          <Link to={selfPurchaseLink}>
            <Button size="lg" className="w-full">
              Enroll Now — {pppPriceLabel}
            </Button>
          </Link>
        </TabsContent>
        <TabsContent value="team" forceMount>
          {priceDisplay}
          <Link to={teamPurchaseLink}>
            <Button size="lg" variant="outline" className="w-full">
              Buy for Your Team
            </Button>
          </Link>
        </TabsContent>
      </TabsContentNoShift>
    </Tabs>
  );

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/courses" className="hover:text-foreground">
          Courses
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{course.title}</span>
      </nav>

      {/* Hero section */}
      <div className="mb-8">
        <div className="mb-6 aspect-video max-h-64 overflow-hidden rounded-lg">
          <CourseImage
            src={course.coverImageUrl}
            alt={course.title}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="mb-2 text-sm font-medium text-primary">
          {course.categoryName}
        </div>
        <div className="mb-3 flex items-start justify-between gap-4">
          <h1 className="text-4xl font-bold">{course.title}</h1>
          {currentUserId === course.instructorId && (
            <Link to={`/instructor/${course.id}`}>
              <Button variant="outline" size="sm" className="shrink-0">
                <Pencil className="mr-1.5 size-3.5" />
                Edit Course
              </Button>
            </Link>
          )}
        </div>
        <p className="mb-4 text-lg text-muted-foreground">
          {course.description}
        </p>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <UserAvatar
              name={course.instructorName}
              avatarUrl={course.instructorAvatarUrl}
              className="size-5"
            />
            {course.instructorName}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="size-4" />
            {lessonCount} lessons
          </span>
          {totalDuration > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="size-4" />
              {formatDuration(totalDuration, true, false, false)} total
            </span>
          )}
          <StarDisplay rating={avgRating} ratingCount={ratingCount} />
        </div>
      </div>

      {/* Two-column: sales copy left, sidebar right */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left column: sales copy + course content */}
        <div className="lg:col-span-2">
          {salesCopyHtml ? (
            <div
              className="prose prose-neutral dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: salesCopyHtml }}
            />
          ) : (
            <p className="text-muted-foreground">{course.description}</p>
          )}

          {/* Bottom CTA */}
          {!enrolled && !isInstructor && (
            <div className="mt-8 rounded-lg border bg-muted/50 p-6">
              <h3 className="mb-2 text-lg font-semibold">
                Ready to get started?
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Join this course and start learning today.
              </p>
              {enrollButton}
            </div>
          )}

          <div className="mt-8">
            <CourseContent
              course={course}
              enrolled={enrolled}
              isInstructor={isInstructor}
              lessonProgressMap={lessonProgressMap}
            />
          </div>

          <div className="mt-8">
            <CourseCommentsSection
              courseId={course.id}
              courseSlug={course.slug}
              comments={comments}
              enrolled={enrolled}
              currentUserId={currentUserId}
              actionData={actionData}
            />
          </div>
        </div>

        {/* Right column: progress/enrollment card + rating card */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <h2 className="text-lg font-semibold">
                {isInstructor
                  ? "Your Course"
                  : enrolled
                    ? "Your Progress"
                    : "Get Started"}
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {isInstructor ? (
                <Link to={`/instructor/${course.id}`}>
                  <Button className="w-full">
                    <Pencil className="mr-2 size-4" />
                    Manage Course
                  </Button>
                </Link>
              ) : enrolled ? (
                <>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>{progress}% complete</span>
                  </div>
                  <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {course.modules.length > 0 &&
                    (() => {
                      const targetLessonId =
                        nextLessonId ?? course.modules[0].lessons[0]?.id;
                      return targetLessonId ? (
                        <Link
                          to={`/courses/${course.slug}/lessons/${targetLessonId}`}
                        >
                          <Button className="w-full">
                            <PlayCircle className="mr-2 size-4" />
                            {progress > 0
                              ? "Continue Learning"
                              : "Start Course"}
                          </Button>
                        </Link>
                      ) : null;
                    })()}
                  <Link to={teamPurchaseLink}>
                    <Button variant="outline" className="w-full">
                      <Users className="mr-2 size-4" />
                      Buy More Seats
                    </Button>
                  </Link>
                </>
              ) : (
                enrollButton
              )}
              <div className="space-y-2 pt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4" />
                  <span>{lessonCount} lessons</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-4" />
                  <span>
                    {formatDuration(totalDuration, true, false, false)} total
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <UserAvatar
                    name={course.instructorName}
                    avatarUrl={course.instructorAvatarUrl}
                    className="size-5"
                  />
                  <span>Taught by {course.instructorName}</span>
                </div>
                {course.instructorBio && (
                  <p className="mt-2 text-xs leading-relaxed">
                    {course.instructorBio}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Rating card — only for enrolled students */}
          {enrolled && !isInstructor && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold">Rate This Course</h2>
              </CardHeader>
              <CardContent>
                <Form method="post">
                  <input type="hidden" name="intent" value="rate" />
                  <div className="flex flex-col items-center gap-3">
                    <StarPicker name="rating" defaultValue={userRating} />
                    <p className="text-xs text-muted-foreground">
                      {userRating
                        ? "Update your rating"
                        : "Share your experience"}
                    </p>
                    <Button type="submit" size="sm" className="w-full">
                      {userRating ? "Update Rating" : "Submit Rating"}
                    </Button>
                  </div>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

type CourseCommentRow = {
  id: number;
  content: string;
  createdAt: string;
  userId: number;
  userName: string;
  userAvatarUrl: string | null;
};

function CourseCommentsSection({
  courseId,
  courseSlug,
  comments,
  enrolled,
  currentUserId,
  actionData,
}: {
  courseId: number;
  courseSlug: string;
  comments: CourseCommentRow[];
  enrolled: boolean;
  currentUserId: number | null;
  actionData: Record<string, unknown> | null | undefined;
}) {
  const commentFetcher = useFetcher({ key: `course-comments-${courseId}` });
  const isSubmitting = commentFetcher.state !== "idle";
  const submitted =
    commentFetcher.data && "commentSuccess" in commentFetcher.data && commentFetcher.data.commentSuccess;
  const commentError =
    commentFetcher.data && "commentError" in commentFetcher.data
      ? String(commentFetcher.data.commentError)
      : null;
  const [content, setContent] = useState("");

  useEffect(() => {
    if (submitted) {
      setContent("");
    }
  }, [submitted]);

  return (
    <div className="border-t pt-8">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="size-5 text-primary" />
        <h2 className="text-2xl font-bold">
          Discussion
          {comments.length > 0 && (
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </h2>
      </div>

      {comments.length === 0 ? (
        <p className="mb-6 text-sm text-muted-foreground">
          No comments yet. Be the first to start the discussion!
        </p>
      ) : (
        <div className="mb-6 space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                {c.userName.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="text-sm font-medium">{c.userName}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {enrolled && currentUserId ? (
        <commentFetcher.Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="add-comment" />
          <textarea
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ask a question or share your thoughts about this course…"
            rows={3}
            maxLength={2000}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          {commentError && (
            <p className="text-sm text-destructive">{commentError}</p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{content.length}/2000</span>
            <Button type="submit" size="sm" disabled={isSubmitting || content.trim().length === 0}>
              {isSubmitting ? "Submitting…" : "Post Comment"}
            </Button>
          </div>
        </commentFetcher.Form>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link to={`/courses/${courseSlug}/purchase`} className="underline hover:text-foreground">
            Enroll in this course
          </Link>{" "}
          to join the discussion.
        </p>
      )}
    </div>
  );
}

function CourseContent({
  course,
  enrolled,
  isInstructor,
  lessonProgressMap,
}: {
  course: {
    id: number;
    slug: string;
    modules: Array<{
      id: number;
      title: string;
      lessons: Array<{
        id: number;
        title: string;
        durationMinutes: number | null;
      }>;
    }>;
  };
  enrolled: boolean;
  isInstructor: boolean;
  lessonProgressMap: Record<number, string>;
}) {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Course Content</h2>
      {course.modules.length === 0 ? (
        <p className="text-muted-foreground">
          No content has been added to this course yet.
        </p>
      ) : (
        <div className="space-y-4">
          {course.modules.map((mod) => (
            <Card key={mod.id}>
              <CardHeader>
                <h3 className="font-semibold">
                  <Link
                    to={`/courses/${course.slug}/${mod.id}`}
                    className="hover:underline"
                  >
                    {mod.title}
                  </Link>
                </h3>
                <p className="text-sm text-muted-foreground">
                  {mod.lessons.length} lessons
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {mod.lessons.map((lesson) => {
                    const status = lessonProgressMap[lesson.id];
                    const isCompleted =
                      status === LessonProgressStatus.Completed;
                    const isLessonInProgress =
                      status === LessonProgressStatus.InProgress;

                    if (isInstructor) {
                      return (
                        <li key={lesson.id}>
                          <Link
                            to={`/instructor/${course.id}/lessons/${lesson.id}`}
                            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
                          >
                            <Pencil className="size-4 shrink-0 text-muted-foreground" />
                            <span className="flex-1">{lesson.title}</span>
                            {lesson.durationMinutes && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="size-3" />
                                {formatDuration(
                                  lesson.durationMinutes,
                                  true,
                                  false,
                                  false
                                )}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    }

                    return (
                      <li key={lesson.id}>
                        {enrolled ? (
                          <Link
                            to={`/courses/${course.slug}/lessons/${lesson.id}`}
                            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                            ) : isLessonInProgress ? (
                              <PlayCircle className="size-4 shrink-0 text-blue-500" />
                            ) : (
                              <Circle className="size-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="flex-1">{lesson.title}</span>
                            {lesson.durationMinutes && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="size-3" />
                                {formatDuration(
                                  lesson.durationMinutes,
                                  true,
                                  false,
                                  false
                                )}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 px-3 py-2 text-sm">
                            <Circle className="size-4 shrink-0 text-muted-foreground" />
                            <span className="flex-1">{lesson.title}</span>
                            {lesson.durationMinutes && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="size-3" />
                                {formatDuration(
                                  lesson.durationMinutes,
                                  true,
                                  false,
                                  false
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading this course.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Course not found";
      message =
        "The course you're looking for doesn't exist or may have been removed.";
    } else if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/courses">
            <Button variant="outline">Browse Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
