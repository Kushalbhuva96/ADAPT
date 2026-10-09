import { generateStructuredAIResponse } from "./aiClient.js";
import { AICourseResponseJsonSchema, AICourseResponseSchema } from "../validators/schemas.js";
import { Course, ICourseTopic } from "../models/Course.js";

export async function generateCourseFromAI(
  learningRequest: string,
  userId: string
) {
  const systemPrompt = `You are the master curriculum architect for ADAPT, an adaptive AI learning companion.
The student will provide a learning goal or request in natural language.
Analyze their request and design a structured, rigorous, high-quality course.

REQUIREMENTS:
1. Identify the overarching subject and provide a concise ID (e.g. 'os', 'react', 'dbms', 'neural_networks').
2. Select a suitable Lucide icon name (e.g., 'cpu', 'database', 'globe', 'brain', 'code', 'sparkles').
3. Create 5 to 7 well-sequenced, coherent topics/modules covering fundamental to advanced aspects of the requested goal.
4. For each topic:
   - Provide a clear, professional name.
   - A 1-2 sentence description explaining the concept and practical application.
   - Default difficulty ('easy', 'medium', or 'hard').
   - 2-3 specific learning objectives.
5. In 'understanding', articulate:
   - 'learningGoal': A clear statement of what the learner aims to accomplish.
   - 'detectedDifficulty': 'Beginner', 'Intermediate', or 'Personalized after assessment'.
   - 'startingAssumption': 'Starting level will be confirmed by diagnostic.'
6. Output JSON conforming strictly to:
{
  "subject": {
    "id": "subject_slug",
    "name": "Subject Name",
    "icon": "brain",
    "description": "Short overview"
  },
  "topics": [
    {
      "name": "Topic Name",
      "description": "Topic description",
      "difficulty": "easy",
      "learningObjectives": ["Objective 1", "Objective 2"],
      "subtopics": ["Subtopic 1", "Subtopic 2"]
    }
  ],
  "understanding": {
    "learningGoal": "Goal summary",
    "detectedDifficulty": "Beginner",
    "startingAssumption": "Starting level will be confirmed by diagnostic."
  },
  "estimatedLearningTimeMinutes": 180
}`;

  const userPrompt = `Learning request: "${learningRequest}"`;

  const aiData = await generateStructuredAIResponse(
    systemPrompt,
    userPrompt,
    (raw) => AICourseResponseSchema.parse(raw),
    AICourseResponseJsonSchema
  );

  const courseId = `course_${aiData.subject.id}_${Date.now()}`;

  const courseTopics: ICourseTopic[] = aiData.topics.map((t, idx) => ({
    id: `${courseId}_topic_${idx + 1}`,
    subjectId: aiData.subject.id,
    name: t.name,
    description: t.description,
    mastery: 0,
    accuracy: 0,
    attempts: 0,
    learningState: "LOCKED",
    status: "not_started",
    difficulty: t.difficulty as any,
    learningObjectives: t.learningObjectives,
    subtopics: t.subtopics,
  }));

  const fullSubject = {
    id: aiData.subject.id,
    name: aiData.subject.name,
    icon: aiData.subject.icon || "brain",
    description: aiData.subject.description,
    totalTopics: courseTopics.length,
    completedTopics: 0,
  };

  const courseDoc = new Course({
    id: courseId,
    userId,
    title: aiData.subject.name,
    description: aiData.subject.description,
    learningRequest,
    subject: fullSubject,
    topics: courseTopics,
    estimatedLearningTimeMinutes: aiData.estimatedLearningTimeMinutes || courseTopics.length * 35,
    moduleCount: courseTopics.length,
    understanding: aiData.understanding,
    status: "setup",
    progress: 0,
    completedTopicIds: [],
    topicAttempts: {},
  });

  const saveStartedAt = performance.now();
  await courseDoc.save();
  console.info(`[Performance] Course persistence completed in ${Math.round(performance.now() - saveStartedAt)}ms.`);

  return {
    course: {
      id: courseId,
      title: aiData.subject.name,
      requestedTopic: learningRequest,
      description: aiData.subject.description,
      subject: fullSubject,
      topics: courseTopics.map((topic, index) => ({ ...topic, sequence: index + 1 })),
      recommendedSequence: courseTopics.map((topic, index) => ({ sequence: index + 1, topicId: topic.id, topicName: topic.name })),
      difficultyProgression: courseTopics.map((topic, index) => ({ sequence: index + 1, topicId: topic.id, difficulty: topic.difficulty })),
      estimatedLearningTimeMinutes: courseDoc.estimatedLearningTimeMinutes,
      moduleCount: courseTopics.length,
    },
    understanding: aiData.understanding,
  };
}
