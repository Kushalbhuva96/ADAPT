import test from "node:test";
import assert from "node:assert/strict";
import { resolveOfflineCourseState } from "./courseOfflineState.js";

const downloadedCourse = { id: "saved", title: "Saved course" };
const currentCourse = { id: "active", title: "Current course" };
const downloads = [{ courseId: downloadedCourse.id, course: downloadedCourse }];

test("offline transition selects the saved copy of the current course", () => {
  const state = resolveOfflineCourseState({
    downloads: [...downloads, { courseId: currentCourse.id, course: { ...currentCourse, title: "Saved current course" } }],
    currentCourse,
    currentCourses: [currentCourse],
    preferredId: currentCourse.id,
  });

  assert.equal(state.course.title, "Saved current course");
  assert.equal(state.offlineOnly, true);
  assert.equal(state.offlineUnavailable, false);
});

test("offline transition preserves an open course when it has no saved copy", () => {
  const currentCourses = [currentCourse];
  const state = resolveOfflineCourseState({
    downloads,
    currentCourse,
    currentCourses,
    preferredId: currentCourse.id,
  });

  assert.equal(state.course, currentCourse);
  assert.equal(state.courses, currentCourses);
  assert.equal(state.offlineOnly, false);
  assert.equal(state.offlineUnavailable, true);
});

test("offline entry without an open course selects the preferred download", () => {
  const state = resolveOfflineCourseState({
    downloads,
    currentCourse: null,
    currentCourses: [],
    preferredId: downloadedCourse.id,
  });

  assert.equal(state.course, downloadedCourse);
  assert.equal(state.offlineOnly, true);
  assert.equal(state.error, "");
});

test("offline entry without any saved course reports unavailable content", () => {
  const state = resolveOfflineCourseState({
    downloads: [],
    currentCourse: null,
    currentCourses: [],
    preferredId: null,
  });

  assert.equal(state.course, null);
  assert.match(state.error, /No downloaded courses/);
});
