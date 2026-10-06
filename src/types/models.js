/**
 * Data contracts mirror the supplied ADAPT product specification.
 * Keep property names unchanged when replacing mock data with API data.
 */

export const UserModel = {
  id: "user_001",
  name: "Alex",
  email: "alex@example.com",
  avatarUrl: null,
  subjects: ["os", "dbms"],
  goals: ["exam_preparation"],
  preferences: {
    learningStyles: ["examples", "short_explanations"],
    preferredDifficulty: "medium",
    voiceEnabled: true
  },
  createdAt: "2026-10-03T10:00:00Z"
};
